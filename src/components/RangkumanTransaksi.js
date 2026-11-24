import React, { useMemo, useState, useRef, useEffect, useDeferredValue } from "react";
import * as XLSX from "xlsx";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filter, ArrowUp, ArrowDown, ArrowUpDown, X, Download, CheckCircle, XCircle, Calendar, ChevronLeft, ChevronRight, Search, Copy, Check, RotateCcw, SlidersHorizontal, ChevronDown, Receipt } from 'lucide-react';
import { useProcessedOrders } from '../hooks/useProcessedOrders';
import { useDataCache } from '../contexts/DataContext';

// Nama kolom tampilan sesuai istilah standar keuangan (kunci data internal tidak diubah)
const COLUMN_LABELS = {
    'PENCAIRAN': 'PENERIMAAN DANA',
    'LABA': 'MARGIN KONTRIBUSI',
    'AFFILIASI': 'KOMISI AFILIASI',
    'KET AFFILIASI': 'KET AFILIASI',
    'TERKIRIM': 'STATUS PENGIRIMAN',
    'Menanggung Ongkir': 'Ongkir Retur Dibebankan ke Pembeli',
};
const colLabel = (c) => COLUMN_LABELS[c] || c;

export default function RangkumanTransaksi({ isHidden = false }) {
    const { getComputed, setComputed } = useDataCache();

    // ─── All data processing is now handled by useProcessedOrders ────────
    // This hook fetches data, builds lookup maps, and computes all row fields
    // in ONE place — shared with Dashboard, OlahanDataPesanan, etc.
    // No more duplicate calculation on this page.
    const {
        rangkumanData,
        rangkumanVersion,
        loading: isLoading,
        returnTimeByOrderId,
        returnResiByOrderId,
        ordersGroupedById,
        modalValues,
    } = useProcessedOrders();

    function formatRupiah(number) {
        if (typeof number !== 'number' || isNaN(number)) return '';
        const rounded = Math.round(number);
        if (rounded < 0) return 'Rp-' + (-rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return 'Rp' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // ─── Pre-built Verifikasi Paket objects (reused across all rows, 0 allocations per row) ──
    const verifikasiObjMap = useMemo(() => ({
        '✓': {
            text: '✓',
            jsx: (
                <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    title="Pesanan selesai / cancel tanpa resi">
                    <CheckCircle size={14} />
                </span>
            ),
        },
        'Diterima': {
            text: 'Diterima',
            jsx: (
                <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    title="Resi ditemukan">
                    <CheckCircle size={14} />Diterima
                </span>
            ),
        },
        'Belum Diterima': {
            text: 'Belum Diterima',
            jsx: (
                <span style={{ color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    title="Resi tidak ditemukan">
                    <XCircle size={14} />Belum Diterima
                </span>
            ),
        },
        '-': { text: '-', jsx: '-' },
    }), []);

    // ─── Map rangkumanData → table rows (VERY fast — cached in DataContext) ───
    const dataFingerprint = `rangkuman_v3::${rangkumanVersion || rangkumanData.length}`;

    const effectiveTableData = useMemo(() => {
        if (rangkumanData.length === 0) return [];

        const cached = getComputed(dataFingerprint + '::table');
        if (cached && cached.length > 0) {
            return cached;
        }

        const rows = new Array(rangkumanData.length);
        for (let i = 0; i < rangkumanData.length; i++) {
            const r = rangkumanData[i];
            const verifikasiPaketText = r.verifikasiPaket || '-';
            const verifikasiObj = verifikasiObjMap[verifikasiPaketText] || { text: verifikasiPaketText, jsx: verifikasiPaketText };
            rows[i] = {
                'ORDER ID': r.orderId,
                'WAKTU PESANAN DIBUAT': r.waktuPesananDibuat,
                'WAKTU PENGIRIMAN': r.waktuPengiriman,
                'QTT': r.totalQuantity.toString(),
                'STATUS ORDER': r.statusOrder,
                'HPP': r.hppDisplay,
                '_hppRaw': r._hppRaw,
                '_dateKey': r._dateKey || '',
                '_timestamp': r._timestamp || 0,
                'PENCAIRAN': r.pencairanDisplay,
                'LABA': r.profitDisplay,
                'AFFILIASI': r.totalAffiliateCommission.toString(),
                'KET AFFILIASI': r.ketAffiliasi,
                'PEMBAYARAN CS': formatRupiah(r.totalCustomerPayment),
                'METODE': r.metode,
                'ALAMAT': r.alamat,
                'TERKIRIM': r.terkirim,
                'Menanggung Ongkir': r.menanggungOngkir,
                'Alasan Cancel': r.paketGagalKirim,
                'Waktu Pengembalian': r.waktuPengembalian,
                'Resi': r.resi,
                'Verifikasi Paket': verifikasiObj,
                'Kerugian': r.kerugian,
                '_searchStr': `${r.orderId} ${r.alamat} ${r.resi} ${r.statusOrder} ${r.metode} ${r.paketGagalKirim} ${r.hppDisplay} ${r.pencairanDisplay} ${r.profitDisplay}`.toLowerCase(),
            };
        }

        setComputed(dataFingerprint + '::table', rows);
        return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangkumanData, dataFingerprint, verifikasiObjMap]);

    const effectiveLoading = isLoading && effectiveTableData.length === 0;
    const [columnFilters, setColumnFilters] = useState({});
    const [filterPopupOpen, setFilterPopupOpen] = useState(null);
    const filterPopupRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showDateRangePicker, setShowDateRangePicker] = useState(false);
    const datePickerRef = useRef(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [qrPopupResi, setQrPopupResi] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [copiedField, setCopiedField] = useState(null);
    const [showPdfMenu, setShowPdfMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [pdfChecked, setPdfChecked] = useState({ retur: false, gagal_kirim: false, cancel: false });
    const pdfMenuRef = useRef(null);
    const filterMenuRef = useRef(null);

    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    useEffect(() => {
        function handleResize() { setWindowWidth(window.innerWidth); }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth < 768;

    useEffect(() => {
        function handleClickOutside(event) {
            if (filterPopupRef.current && !filterPopupRef.current.contains(event.target)) setFilterPopupOpen(null);
        }
        if (filterPopupOpen !== null) document.addEventListener('mousedown', handleClickOutside);
        else document.removeEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterPopupOpen]);

    // Close PDF menu on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (pdfMenuRef.current && !pdfMenuRef.current.contains(event.target)) setShowPdfMenu(false);
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) setShowFilterMenu(false);
        }
        if (showPdfMenu || showFilterMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPdfMenu, showFilterMenu]);

    // ── PDF Download Handler ──
    const handleDownloadVerifikasiPdf = (mode) => {
        const getVerifikasiText = (row) => {
            const v = row['Verifikasi Paket'];
            if (typeof v === 'object' && v !== null && 'text' in v) return v.text;
            return v || '-';
        };

        // Data sudah difilter oleh filteredTableData (termasuk filter status)
        let pdfData = [...filteredTableData];

        // Mode filters
        if (mode === 'belum') {
            pdfData = pdfData.filter(row => getVerifikasiText(row) === 'Belum Diterima');
        }

        const hasCustomFilter = pdfChecked.retur || pdfChecked.gagal_kirim || pdfChecked.cancel;

        let filterTitle = 'Filter: Semua';
        let fileName = 'Verifikasi_Paket.pdf';
        if (mode === 'belum') {
            filterTitle = 'Filter: Belum Diterima';
            fileName = 'Verifikasi_Paket_Belum_Diterima.pdf';
        }

        if (hasCustomFilter) {
            const arr = [];
            if (pdfChecked.retur) arr.push('Retur');
            if (pdfChecked.gagal_kirim) arr.push('Gagal Kirim');
            if (pdfChecked.cancel) arr.push('Cancel');
            filterTitle += ' (' + arr.join(', ') + ')';
            const suffix = arr.join('_').replace(/\s+/g, '_');
            fileName = mode === 'belum' ? `Verifikasi_Paket_Belum_Diterima_${suffix}.pdf` : `Verifikasi_Paket_Semua_${suffix}.pdf`;
        }

        // Sort by 'WAKTU PESANAN DIBUAT' descending (newest first)
        pdfData.sort((a, b) => {
            const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const parseDate = (val) => {
                if (!val) return 0;
                const parts = val.toString().split(' ');
                if (parts.length >= 4) {
                    const d = parseInt(parts[1], 10);
                    const mName = parts[2];
                    const y = parseInt(parts[3], 10);
                    const hm = (parts[4] || '00:00').split(':');
                    const mIdx = monthsIndo.indexOf(mName);
                    if (!isNaN(d) && !isNaN(y) && mIdx >= 0) {
                        return new Date(y, mIdx, d, parseInt(hm[0] || 0), parseInt(hm[1] || 0)).getTime();
                    }
                }
                return 0;
            };
            return parseDate(b['WAKTU PESANAN DIBUAT']) - parseDate(a['WAKTU PESANAN DIBUAT']);
        });

        if (!pdfData || pdfData.length === 0) return;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        // ── Header banner ──
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, pageWidth, 32, 'F');
        doc.setFillColor(99, 45, 200);
        doc.rect(0, 0, pageWidth, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('LAPORAN VERIFIKASI PAKET', pageWidth / 2, 12, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(filterTitle, pageWidth / 2, 18, { align: 'center' });
        const formatIndoDateStr = (dateStr) => {
            if (!dateStr || typeof dateStr !== 'string') return dateStr;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return dateStr;
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1;
            const d = parts[2];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            if (isNaN(m) || m < 0 || m > 11) return dateStr;
            return `${d} ${months[m]} ${y}`;
        };
        const periodeText = filterStartDate && filterEndDate ? `Periode: ${formatIndoDateStr(filterStartDate)} - ${formatIndoDateStr(filterEndDate)}` : 'Periode: Semua Waktu';
        doc.text(periodeText, pageWidth / 2, 23, { align: 'center' });
        doc.text(`Dicetak: ${dateStr}, ${timeStr} WIB`, pageWidth / 2, 28, { align: 'center' });

        // ── Summary stats ──
        const totalRows = pdfData.length;
        const cancelCount = pdfData.filter(r => ['canceled', 'cancelled'].includes((r['STATUS ORDER'] || '').toLowerCase())).length;
        const returnCount = pdfData.filter(r => (r['STATUS ORDER'] || '').toLowerCase() === 'return').length;
        const diterimaCount = pdfData.filter(r => { const t = getVerifikasiText(r); return t === 'Diterima' || t === '✓'; }).length;
        const belumCount = pdfData.filter(r => getVerifikasiText(r) === 'Belum Diterima').length;

        const gagalKirimCount = pdfData.filter(r => (r['STATUS ORDER'] || '').toLowerCase() === 'gagal kirim').length;

        const totalKerugian = pdfData.reduce((sum, r) => sum + (getVerifikasiText(r) === 'Belum Diterima' ? (r['_hppRaw'] || 0) : 0), 0);

        const statY = 38;
        // Dynamic stat count: hide DITERIMA when mode is 'belum'
        const statItems = [
            { label: 'TOTAL', value: totalRows, bg: [245, 243, 255], border: [124, 58, 237], text: [124, 58, 237] },
            { label: 'CANCEL', value: cancelCount, bg: [254, 226, 226], border: [239, 68, 68], text: [239, 68, 68] },
            { label: 'RETURN', value: returnCount, bg: [254, 243, 199], border: [245, 158, 11], text: [245, 158, 11] },
            { label: 'GAGAL KIRIM', value: gagalKirimCount, bg: [254, 237, 213], border: [251, 146, 60], text: [251, 146, 60] },
        ];
        if (mode !== 'belum') {
            statItems.push({ label: 'DITERIMA', value: diterimaCount, bg: [236, 253, 245], border: [16, 185, 129], text: [16, 185, 129] });
        }
        statItems.push({ label: 'BELUM DITERIMA', value: belumCount, bg: [254, 243, 199], border: [245, 158, 11], text: [245, 158, 11] });
        // Kerugian stat (always show)
        statItems.push({ label: 'KERUGIAN', value: totalKerugian > 0 ? formatRupiah(totalKerugian) : '-', bg: [254, 226, 226], border: [239, 68, 68], text: [239, 68, 68], smallFont: totalKerugian > 0 });

        const statBoxW = (pageWidth - 28 - (statItems.length - 1) * 6) / statItems.length;
        const gap = 6;
        statItems.forEach((s, i) => {
            const x = 14 + (statBoxW + gap) * i;
            doc.setFillColor(...s.bg);
            doc.roundedRect(x, statY, statBoxW, 16, 2, 2, 'F');
            doc.setDrawColor(...s.border);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, statY, statBoxW, 16, 2, 2, 'S');
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(6.5);
            doc.setFont(undefined, 'normal');
            doc.text(s.label, x + statBoxW / 2, statY + 5, { align: 'center' });
            doc.setTextColor(...s.text);
            doc.setFontSize(s.smallFont ? 8 : 11);
            doc.setFont(undefined, 'bold');
            doc.text(String(s.value), x + statBoxW / 2, statY + 12, { align: 'center' });
        });

        // ── Catatan / Keterangan Status ──
        const noteY = 59.5;
        const notes = [
            { label: 'Cancel', desc: 'Dibatalkan oleh customer setelah cetak resi', bg: [254, 226, 226], border: [239, 68, 68], labelColor: [220, 38, 38] },
            { label: 'Gagal Kirim', desc: 'Paket dikembalikan ke seller', bg: [254, 237, 213], border: [251, 146, 60], labelColor: [234, 88, 12] },
            { label: 'Return', desc: 'Direfund via aplikasi', bg: [254, 243, 199], border: [245, 158, 11], labelColor: [180, 83, 9] },
        ];
        let noteX = 14;
        notes.forEach((n) => {
            const labelW = doc.getTextWidth(n.label) + 3;
            const descW = doc.getTextWidth(n.desc);
            const pillW = labelW + descW + 5;
            // Rounded pill background
            doc.setFillColor(...n.bg);
            doc.setDrawColor(...n.border);
            doc.setLineWidth(0.2);
            doc.roundedRect(noteX, noteY - 3.5, pillW, 5, 1.5, 1.5, 'FD');
            // Bold label
            doc.setFont(undefined, 'bold');
            doc.setFontSize(5.5);
            doc.setTextColor(...n.labelColor);
            doc.text(n.label, noteX + 2, noteY - 0.5);
            // Description
            doc.setFont(undefined, 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(n.desc, noteX + labelW + 1.5, noteY - 0.5);
            noteX += pillW + 3;
        });

        // ── Table ──
        const pdfColumns = [
            { key: '_no', label: 'No' },
            { key: 'Resi', label: 'Resi' },
            { key: 'STATUS ORDER', label: 'Status Paket' },
            { key: '_verifikasi', label: 'Keterangan' },
            { key: 'WAKTU PESANAN DIBUAT', label: 'Tgl Pemesanan' },
            { key: '_tgl_kembali', label: 'Tgl Kembali' },
            { key: 'ALAMAT', label: 'Alamat' },
            { key: 'ORDER ID', label: 'Order ID' },
            { key: '_resi_retur', label: 'Resi Retur' },
            { key: 'Kerugian', label: 'Kerugian' },
        ];
        const head = [pdfColumns.map(c => c.label)];
        const body = pdfData.map((row, idx) => pdfColumns.map(c => {
            if (c.key === '_no') return String(idx + 1);
            if (c.key === '_verifikasi') return getVerifikasiText(row);
            if (c.key === '_tgl_kembali') {
                const status = (row['STATUS ORDER'] || '').toLowerCase();
                if (['canceled', 'cancelled'].includes(status)) return '-';
                if (status === 'gagal kirim') return row['Waktu Pengembalian'] || '-';
                if (status === 'return') return returnTimeByOrderId.get(row['ORDER ID']) || '-';
                return '-';
            }
            if (c.key === '_resi_retur') {
                const status = (row['STATUS ORDER'] || '').toLowerCase();
                if (status === 'return') return returnResiByOrderId.get(row['ORDER ID']) || '-';
                return '-';
            }
            return row[c.key] || '-';
        }));

        autoTable(doc, {
            head,
            body,
            startY: 65,
            theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1.5, lineColor: [220, 220, 230], lineWidth: 0.2, textColor: [50, 50, 50], overflow: 'ellipsize' },
            headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center', cellPadding: 2 },
            alternateRowStyles: { fillColor: [250, 248, 255] },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center', fontStyle: 'bold', textColor: [150, 150, 150] },
                1: { cellWidth: 28, fontStyle: 'bold' },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 24, halign: 'center' },
                4: { cellWidth: 30 },
                5: { cellWidth: 30 },
                6: { cellWidth: 'auto' },
                7: { cellWidth: 36 },
                8: { cellWidth: 28 },
                9: { cellWidth: 22, halign: 'right' },
            },
            didParseCell: function (hookData) {
                if (hookData.section === 'body' && hookData.column.index === 2) {
                    const val = (hookData.cell.raw || '').toString().toLowerCase();
                    if (['canceled', 'cancelled'].includes(val)) { hookData.cell.styles.textColor = [239, 68, 68]; hookData.cell.styles.fontStyle = 'bold'; }
                    else if (val === 'return') { hookData.cell.styles.textColor = [245, 158, 11]; hookData.cell.styles.fontStyle = 'bold'; }
                    else if (val === 'gagal kirim') { hookData.cell.styles.textColor = [251, 146, 60]; hookData.cell.styles.fontStyle = 'bold'; }
                }
                if (hookData.section === 'body' && hookData.column.index === 3) {
                    const val = hookData.cell.raw;
                    if (val === 'Diterima' || val === '✓') { hookData.cell.styles.textColor = [16, 185, 129]; hookData.cell.styles.fontStyle = 'bold'; }
                    else if (val === 'Belum Diterima') { hookData.cell.styles.textColor = [245, 158, 11]; hookData.cell.styles.fontStyle = 'bold'; }
                }
                // Kerugian column (index 9) — red for values with Rp
                if (hookData.section === 'body' && hookData.column.index === 9) {
                    const val = (hookData.cell.raw || '').toString();
                    if (val.startsWith('Rp')) { hookData.cell.styles.textColor = [239, 68, 68]; hookData.cell.styles.fontStyle = 'bold'; }
                }
            },
            margin: { left: 10, right: 10 },
        });

        // ── Footer ──
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageH = doc.internal.pageSize.getHeight();
            doc.setFillColor(248, 248, 252);
            doc.rect(0, pageH - 10, pageWidth, 10, 'F');
            doc.setDrawColor(220, 220, 230);
            doc.line(0, pageH - 10, pageWidth, pageH - 10);
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.setFont(undefined, 'normal');
            doc.text('Marketplace Report — Verifikasi Paket', 10, pageH - 4);
            doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 10, pageH - 4, { align: 'right' });
        }

        doc.save(fileName);
    };

    // Lazy-computed unique values per column (only computed when filterPopupOpen is set for that column)
    const uniqueColCacheRef = useRef({ dataRef: null, cols: {} });
    function getUniqueValuesForColumn(col) {
        if (!col) return [];
        if (uniqueColCacheRef.current.dataRef !== effectiveTableData) {
            uniqueColCacheRef.current = { dataRef: effectiveTableData, cols: {} };
        }
        if (uniqueColCacheRef.current.cols[col]) {
            return uniqueColCacheRef.current.cols[col];
        }
        const monthsIndo = new Set(['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']);
        const isDateCol = col === 'WAKTU PESANAN DIBUAT' || col === 'WAKTU PENGIRIMAN' || col === 'Waktu Pengembalian';
        const valuesSet = new Set();
        for (let i = 0; i < effectiveTableData.length; i++) {
            const row = effectiveTableData[i];
            let val = row[col];
            if (val !== undefined && val !== null) {
                if (col === 'Verifikasi Paket') {
                    val = (typeof val === 'object' && val !== null && 'text' in val) ? val.text : (typeof val === 'string' ? val : '');
                } else {
                    val = val.toString();
                }
                if (isDateCol) {
                    const parts = val.split(' ');
                    if (parts.length >= 3 && monthsIndo.has(parts[2])) {
                        valuesSet.add(parts[2]);
                        continue;
                    }
                }
                valuesSet.add(val);
            }
        }
        const arr = Array.from(valuesSet).sort();
        uniqueColCacheRef.current.cols[col] = arr;
        return arr;
    }

    function toggleFilterValue(col, val) {
        setColumnFilters(prev => {
            const prevSet = prev[col] ? new Set(prev[col]) : new Set();
            if (prevSet.has(val)) prevSet.delete(val); else prevSet.add(val);
            return { ...prev, [col]: prevSet.size > 0 ? prevSet : undefined };
        });
        setCurrentPage(1);
    }

    function clearFilterForColumn(col) {
        setColumnFilters(prev => { const newFilters = { ...prev }; delete newFilters[col]; return newFilters; });
        setCurrentPage(1);
    }

    const filteredTableData = useMemo(() => {
        const hasDateFilter = Boolean(filterStartDate || filterEndDate);
        const q = deferredSearchQuery.trim().toLowerCase();
        const hasCustomFilter = pdfChecked.retur || pdfChecked.gagal_kirim || pdfChecked.cancel;
        const activeColFilters = Object.entries(columnFilters).filter(([, s]) => s && s.size > 0);
        const monthsIndoSet = new Set(['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']);

        if (!hasDateFilter && !q && !hasCustomFilter && activeColFilters.length === 0) {
            return effectiveTableData;
        }

        return effectiveTableData.filter(row => {
            // Fast date range filter using pre-computed _dateKey
            if (hasDateFilter) {
                const dateKey = row._dateKey;
                if (!dateKey) return false;
                if (filterStartDate && dateKey < filterStartDate) return false;
                if (filterEndDate && dateKey > filterEndDate) return false;
            }
            // Fast O(1) search filter using pre-lowercased _searchStr
            if (q && (!row._searchStr || !row._searchStr.includes(q))) {
                return false;
            }
            if (hasCustomFilter) {
                const status = (row['STATUS ORDER'] || '').toLowerCase();
                let matched = false;
                if (pdfChecked.retur && status === 'return') matched = true;
                else if (pdfChecked.gagal_kirim && status === 'gagal kirim') matched = true;
                else if (pdfChecked.cancel && (status === 'canceled' || status === 'cancelled')) matched = true;
                if (!matched) return false;
            }
            for (let i = 0; i < activeColFilters.length; i++) {
                const [col, filterSet] = activeColFilters[i];
                let val = row[col];
                if (col === 'Verifikasi Paket') {
                    val = (typeof val === 'object' && val !== null && 'text' in val) ? val.text : (typeof val === 'string' ? val : '');
                } else {
                    val = val == null ? '' : val.toString();
                }
                if (col === 'WAKTU PESANAN DIBUAT' || col === 'WAKTU PENGIRIMAN' || col === 'Waktu Pengembalian') {
                    const parts = val.split(' ');
                    if (parts.length >= 3 && monthsIndoSet.has(parts[2])) val = parts[2];
                }
                if (!filterSet.has(val)) return false;
            }
            return true;
        });
    }, [effectiveTableData, pdfChecked, columnFilters, filterStartDate, filterEndDate, deferredSearchQuery]);

    const columns = ['ORDER ID', 'WAKTU PESANAN DIBUAT', 'WAKTU PENGIRIMAN', 'QTT', 'STATUS ORDER', 'HPP', 'PENCAIRAN', 'LABA', 'AFFILIASI', 'KET AFFILIASI', 'PEMBAYARAN CS', 'METODE', 'ALAMAT', 'TERKIRIM', 'Menanggung Ongkir', 'Alasan Cancel', 'Waktu Pengembalian', 'Resi', 'Verifikasi Paket', 'Kerugian'];

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    function requestSort(key) {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
        setCurrentPage(1);
    }
    function sortValues(a, b) {
        if (a == null) a = ''; if (b == null) b = '';
        const aNum = parseFloat(a.toString().replace(/[^0-9.-]+/g, "")); const bNum = parseFloat(b.toString().replace(/[^0-9.-]+/g, ""));
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.toString().localeCompare(b.toString());
    }

    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredTableData;
        const key = sortConfig.key;
        const direction = sortConfig.direction;
        if (key === 'WAKTU PESANAN DIBUAT') {
            return [...filteredTableData].sort((a, b) =>
                direction === 'asc' ? (a._timestamp || 0) - (b._timestamp || 0) : (b._timestamp || 0) - (a._timestamp || 0)
            );
        }
        // Pre-compute sort keys once per row instead of inside the comparator
        const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        function parseDateForSort(val) {
            if (!val || typeof val !== 'string') return null;
            const isDateTime = dayNamesIndo.some(day => val.includes(day)) && monthsIndo.some(month => val.includes(month));
            if (isDateTime) {
                const parts = val.split(' ');
                if (parts.length >= 4) {
                    const dayNum = parseInt(parts[1], 10); const monthName = parts[2]; const yearNum = parseInt(parts[3], 10);
                    const hourMinute = parts[4] || '00:00'; const [hour, minute] = hourMinute.split(':').map(x => parseInt(x, 10));
                    const monthIndex = monthsIndo.indexOf(monthName);
                    if (dayNum && monthIndex >= 0 && yearNum && !isNaN(hour) && !isNaN(minute))
                        return new Date(yearNum, monthIndex, dayNum, hour, minute).getTime();
                }
            }
            return null;
        }
        // Pre-compute sort key for each row once
        const keyed = filteredTableData.map(row => {
            let val = row[key];
            if (key === 'Verifikasi Paket') {
                if (typeof val === 'object' && val !== null && 'text' in val) val = val.text;
            }
            const dateTs = parseDateForSort(typeof val === 'string' ? val : null);
            return { row, val: val ?? '', dateTs };
        });
        keyed.sort((a, b) => {
            if (a.dateTs !== null && b.dateTs !== null) {
                return direction === 'asc' ? a.dateTs - b.dateTs : b.dateTs - a.dateTs;
            }
            const cmp = sortValues(a.val, b.val);
            return direction === 'asc' ? cmp : -cmp;
        });
        return keyed.map(k => k.row);
    }, [filteredTableData, sortConfig]);


    function SortIcon({ columnKey }) {
        const size = 12;
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={size} style={{ opacity: 0.3, marginLeft: '4px' }} />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />
            : <ArrowDown size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
    }

    function FilterPopup({ columnKey, values, selectedValues, onToggleValue, onClear, onClose }) {
        return (
            <div ref={filterPopupRef} style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 50,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', padding: '0.75rem', minWidth: '12rem',
                maxHeight: '20rem', boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter: {columnKey}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={14} /></button>
                </div>
                <div style={{ maxHeight: '12rem', overflowY: 'auto' }}>
                    {values.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Tidak ada nilai.</p>
                    ) : (
                        values.map(val => (
                            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                                <input type="checkbox" checked={selectedValues.has(val)} onChange={() => onToggleValue(val)}
                                    style={{ accentColor: 'var(--accent-primary)', width: '0.875rem', height: '0.875rem' }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                            </label>
                        ))
                    )}
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Clear</button>
                    <button type="button" onClick={onClose} className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Close</button>
                </div>
            </div>
        );
    }

    // Status color helper
    function getStatusBadgeStyle(val) {
        if (!val) return {};
        const lower = val.toString().toLowerCase();
        if (['canceled', 'cancelled', 'cancel'].includes(lower)) return { color: '#f87171', fontWeight: 600 };
        if (lower === 'return') return { color: '#fbbf24', fontWeight: 600 };
        if (lower === 'gagal kirim') return { color: '#fb923c', fontWeight: 600 };
        if (lower === 'completed' || lower === 'terkirim') return { color: '#34d399', fontWeight: 600 };
        if (lower === 'proses') return { color: '#60a5fa', fontWeight: 600 };
        return {};
    }

    const isStatusActive = Boolean(pdfChecked.retur || pdfChecked.gagal_kirim || pdfChecked.cancel);
    const statusActiveCount = (pdfChecked.retur ? 1 : 0) + (pdfChecked.gagal_kirim ? 1 : 0) + (pdfChecked.cancel ? 1 : 0);
    const isDateActive = Boolean(filterStartDate || filterEndDate);
    const isSearchActive = Boolean(searchQuery && searchQuery.trim());
    const isColFilterActive = Object.values(columnFilters).some(set => set && set.size > 0);
    const hasAnyFilter = isStatusActive || isDateActive || isSearchActive || isColFilterActive;

    const handleResetAllFilters = () => {
        setSearchQuery('');
        setFilterStartDate('');
        setFilterEndDate('');
        setPdfChecked({ retur: false, gagal_kirim: false, cancel: false });
        setColumnFilters({});
        setCurrentPage(1);
    };

    if (isHidden) {
        return null; // Mounts the component, runs the hooks to save data to cache, but renders nothing to the DOM
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? 'calc(100vh - 8.35rem)' : 'calc(100vh - 1.3rem)',
            overflow: 'hidden',
        }}>
            {/* ── Top Header Toolbar (Separate Card) ── */}
            <div
                style={{
                    flexShrink: 0,
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                    padding: isMobile ? '0.55rem 0.65rem' : '0.55rem 0.85rem',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '0.5rem' : '0.85rem',
                }}
            >
                    {/* Left: Title + Icon + Count Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '0.65rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <div
                                style={{
                                    width: isMobile ? 28 : 32,
                                    height: isMobile ? 28 : 32,
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    flexShrink: 0,
                                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.22)',
                                }}
                            >
                                <Receipt size={isMobile ? 15 : 17} strokeWidth={2.3} />
                            </div>
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: isMobile ? '0.925rem' : '1.025rem',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                Rekap Transaksi
                            </h2>
                        </div>
                        <span
                            style={{
                                fontSize: isMobile ? '0.675rem' : '0.725rem',
                                fontWeight: 600,
                                color: '#475569',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {sortedData.length.toLocaleString('id-ID')} pesanan
                        </span>
                    </div>

                    {/* Right: Search Box + Action Buttons Group (Pepet Kanan) */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                        width: isMobile ? '100%' : 'auto',
                        justifyContent: isMobile ? 'stretch' : 'flex-end',
                    }}>
                        {/* Search Bar (Pepet Kanan) */}
                        <div style={{
                            position: 'relative',
                            width: isMobile ? '100%' : '240px',
                            flexShrink: 0,
                        }}>
                            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: searchQuery ? '#6366f1' : '#94a3b8', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Cari ID, alamat, resi, status..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                style={{
                                    width: '100%',
                                    height: '34px',
                                    padding: '0 1.8rem 0 2.2rem',
                                    borderRadius: '8px',
                                    border: searchQuery ? '1px solid #6366f1' : '1px solid #e2e8f0',
                                    background: searchQuery ? '#f5f3ff' : '#f8fafc',
                                    color: '#0f172a',
                                    fontSize: '0.775rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                                    boxShadow: searchQuery ? '0 0 0 3px rgba(99, 102, 241, 0.1)' : 'none',
                                }}
                                onFocus={e => {
                                    e.target.style.background = '#ffffff';
                                    e.target.style.borderColor = '#6366f1';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={e => {
                                    if (!searchQuery) {
                                        e.target.style.background = '#f8fafc';
                                        e.target.style.borderColor = '#e2e8f0';
                                        e.target.style.boxShadow = 'none';
                                    }
                                }}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                    style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.15rem', display: 'flex' }}
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        {/* Date Range Filter */}
                        <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }} ref={datePickerRef}>
                            <button
                                type="button"
                                onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                                style={{
                                    width: isMobile ? '100%' : 'auto',
                                    height: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    padding: '0 0.75rem',
                                    borderRadius: '8px',
                                    border: isDateActive ? '1px solid #6366f1' : '1px solid #e2e8f0',
                                    background: isDateActive ? '#f5f3ff' : '#ffffff',
                                    color: isDateActive ? '#6366f1' : '#334155',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Calendar size={13} style={{ color: isDateActive ? '#6366f1' : '#64748b' }} />
                                <span>{(filterStartDate && filterEndDate) ? (`${filterStartDate} — ${filterEndDate}`) : 'Tanggal'}</span>
                                {isDateActive && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setFilterStartDate(''); setFilterEndDate(''); setCurrentPage(1); }}
                                        title="Hapus filter tanggal"
                                        style={{ marginLeft: '2px', display: 'inline-flex', color: '#6366f1', padding: '1px' }}
                                    >
                                        <X size={11} />
                                    </span>
                                )}
                            </button>
                            {showDateRangePicker && (
                                <div style={{ position: 'absolute', top: '105%', left: isMobile ? 0 : 'auto', right: isMobile ? 'auto' : 0, zIndex: 120 }}>
                                    <DateRangePicker startDate={filterStartDate} endDate={filterEndDate}
                                        onChange={({ startDate, endDate }) => { setFilterStartDate(startDate); setFilterEndDate(endDate); setCurrentPage(1); }}
                                        onClose={() => setShowDateRangePicker(false)} />
                                </div>
                            )}
                        </div>

                        {/* Status Filter */}
                        <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }} ref={filterMenuRef}>
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                type="button"
                                style={{
                                    width: isMobile ? '100%' : 'auto',
                                    height: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    padding: '0 0.75rem',
                                    borderRadius: '8px',
                                    border: isStatusActive ? '1px solid #6366f1' : '1px solid #e2e8f0',
                                    background: isStatusActive ? '#f5f3ff' : '#ffffff',
                                    color: isStatusActive ? '#6366f1' : '#334155',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <SlidersHorizontal size={13} style={{ color: isStatusActive ? '#6366f1' : '#64748b' }} />
                                <span>Status</span>
                                {isStatusActive && (
                                    <span style={{
                                        background: '#6366f1',
                                        color: '#ffffff',
                                        borderRadius: '9999px',
                                        fontSize: '0.65rem',
                                        padding: '0 5px',
                                        fontWeight: 700,
                                        lineHeight: '14px',
                                    }}>
                                        {statusActiveCount}
                                    </span>
                                )}
                                <ChevronDown size={11} style={{ color: '#94a3b8' }} />
                            </button>
                            {showFilterMenu && (
                                <div style={{
                                    position: 'absolute', top: '105%', left: 0, zIndex: 120,
                                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '175px', padding: '0.5rem 0.7rem',
                                    display: 'flex', flexDirection: 'column', gap: '0.45rem',
                                }}>
                                    <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                        Filter Status Order
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.75rem', color: '#334155', fontWeight: 500 }}>
                                        <input type="checkbox" checked={pdfChecked.retur} onChange={e => setPdfChecked({ ...pdfChecked, retur: e.target.checked })} style={{ accentColor: '#3b82f6', width: '0.9rem', height: '0.9rem' }} />
                                        <span>🔄 Retur</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.75rem', color: '#334155', fontWeight: 500 }}>
                                        <input type="checkbox" checked={pdfChecked.gagal_kirim} onChange={e => setPdfChecked({ ...pdfChecked, gagal_kirim: e.target.checked })} style={{ accentColor: '#f97316', width: '0.9rem', height: '0.9rem' }} />
                                        <span>🚚 Gagal Kirim</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.75rem', color: '#334155', fontWeight: 500 }}>
                                        <input type="checkbox" checked={pdfChecked.cancel} onChange={e => setPdfChecked({ ...pdfChecked, cancel: e.target.checked })} style={{ accentColor: '#ef4444', width: '0.9rem', height: '0.9rem' }} />
                                        <span>❌ Cancel</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Reset All Filters Button (Only when filtered) */}
                        {hasAnyFilter && (
                            <button
                                type="button"
                                onClick={handleResetAllFilters}
                                title="Reset semua filter"
                                style={{
                                    height: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid #fecaca',
                                    background: '#fff1f2',
                                    color: '#e11d48',
                                    fontSize: '0.725rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <RotateCcw size={12} />
                                <span>Reset</span>
                            </button>
                        )}

                        {/* Divider on desktop */}
                        {!isMobile && (
                            <div style={{ height: '20px', width: '1px', background: '#e2e8f0', margin: '0 2px' }} />
                        )}

                        {/* Export Dropdown */}
                        <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }} ref={pdfMenuRef}>
                            <button
                                onClick={() => setShowPdfMenu(!showPdfMenu)}
                                type="button"
                                style={{
                                    width: isMobile ? '100%' : 'auto',
                                    height: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    padding: '0 0.85rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.28)',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <Download size={13} />
                                <span>Export</span>
                                <ChevronDown size={11} style={{ opacity: 0.85 }} />
                            </button>
                            {showPdfMenu && (
                                <div style={{
                                    position: 'absolute', top: '105%', right: 0, zIndex: 120,
                                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '190px',
                                }}>
                                    <button type="button" onClick={() => {
                                        setShowPdfMenu(false);
                                        const rowsToExport = filteredTableData.filter(row => ['Gagal Kirim Paket', 'Paket Ditolak'].includes(row['Alasan Cancel']));
                                        const exportColumns = ['ORDER ID', 'QTT', 'WAKTU PESANAN DIBUAT', 'ALAMAT', 'Alasan Cancel', 'Waktu Pengembalian', 'Resi', 'Verifikasi Paket'];
                                        const worksheetData = rowsToExport.map(row => {
                                            const obj = {};
                                            exportColumns.forEach(col => {
                                                if (col === 'Verifikasi Paket') {
                                                    if (typeof row[col] === 'string') obj[col] = row[col];
                                                    else if (typeof row[col] === 'object' && row[col] !== null && 'text' in row[col]) obj[col] = row[col].text;
                                                    else obj[col] = '';
                                                } else obj[col] = row[col] || '';
                                            });
                                            return obj;
                                        });
                                        const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: exportColumns });
                                        const workbook = XLSX.utils.book_new();
                                        XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Pengembalian');
                                        XLSX.writeFile(workbook, 'Laporan_Pengembalian.xlsx');
                                    }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.55rem 0.85rem',
                                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.735rem', fontWeight: 600,
                                            color: '#10b981', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(16, 185, 129, 0.08)'}
                                        onMouseLeave={e => e.target.style.background = 'none'}>
                                        📊 Excel Laporan
                                    </button>
                                    <div style={{ height: '1px', background: '#f1f3f9' }} />
                                    <button type="button" onClick={() => {
                                        setShowPdfMenu(false);
                                        const exportColumns = columns.map(colLabel);
                                        const worksheetData = sortedData.map(row => {
                                            const obj = {};
                                            columns.forEach(col => {
                                                const outKey = colLabel(col);
                                                if (col === 'Verifikasi Paket') {
                                                    if (typeof row[col] === 'string') obj[outKey] = row[col];
                                                    else if (typeof row[col] === 'object' && row[col] !== null && 'text' in row[col]) obj[outKey] = row[col].text;
                                                    else obj[outKey] = '';
                                                } else obj[outKey] = row[col] || '';
                                            });
                                            return obj;
                                        });
                                        const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: exportColumns });
                                        const workbook = XLSX.utils.book_new();
                                        XLSX.utils.book_append_sheet(workbook, worksheet, 'Semua Data');
                                        XLSX.writeFile(workbook, 'Rekap_Transaksi_All.xlsx');
                                    }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.55rem 0.85rem',
                                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.735rem', fontWeight: 600,
                                            color: '#3b82f6', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.08)'}
                                        onMouseLeave={e => e.target.style.background = 'none'}>
                                        📥 Excel Semua Data
                                    </button>
                                    <div style={{ height: '1px', background: '#f1f3f9' }} />
                                    <button type="button" onClick={() => {
                                        setShowPdfMenu(false);
                                        handleDownloadVerifikasiPdf('semua');
                                    }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.55rem 0.85rem',
                                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.735rem', fontWeight: 600,
                                            color: '#ef4444', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(239, 68, 68, 0.08)'}
                                        onMouseLeave={e => e.target.style.background = 'none'}>
                                        📄 PDF Lengkap
                                    </button>
                                    <div style={{ height: '1px', background: '#f1f3f9' }} />
                                    <button type="button" onClick={() => {
                                        setShowPdfMenu(false);
                                        handleDownloadVerifikasiPdf('diterima');
                                    }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.55rem 0.85rem',
                                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.735rem', fontWeight: 600,
                                            color: '#10b981', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(16, 185, 129, 0.08)'}
                                        onMouseLeave={e => e.target.style.background = 'none'}>
                                        ✅ PDF Diterima
                                    </button>
                                    <div style={{ height: '1px', background: '#f1f3f9' }} />
                                    <button type="button" onClick={() => {
                                        setShowPdfMenu(false);
                                        handleDownloadVerifikasiPdf('belum_diterima');
                                    }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.55rem 0.85rem',
                                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.735rem', fontWeight: 600,
                                            color: '#f59e0b', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(245, 158, 11, 0.08)'}
                                        onMouseLeave={e => e.target.style.background = 'none'}>
                                        ⏳ PDF Belum Diterima
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Table Container (Separate Card Filling All Remaining Space) ── */}
                <div
                    className="modern-table-wrapper"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                        <table className="modern-table compact-table" style={{ width: '100%', minWidth: isMobile ? '700px' : '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '2.5rem', textAlign: 'center' }}>No</th>
                                    {columns.map(col => {
                                        const uniqueValues = filterPopupOpen === col ? getUniqueValuesForColumn(col) : [];
                                        const selectedValues = columnFilters[col] || new Set();
                                        const isFilterActive = selectedValues.size > 0;
                                        const isNum = ['HPP', 'PENCAIRAN', 'LABA', 'AFFILIASI', 'PEMBAYARAN CS', 'Kerugian'].includes(col);
                                        const isCent = ['QTT', 'STATUS ORDER', 'TERKIRIM', 'Verifikasi Paket'].includes(col);
                                        return (
                                            <th key={col} style={{ position: 'relative', textAlign: isNum ? 'right' : isCent ? 'center' : 'left' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', justifyContent: isNum ? 'flex-end' : isCent ? 'center' : 'flex-start' }}>
                                                    <span onClick={() => requestSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>{colLabel(col)}</span>
                                                    <button type="button" onClick={e => { e.stopPropagation(); setFilterPopupOpen(filterPopupOpen === col ? null : col); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isFilterActive ? '#7c3aed' : 'var(--text-tertiary)' }}>
                                                        <Filter size={10} />
                                                    </button>
                                                    <SortIcon columnKey={col} />
                                                </div>
                                                {filterPopupOpen === col && (
                                                    <FilterPopup columnKey={col} values={uniqueValues} selectedValues={selectedValues}
                                                        onToggleValue={val => toggleFilterValue(col, val)}
                                                        onClear={() => clearFilterForColumn(col)}
                                                        onClose={() => setFilterPopupOpen(null)} />
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {effectiveLoading ? (
                                    Array.from({ length: 14 }).map((_, i) => (
                                        <tr key={`skel-${i}`}>
                                            <td style={{ textAlign: 'center' }}><div className="skeleton" style={{ height: '0.85rem', width: '1.25rem', margin: '0 auto' }}>&nbsp;</div></td>
                                            {columns.map(col => (
                                                <td key={col}><div className="skeleton" style={{ height: '0.85rem', width: `${40 + Math.random() * 60}%` }}>&nbsp;</div></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : sortedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                                            Tidak ada data untuk ditampilkan.
                                        </td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const totalPages = Math.ceil(sortedData.length / rowsPerPage);
                                        const safePage = Math.min(currentPage, totalPages || 1);
                                        const startIdx = (safePage - 1) * rowsPerPage;
                                        const pageData = sortedData.slice(startIdx, startIdx + rowsPerPage);
                                        return pageData.map((row, i) => (
                                            <tr key={startIdx + i}>
                                                <td style={{ fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'center', width: '2.5rem' }}>{startIdx + i + 1}</td>
                                                {columns.map(col => {
                                                    const isNum = ['HPP', 'PENCAIRAN', 'LABA', 'AFFILIASI', 'PEMBAYARAN CS', 'Kerugian'].includes(col);
                                                    const isCent = ['QTT', 'STATUS ORDER', 'TERKIRIM', 'Verifikasi Paket'].includes(col);
                                                    const cellAlign = isNum ? 'right' : isCent ? 'center' : 'left';
                                                    const numStyle = isNum ? { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } : {};

                                                    if (col === 'ORDER ID') {
                                                        return (
                                                            <td key={col} title="Klik untuk detail"
                                                                onClick={() => setSelectedRow(row)}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    color: '#7c3aed',
                                                                    fontWeight: 700,
                                                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                                    fontSize: '0.725rem',
                                                                    letterSpacing: '-0.02em',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#7c3aed'}>
                                                                {row[col]}
                                                            </td>
                                                        );
                                                    }
                                                    if (col === 'Verifikasi Paket') {
                                                        if (typeof row[col] === 'string') return <td key={col} title={row[col]} style={{ textAlign: 'center' }}>{row[col]}</td>;
                                                        if (typeof row[col] === 'object' && row[col] !== null && 'jsx' in row[col]) return <td key={col} style={{ textAlign: 'center' }}>{row[col].jsx}</td>;
                                                        return <td key={col} style={{ textAlign: 'center' }}>-</td>;
                                                    }
                                                    if (col && typeof col === 'string' && col.trim().toLowerCase() === 'resi') {
                                                        const resiVal = row['Resi'] || row['RESI'] || row[col];
                                                        if (resiVal && resiVal.toString().trim() !== '-' && resiVal.toString().trim() !== '') {
                                                            return (
                                                                <td key={col} title="Tampilkan QR Code"
                                                                    onClick={(e) => { e.stopPropagation(); setQrPopupResi(resiVal.toString().trim()); }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        color: '#2563eb',
                                                                        fontWeight: 600,
                                                                        fontFamily: 'ui-monospace, monospace',
                                                                        fontSize: '0.725rem',
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
                                                                    onMouseLeave={e => e.currentTarget.style.color = '#2563eb'}>
                                                                    {resiVal}
                                                                </td>
                                                            );
                                                        }
                                                    }
                                                    if (col === 'STATUS ORDER' || col === 'TERKIRIM') {
                                                        return <td key={col} title={row[col]} style={{ textAlign: 'center', ...getStatusBadgeStyle(row[col]) }}>{row[col]}</td>;
                                                    }
                                                    if (col === 'LABA' || col === 'PROFIT') {
                                                        const profitVal = row[col];
                                                        let profitStyle = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
                                                        if (profitVal && profitVal.startsWith && profitVal.startsWith('Rp')) {
                                                            const num = parseFloat(profitVal.replace(/[^0-9.-]+/g, ''));
                                                            if (!isNaN(num)) profitStyle = { ...profitStyle, color: num >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 };
                                                        } else if (profitVal === 'CANCEL') profitStyle = { ...profitStyle, color: '#ef4444', fontWeight: 600 };
                                                        else if (profitVal === 'Return' || profitVal === 'Gagal Kirim') profitStyle = { ...profitStyle, color: '#f59e0b', fontWeight: 600 };
                                                        else if (profitVal === 'Dana Belum Diterima') profitStyle = { ...profitStyle, color: '#60a5fa', fontWeight: 600 };
                                                        return <td key={col} title={row[col]} style={profitStyle}>{row[col]}</td>;
                                                    }
                                                    return <td key={col} title={row[col]} style={{ textAlign: cellAlign, ...numStyle }}>{row[col]}</td>;
                                                })}
                                            </tr>
                                        ));
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                {/* ── Compact Pagination Integrated Footer ── */}
                {(() => {
                    const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
                    const safePage = Math.min(currentPage, totalPages);
                    const startIdx = (safePage - 1) * rowsPerPage;
                    const endIdx = Math.min(startIdx + rowsPerPage, sortedData.length);
                    const maxButtons = isMobile ? 3 : 7;
                    let startPage = Math.max(1, safePage - Math.floor(maxButtons / 2));
                    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                    if (endPage - startPage + 1 < maxButtons) startPage = Math.max(1, endPage - maxButtons + 1);
                    const pageButtons = [];
                    for (let p = startPage; p <= endPage; p++) pageButtons.push(p);

                    return (
                        <div style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.4rem',
                            padding: isMobile ? '0.35rem 0.6rem' : '0.4rem 0.85rem',
                            background: '#fcfdfe',
                            borderTop: '1px solid #eef0f6',
                            fontSize: isMobile ? '0.7rem' : '0.75rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Tampilkan</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    style={{
                                        padding: '2px 5px',
                                        height: '25px',
                                        fontSize: '0.735rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0',
                                        background: '#ffffff',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span style={{ color: 'var(--text-tertiary)' }}>
                                    | {sortedData.length > 0 ? `${startIdx + 1}–${endIdx}` : '0'} dari <strong style={{ color: 'var(--text-primary)' }}>{sortedData.length.toLocaleString('id-ID')}</strong>
                                </span>
                            </div>

                            {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}
                                        style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}>
                                        «
                                    </button>
                                    <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}>
                                        ‹
                                    </button>
                                    {pageButtons.map(p => (
                                        <button key={p} type="button" onClick={() => setCurrentPage(p)}
                                            style={{
                                                height: 25, minWidth: 25, padding: '0 5px', fontSize: '0.725rem', fontWeight: 700,
                                                borderRadius: '5px',
                                                border: p === safePage ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                                                background: p === safePage ? '#7c3aed' : '#ffffff',
                                                color: p === safePage ? '#ffffff' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                            }}>
                                            {p}
                                        </button>
                                    ))}
                                    <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}>
                                        ›
                                    </button>
                                    <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}
                                        style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}>
                                        »
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* QR Code Popup */}
            {qrPopupResi && (
                <div onClick={() => setQrPopupResi(null)} style={{
                    position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', animation: 'fadeInUp 0.2s ease',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)',
                        boxShadow: 'var(--shadow-xl)', maxWidth: '400px', width: '95%', textAlign: 'center', overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-medium)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-glass)'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', fontWeight: 700, marginBottom: '0.125rem', textAlign: 'left' }}>QR Code Resi</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{qrPopupResi}</div>
                            </div>
                            <button onClick={() => setQrPopupResi(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0.25rem', display: 'flex' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '2rem' }}>
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPopupResi)}`} alt={`QR Code ${qrPopupResi}`} style={{ width: '100%', maxWidth: '250px', height: 'auto', background: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '3px solid #818cf8' }} />
                            <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Scan QR code ini untuk melakukan cek via scan.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Row Detail Popup Modal */}
            {selectedRow && (() => {
                const orderId = selectedRow['ORDER ID'];
                const products = ordersGroupedById.get(orderId) || [];
                const detailColumns = columns.filter(c => c !== 'Verifikasi Paket');
                return (
                    <div onClick={() => setSelectedRow(null)} style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
                        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
                    }}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '720px', maxHeight: '85vh', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            {/* Header */}
                            {(() => {
                                const terkirim = (selectedRow['TERKIRIM'] || '').toLowerCase();
                                const status = (selectedRow['STATUS ORDER'] || '').toLowerCase();
                                let headerBg = 'transparent';
                                let headerBorder = '1px solid var(--border-subtle)';
                                if (['cancel', 'canceled', 'cancelled', 'return', 'gagal kirim'].some(s => terkirim.includes(s) || status.includes(s))) {
                                    headerBg = 'rgba(248, 113, 113, 0.15)'; headerBorder = '1px solid rgba(248, 113, 113, 0.3)';
                                } else if (['unpaid', 'belum dibayar'].some(s => status.includes(s))) {
                                    headerBg = 'rgba(251, 191, 36, 0.15)'; headerBorder = '1px solid rgba(251, 191, 36, 0.3)';
                                } else if (terkirim === 'terkirim' || status === 'completed') {
                                    headerBg = 'rgba(52, 211, 153, 0.15)'; headerBorder = '1px solid rgba(52, 211, 153, 0.3)';
                                }
                                const resiVal = selectedRow['Resi'] || '-';
                                const handleCopy = (text, field) => {
                                    if (!text || text === '-') return;
                                    navigator.clipboard.writeText(text);
                                    setCopiedField(field);
                                    setTimeout(() => setCopiedField(null), 1500);
                                };
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: headerBorder, background: headerBg }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Detail Order</h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                <span onClick={() => handleCopy(orderId, 'orderId')}
                                                    style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                    title="Copy Order ID">
                                                    {orderId}
                                                    {copiedField === 'orderId' ? <Check size={12} style={{ color: '#34d399' }} /> : <Copy size={12} style={{ opacity: 0.5 }} />}
                                                </span>
                                                {resiVal && resiVal !== '-' && (
                                                    <span onClick={() => handleCopy(resiVal, 'resi')}
                                                        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                        title="Copy Resi">
                                                        Resi: {resiVal}
                                                        {copiedField === 'resi' ? <Check size={12} style={{ color: '#34d399' }} /> : <Copy size={12} style={{ opacity: 0.5 }} />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setSelectedRow(null)} style={{
                                            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                                            padding: '0.375rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex',
                                        }}><X size={16} /></button>
                                    </div>
                                );
                            })()}
                            {/* Body */}
                            <div style={{ overflow: 'auto', padding: '1.25rem', flex: 1 }}>
                                {/* Products Table */}
                                {products.length > 0 && (
                                    <div>
                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Produk ({products.length} item)
                                        </h4>
                                        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                            <table className="modern-table" style={{ fontSize: '0.75rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>No</th>
                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem', textAlign: 'left' }}>Product Name</th>
                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>Seller SKU</th>
                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>Variation</th>
                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>Qty</th>
                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>HPP/pcs</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {products.map((p, idx) => {
                                                        const sellerSku = p['Seller SKU'] || p['seller_sku'] || '';
                                                        const skuId = (p['SKU ID'] || p['sku_id'] || '').toString().trim();
                                                        const variation = (p['Variation'] || p['variation'] || '').toString().trim();
                                                        const productName = p['Product Name'] || p['product_name'] || '';
                                                        const qty = p['Quantity'] || p['quantity'] || 0;
                                                        // Get modal for this product
                                                        let modalDisplay = '-';
                                                        if (modalValues) {
                                                            const variationKey = sellerSku ? sellerSku + '||' + skuId + '||' + variation : '';
                                                            let modalVal = null;
                                                            if (variationKey && modalValues[variationKey]) modalVal = modalValues[variationKey];
                                                            else if (sellerSku && modalValues[sellerSku]) modalVal = modalValues[sellerSku];
                                                            else if (!sellerSku && productName) {
                                                                const noSkuKey = '__NSKU__' + productName.trim();
                                                                const noSkuVarKey = noSkuKey + '||' + skuId + '||' + variation;
                                                                if (modalValues[noSkuVarKey]) modalVal = modalValues[noSkuVarKey];
                                                                else if (modalValues[noSkuKey]) modalVal = modalValues[noSkuKey];
                                                            }
                                                            if (modalVal) modalDisplay = formatRupiah(parseInt(modalVal.toString().replace(/[^0-9]/g, ''), 10));
                                                        }
                                                        return (
                                                            <tr key={idx}>
                                                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                                                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'left', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productName}>{productName}</td>
                                                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center' }}>{sellerSku || '-'}</td>
                                                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center' }}>{variation || '-'}</td>
                                                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                                                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center', fontWeight: 600, color: modalDisplay === '-' ? 'var(--text-tertiary)' : '#a78bfa' }}>{modalDisplay}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {/* Order Info Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.625rem', marginTop: '1.25rem' }}>
                                    {detailColumns.map(col => {
                                        let val = selectedRow[col];
                                        if (typeof val === 'object' && val !== null && 'text' in val) val = val.text;
                                        const isResi = col && typeof col === 'string' && col.trim().toLowerCase() === 'resi';

                                        return (
                                            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.5rem 0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{colLabel(col)}</span>
                                                {isResi && val && val.toString().trim() !== '-' && val.toString().trim() !== '' ? (
                                                    <span onClick={(e) => { e.stopPropagation(); setQrPopupResi(val.toString().trim()); }}
                                                        title="Tampilkan QR Code"
                                                        style={{ cursor: 'pointer', color: '#818cf8', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(129,140,248,0.3)', wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = '#c4b5fd'}
                                                        onMouseLeave={e => e.currentTarget.style.color = '#818cf8'}>
                                                        {val}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>{val || '-'}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {selectedRow['Verifikasi Paket'] && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.5rem 0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Verifikasi Paket</span>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                {typeof selectedRow['Verifikasi Paket'] === 'object' ? selectedRow['Verifikasi Paket'].jsx : selectedRow['Verifikasi Paket']}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

function DateRangePicker({ startDate, endDate, onChange, onClose }) {
    const toLocalDateStr = (d) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const [selectingStart, setSelectingStart] = useState(true);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [internalStartDate, setInternalStartDate] = useState(startDate ? new Date(startDate) : null);
    const [internalEndDate, setInternalEndDate] = useState(endDate ? new Date(endDate) : null);
    const [selectedMonth, setSelectedMonth] = useState('');

    function updateInputValue() {
        if (internalStartDate && internalEndDate) onChange({ startDate: toLocalDateStr(internalStartDate), endDate: toLocalDateStr(internalEndDate) });
        else if (internalStartDate) onChange({ startDate: toLocalDateStr(internalStartDate), endDate: '' });
        else onChange({ startDate: '', endDate: '' });
    }
    function onDateClick(date) {
        if (selectingStart) { setInternalStartDate(date); setInternalEndDate(null); setSelectingStart(false); }
        else {
            if (date < internalStartDate) { setInternalEndDate(internalStartDate); setInternalStartDate(date); }
            else setInternalEndDate(date);
            setSelectingStart(true); updateInputValue();
        }
    }
    function generateCalendarDays(monthDate) {
        const year = monthDate.getFullYear(); const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
        const startWeekday = firstDay.getDay(); const days = [];
        for (let i = 0; i < startWeekday; i++) days.push(null);
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
        return days;
    }
    const isInRange = (date) => {
        if (!internalStartDate) return false;
        if (internalStartDate && !internalEndDate) return date.getTime() === internalStartDate.getTime();
        if (internalStartDate && internalEndDate) return date >= internalStartDate && date <= internalEndDate;
        return false;
    };
    const isStartDate = (date) => internalStartDate && date.getTime() === internalStartDate.getTime();
    const isEndDate = (date) => internalEndDate && date.getTime() === internalEndDate.getTime();
    const prevMonth = () => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const nextMonth = () => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    const formatMonthYear = (date) => {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };
    const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const calendarDays = generateCalendarDays(calendarMonth);
    const clearSelection = () => { setInternalStartDate(null); setInternalEndDate(null); setSelectingStart(true); onChange({ startDate: '', endDate: '' }); setSelectedMonth(''); };
    const applySelection = () => { updateInputValue(); if (onClose) onClose(); };
    const handleLast7Days = () => {
        const today = new Date(); const start = new Date(); start.setDate(today.getDate() - 6);
        setInternalStartDate(start); setInternalEndDate(today); setSelectingStart(true); setSelectedMonth('');
        onChange({ startDate: toLocalDateStr(start), endDate: toLocalDateStr(today) });
    };
    const handleThisMonth = () => {
        const today = new Date(); const y = today.getFullYear(); const m = today.getMonth();
        const start = new Date(y, m, 1); const end = new Date(y, m + 1, 0);
        setInternalStartDate(start); setInternalEndDate(end); setSelectingStart(true);
        setSelectedMonth(`${y}-${(m + 1).toString().padStart(2, '0')}`);
        onChange({ startDate: toLocalDateStr(start), endDate: toLocalDateStr(end) });
    };
    const handleMonthChange = (e) => {
        const val = e.target.value; setSelectedMonth(val);
        if (!val) { setInternalStartDate(null); setInternalEndDate(null); setSelectingStart(true); onChange({ startDate: '', endDate: '' }); return; }
        const [y, m] = val.split('-').map(Number);
        const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0);
        setInternalStartDate(start); setInternalEndDate(end); setSelectingStart(true);
        onChange({ startDate: toLocalDateStr(start), endDate: toLocalDateStr(end) });
        setCalendarMonth(new Date(y, m - 1, 1));
    };
    const monthOptions = useMemo(() => {
        const options = []; const today = new Date();
        for (let i = 0; i < 12; i++) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); options.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`); }
        return options;
    }, []);
    const formatMonthYearOption = (monthStr) => {
        if (!monthStr) return '';
        const [y, m] = monthStr.split('-');
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${months[parseInt(m, 10) - 1]} ${y}`;
    };

    const calendarStyle = {
        width: '20rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)', padding: '1rem', boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
    };
    const quickBtnStyle = {
        background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
        fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0', transition: 'color var(--transition-fast)',
    };

    return (
        <div style={calendarStyle}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={handleLast7Days} style={quickBtnStyle}
                    onMouseOver={e => e.target.style.color = '#a78bfa'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>
                    7 Hari Terakhir
                </button>
                <div style={{ height: '1rem', borderLeft: '1px solid var(--border-subtle)' }} />
                <button type="button" onClick={handleThisMonth} style={quickBtnStyle}
                    onMouseOver={e => e.target.style.color = '#a78bfa'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>
                    Bulan Ini
                </button>
                <div style={{ height: '1rem', borderLeft: '1px solid var(--border-subtle)' }} />
                <select value={selectedMonth} onChange={handleMonthChange} style={{
                    background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600,
                    border: 'none', outline: 'none', cursor: 'pointer',
                }}>
                    <option value="">Pilih Bulan</option>
                    {monthOptions.map(m => <option key={m} value={m}>{formatMonthYearOption(m)}</option>)}
                </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <button type="button" onClick={prevMonth} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '0.25rem',
                    borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)',
                }}><ChevronLeft size={18} /></button>
                <div style={{ fontWeight: 700, color: '#a78bfa', userSelect: 'none' }}>{formatMonthYear(calendarMonth)}</div>
                <button type="button" onClick={nextMonth} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '0.25rem',
                    borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)',
                }}><ChevronRight size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.125rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#a78bfa', marginBottom: '0.25rem', userSelect: 'none' }}>
                {weekdays.map(wd => <div key={wd}>{wd}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.125rem' }}>
                {calendarDays.map((date, idx) => {
                    if (!date) return <div key={'empty-' + idx} style={{ height: '2rem' }} />;
                    const isSelected = isInRange(date);
                    const isStart = isStartDate(date);
                    const isEnd = isEndDate(date);
                    const today = new Date();
                    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                    let bg = 'transparent'; let color = 'var(--text-primary)'; let fontWeight = 400; let borderRadius = '50%';
                    if (isSelected) {
                        if (isStart && isEnd) { bg = '#7c3aed'; color = '#fff'; fontWeight = 700; }
                        else if (isStart) { bg = '#7c3aed'; color = '#fff'; fontWeight = 700; borderRadius = '50% 0 0 50%'; }
                        else if (isEnd) { bg = '#7c3aed'; color = '#fff'; fontWeight = 700; borderRadius = '0 50% 50% 0'; }
                        else { bg = 'rgba(124, 58, 237, 0.3)'; color = '#e9d5ff'; }
                    } else if (isToday) { bg = 'transparent'; color = '#a78bfa'; fontWeight = 700; }
                    return (
                        <button key={date.toISOString()} type="button" onClick={() => onDateClick(date)}
                            style={{
                                height: '2rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8125rem', cursor: 'pointer', border: isToday && !isSelected ? '1px solid #a78bfa' : 'none',
                                background: bg, color, fontWeight, borderRadius, transition: 'background var(--transition-fast)',
                                userSelect: 'none',
                            }}
                            onMouseOver={e => { if (!isSelected) e.target.style.background = 'rgba(124, 58, 237, 0.15)'; }}
                            onMouseOut={e => { if (!isSelected) e.target.style.background = bg; }}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={clearSelection} className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem' }}>Bersihkan</button>
                <button type="button" onClick={applySelection} className="btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem' }}>Terapkan</button>
            </div>
        </div>
    );
}

