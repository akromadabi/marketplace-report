import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Search, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle, XCircle, Calendar, Download, ChevronLeft, ChevronRight, X, Copy, Check, Package, MapPin, Truck, AlertCircle, FileText } from 'lucide-react';
import { useApiData, useModalValues } from '../hooks/useApiData';

function ReturnTable() {
    const { data: returnData, loading } = useApiData('returns');
    const { data: pengembalianData } = useApiData('pengembalian');
    const { data: ordersData } = useApiData('orders');
    const { modalValues } = useModalValues();
    const [scanData, setScanData] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showDateRangePicker, setShowDateRangePicker] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);
    const datePickerRef = useRef(null);
    const [selectedRow, setSelectedRow] = useState(null);

    // ─── Tracking state ──────────────────────────────────────────────
    const [trackingPopup, setTrackingPopup] = useState(null);   // { awb, provider }
    const [trackingData, setTrackingData] = useState(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState(null);

    const fetchTracking = useCallback(async (awb, provider) => {
        setTrackingPopup({ awb, provider });
        setTrackingData(null);
        setTrackingError(null);
        setTrackingLoading(true);
        try {
            const params = new URLSearchParams({ awb });
            if (provider) params.set('provider', provider);
            const res = await fetch(`/api/tracking?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal melacak resi');
            setTrackingData(json.data || json);
        } catch (err) {
            setTrackingError(err.message || 'Gagal menghubungi layanan tracking');
        }
        setTrackingLoading(false);
    }, []);

    // ─── Fetch scanned resi data ────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/scan', { headers: { 'Accept': 'application/json' } });
                if (res.ok) {
                    const ct = res.headers.get('content-type');
                    if (ct && ct.includes('application/json')) setScanData(await res.json());
                }
            } catch (_) { /* ignore */ }
        })();
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) setShowDateRangePicker(false);
        }
        if (showDateRangePicker) document.addEventListener('mousedown', handleClickOutside);
        else document.removeEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDateRangePicker]);

    // ─── Simplified columns with Indonesian labels ──────────────────
    const displayColumns = [
        { key: 'Return Order ID', label: 'No Retur' },
        { key: 'Order ID', label: 'Order ID' },
        { key: 'STATUS BARANG', label: 'Status Barang' },
        { key: 'TERKIRIM', label: 'Terkirim' },
        { key: 'ALAMAT', label: 'Alamat' },
        { key: 'KERUGIAN', label: 'Kerugian' },
        { key: 'TANGGUNG ONGKIR', label: 'Tanggung Ongkir' },
        { key: 'Return Reason', label: 'Alasan' },
        { key: 'Return Logistics Tracking ID', label: 'Resi' },
        { key: 'Return Status', label: 'Status Retur' },
        { key: 'Appeal Status', label: 'Status Banding' },
        { key: 'Compensation Amount', label: 'Kompensasi' },
        { key: 'Buyer Note', label: 'Catatan Pembeli' },
    ];

    // All columns for popup detail
    const allDetailColumns = [
        { key: 'Return Order ID', label: 'No Retur' },
        { key: 'Order ID', label: 'Order ID' },
        { key: 'Order Amount', label: 'Jumlah Pesanan' },
        { key: 'Order Status', label: 'Status Pesanan' },
        { key: 'Order Substatus', label: 'Substatus Pesanan' },
        { key: 'Payment Method', label: 'Metode Pembayaran' },
        { key: 'SKU ID', label: 'SKU ID' },
        { key: 'Seller SKU', label: 'Seller SKU' },
        { key: 'Product Name', label: 'Nama Produk' },
        { key: 'SKU Name', label: 'Nama SKU' },
        { key: 'Buyer Username', label: 'Username Pembeli' },
        { key: 'Return Type', label: 'Tipe Retur' },
        { key: 'Time Requested', label: 'Waktu Pengajuan' },
        { key: 'Return Reason', label: 'Alasan Retur' },
        { key: 'Return unit price', label: 'Harga Unit Retur' },
        { key: 'Return Quantity', label: 'Qty Retur' },
        { key: 'Return Logistics Tracking ID', label: 'Resi Retur' },
        { key: 'Return Status', label: 'Status Retur' },
        { key: 'Return Sub Status', label: 'Substatus Retur' },
        { key: 'Refund Time', label: 'Waktu Refund' },
        { key: 'Dispute Status', label: 'Status Dispute' },
        { key: 'Appeal Status', label: 'Status Banding' },
        { key: 'Compensation Status', label: 'Status Kompensasi' },
        { key: 'Compensation Amount', label: 'Kompensasi' },
        { key: 'Buyer Note', label: 'Catatan Pembeli' },
        { key: 'STATUS BARANG', label: 'Status Barang' },
        { key: 'TERKIRIM', label: 'Terkirim' },
        { key: 'ALAMAT', label: 'Alamat' },
        { key: 'KERUGIAN', label: 'Kerugian' },
        { key: 'TANGGUNG ONGKIR', label: 'Tanggung Ongkir' },
    ];

    const pengembalianResiSet = useMemo(() => {
        const set = new Set();
        // From uploaded pengembalian data
        for (const row of pengembalianData) {
            const resiKey = Object.keys(row).find(k => k.toLowerCase().includes('resi'));
            if (resiKey) {
                const val = row[resiKey];
                if (val && val.toString().trim() !== '') set.add(val.toString().trim());
            }
        }
        // From scanned resi data
        for (const item of scanData) {
            if (item.resi && item.resi.trim() !== '') set.add(item.resi.trim());
        }
        return set;
    }, [pengembalianData, scanData]);

    // ─── Build map: resi → scan/received date ───────────────────────
    const resiScanDateMap = useMemo(() => {
        const map = new Map();
        // From scanned resi data (most reliable - actual scan timestamp)
        for (const item of scanData) {
            if (item.resi && item.resi.trim()) {
                const d = new Date(item.scanned_at);
                map.set(item.resi.trim(), d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            }
        }
        // From uploaded pengembalian data (tanggal resi retur terscan)
        for (const row of pengembalianData) {
            const resiKey = Object.keys(row).find(k => k.toLowerCase().includes('resi'));
            const tglKey = Object.keys(row).find(k => k.toLowerCase().includes('tanggal') || k.toLowerCase().includes('date'));
            if (resiKey && tglKey) {
                const resiVal = (row[resiKey] || '').toString().trim();
                const tglVal = (row[tglKey] || '').toString().trim();
                // Only set if not already recorded from scan (scan takes priority)
                if (resiVal && tglVal && !map.has(resiVal)) {
                    map.set(resiVal, tglVal);
                }
            }
        }
        return map;
    }, [pengembalianData, scanData]);

    // ─── Build address map from orders data (Order ID -> Districts, Province) ──
    const orderAddressMap = useMemo(() => {
        const map = new Map();
        for (const row of ordersData) {
            const oid = (row['Order ID'] || '').toString().trim();
            if (!oid || map.has(oid)) continue;
            const districts = (row['Districts'] || '').toString().trim();
            const province = (row['Province'] || '').toString().trim();
            const parts = [districts, province].filter(Boolean);
            map.set(oid, parts.length > 0 ? parts.join(', ') : '-');
        }
        return map;
    }, [ordersData]);

    const [sortConfig, setSortConfig] = useState({ key: 'Time Requested', direction: 'desc' });

    function requestSort(key) {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    }

    function sortValues(a, b) {
        if (a == null) a = '';
        if (b == null) b = '';
        const aNum = parseFloat(a.toString().replace(/[^0-9.-]+/g, ""));
        const bNum = parseFloat(b.toString().replace(/[^0-9.-]+/g, ""));
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.toString().localeCompare(b.toString());
    }

    const parseDateFromRow = (row) => {
        const dateStr = row['Time Requested'] || '';
        if (!dateStr) return null;
        const str = dateStr.toString().trim();
        if (str.includes('-')) {
            const [datePart] = str.split(' ');
            const [year, month, day] = datePart.split('-').map(Number);
            if ([day, month, year].some(isNaN)) return null;
            return { year, month, day };
        }
        if (str.includes('/')) {
            const [datePart] = str.split(' ');
            const [day, month, year] = datePart.split('/').map(Number);
            if ([day, month, year].some(isNaN)) return null;
            return { year, month, day };
        }
        return null;
    };

    const getStatusBarang = (row) => {
        const trackingId = row['Return Logistics Tracking ID'];
        if (!trackingId || trackingId.toString().trim() === '') return '-';
        return pengembalianResiSet.has(trackingId.toString().trim()) ? 'Diterima' : 'Belum Diterima';
    };

    const getTanggungOngkir = (row) => row['TANGGUNG ONGKIR'] || row['Tanggung Ongkir'] || row['tanggung ongkir'] || '-';

    const getAlamat = (row) => {
        const oid = (row['Order ID'] || '').toString().trim();
        if (!oid) return '-';
        return orderAddressMap.get(oid) || '-';
    };

    const getTerkirim = (row) => {
        // Show the date when the return resi was actually scanned/received
        const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();
        if (trackingId && resiScanDateMap.has(trackingId)) {
            return resiScanDateMap.get(trackingId);
        }
        // Fallback: Refund Time (when refund was processed)
        const refundTime = row['Refund Time'];
        if (!refundTime || refundTime.toString().trim() === '') return '-';
        return refundTime.toString().trim();
    };

    const formatRupiah = (num) => {
        if (!num || num === 0) return '-';
        return 'Rp' + Math.abs(num).toLocaleString('id-ID');
    };

    const getModalForReturnRow = useCallback((row) => {
        const sellerSku = (row['Seller SKU'] || '').toString().trim();
        const skuId = (row['SKU ID'] || '').toString().trim();
        const variation = (row['SKU Name'] || row['Variation'] || '').toString().trim();
        const fullKey = `${sellerSku}||${skuId}||${variation}`;
        let modalPerUnit = 0;
        if (modalValues[fullKey]) {
            modalPerUnit = parseInt(String(modalValues[fullKey]).replace(/[^0-9]/g, ''), 10) || 0;
        } else if (modalValues[sellerSku]) {
            modalPerUnit = parseInt(String(modalValues[sellerSku]).replace(/[^0-9]/g, ''), 10) || 0;
        }
        const qtyRaw = row['Return Quantity'];
        const qty = typeof qtyRaw === 'string' ? parseInt(qtyRaw.replace(/\D/g, ''), 10) : Number(qtyRaw);
        return modalPerUnit * (isNaN(qty) ? 1 : qty);
    }, [modalValues]);

    const getKerugian = (row) => {
        const status = getStatusBarang(row);
        if (status !== 'Belum Diterima') return '-';
        const loss = getModalForReturnRow(row);
        return loss > 0 ? formatRupiah(loss) : '-';
    };

    const getKerugianNum = (row) => {
        const status = getStatusBarang(row);
        if (status !== 'Belum Diterima') return 0;
        return getModalForReturnRow(row);
    };

    const getCellValue = (row, key) => {
        if (key === 'STATUS BARANG') return getStatusBarang(row);
        if (key === 'TANGGUNG ONGKIR') return getTanggungOngkir(row);
        if (key === 'ALAMAT') return getAlamat(row);
        if (key === 'TERKIRIM') return getTerkirim(row);
        if (key === 'KERUGIAN') return getKerugian(row);
        return row[key] || '-';
    };

    // ─── Filter out "Rejected" returns unless the same Order ID has a
    //     non-rejected entry (re-submission accepted) ─────────────────
    const activeReturnData = useMemo(() => {
        // Build set of Order IDs that have at least one non-rejected return
        const orderIdsWithActiveReturn = new Set();
        for (const row of returnData) {
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (rs !== 'rejected' && rs !== 'refund rejected') {
                const oid = (row['Order ID'] || '').toString().trim();
                if (oid) orderIdsWithActiveReturn.add(oid);
            }
        }
        return returnData.filter(row => {
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            // Keep all non-rejected entries
            if (rs !== 'rejected' && rs !== 'refund rejected') return true;
            // For rejected entries: only keep if the same Order ID has a non-rejected entry
            const oid = (row['Order ID'] || '').toString().trim();
            return orderIdsWithActiveReturn.has(oid);
        });
    }, [returnData]);

    const filteredData = useMemo(() => {
        let data = activeReturnData;
        if (filterStartDate || filterEndDate) {
            data = data.filter(row => {
                const parsed = parseDateFromRow(row);
                if (!parsed) return false;
                const dateKey = `${parsed.year}-${parsed.month.toString().padStart(2, '0')}-${parsed.day.toString().padStart(2, '0')}`;
                if (filterStartDate && dateKey < filterStartDate) return false;
                if (filterEndDate && dateKey > filterEndDate) return false;
                return true;
            });
        }
        if (search.trim()) {
            const s = search.toLowerCase();
            data = data.filter(row =>
                displayColumns.some(col => {
                    const val = getCellValue(row, col.key);
                    return val && val.toString().toLowerCase().includes(s);
                })
            );
        }
        return data;
    }, [activeReturnData, search, filterStartDate, filterEndDate, pengembalianResiSet]);

    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;
        const key = sortConfig.key;
        const direction = sortConfig.direction;
        return [...filteredData].sort((a, b) => {
            const aVal = getCellValue(a, key);
            const bVal = getCellValue(b, key);
            const cmp = sortValues(aVal, bVal);
            return direction === 'asc' ? cmp : -cmp;
        });
    }, [filteredData, sortConfig, pengembalianResiSet]);

    const handleDownloadExcel = () => {
        if (!sortedData || sortedData.length === 0) return;
        const wsData = sortedData.map(row => {
            const obj = {};
            displayColumns.forEach(col => { obj[col.label] = getCellValue(row, col.key); });
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Return Data');
        XLSX.writeFile(wb, 'Return_Data.xlsx');
    };

    const [showPdfMenu, setShowPdfMenu] = useState(false);
    const pdfMenuRef = useRef(null);

    useEffect(() => {
        function handlePdfClickOutside(e) {
            if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target)) setShowPdfMenu(false);
        }
        if (showPdfMenu) document.addEventListener('mousedown', handlePdfClickOutside);
        else document.removeEventListener('mousedown', handlePdfClickOutside);
        return () => document.removeEventListener('mousedown', handlePdfClickOutside);
    }, [showPdfMenu]);

    const handleDownloadPdf = (mode) => {
        setShowPdfMenu(false);
        let data = sortedData;
        if (mode === 'belum') {
            data = data.filter(row => getStatusBarang(row) === 'Belum Diterima');
        } else {
            // Semua barang: only rows that have a resi
            data = data.filter(row => {
                const resi = (row['Return Logistics Tracking ID'] || '').toString().trim();
                return resi !== '';
            });
        }
        if (!data || data.length === 0) return;

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        // ── Header banner ──
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setFillColor(99, 45, 200);
        doc.rect(0, 0, pageWidth, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('LAPORAN DATA RETURN', pageWidth / 2, 12, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(mode === 'belum' ? 'Filter: Belum Diterima Saja' : 'Filter: Semua Barang', pageWidth / 2, 18, { align: 'center' });
        doc.text(`Dicetak: ${dateStr}, ${timeStr} WIB`, pageWidth / 2, 23, { align: 'center' });

        // ── Summary stats ──
        const totalRows = data.length;
        const diterimaCount = data.filter(r => getStatusBarang(r) === 'Diterima').length;
        const belumCount = data.filter(r => getStatusBarang(r) === 'Belum Diterima').length;
        const totalKerugian = data.reduce((sum, r) => sum + getKerugianNum(r), 0);

        const statY = 34;
        const statBoxW = (pageWidth - 28 - 18) / 4;

        // Stat box: Total
        doc.setFillColor(245, 243, 255);
        doc.roundedRect(14, statY, statBoxW, 16, 2, 2, 'F');
        doc.setDrawColor(124, 58, 237);
        doc.setLineWidth(0.3);
        doc.roundedRect(14, statY, statBoxW, 16, 2, 2, 'S');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.text('TOTAL DATA', 14 + statBoxW / 2, statY + 5, { align: 'center' });
        doc.setTextColor(124, 58, 237);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(String(totalRows), 14 + statBoxW / 2, statY + 12, { align: 'center' });

        // Stat box: Diterima
        const stat2X = 14 + statBoxW + 6;
        doc.setFillColor(236, 253, 245);
        doc.roundedRect(stat2X, statY, statBoxW, 16, 2, 2, 'F');
        doc.setDrawColor(16, 185, 129);
        doc.roundedRect(stat2X, statY, statBoxW, 16, 2, 2, 'S');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text('DITERIMA', stat2X + statBoxW / 2, statY + 5, { align: 'center' });
        doc.setTextColor(16, 185, 129);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(String(diterimaCount), stat2X + statBoxW / 2, statY + 12, { align: 'center' });

        // Stat box: Belum Diterima
        const stat3X = stat2X + statBoxW + 6;
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(stat3X, statY, statBoxW, 16, 2, 2, 'F');
        doc.setDrawColor(245, 158, 11);
        doc.roundedRect(stat3X, statY, statBoxW, 16, 2, 2, 'S');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text('BELUM DITERIMA', stat3X + statBoxW / 2, statY + 5, { align: 'center' });
        doc.setTextColor(245, 158, 11);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(String(belumCount), stat3X + statBoxW / 2, statY + 12, { align: 'center' });

        // Stat box: Kerugian
        const stat4X = stat3X + statBoxW + 6;
        doc.setFillColor(254, 226, 226);
        doc.roundedRect(stat4X, statY, statBoxW, 16, 2, 2, 'F');
        doc.setDrawColor(239, 68, 68);
        doc.roundedRect(stat4X, statY, statBoxW, 16, 2, 2, 'S');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text('TOTAL KERUGIAN', stat4X + statBoxW / 2, statY + 5, { align: 'center' });
        doc.setTextColor(239, 68, 68);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(totalKerugian > 0 ? formatRupiah(totalKerugian) : '-', stat4X + statBoxW / 2, statY + 12, { align: 'center' });

        // ── Table ──
        const pdfColumns = [
            { key: '_no', label: 'No' },
            { key: 'Return Logistics Tracking ID', label: 'Resi' },
            { key: 'STATUS BARANG', label: 'Status' },
            { key: 'TERKIRIM', label: 'Terkirim' },
            { key: 'Order ID', label: 'Order ID' },
            { key: 'ALAMAT', label: 'Alamat' },
            { key: 'KERUGIAN', label: 'Kerugian' },
        ];
        const head = [pdfColumns.map(c => c.label)];
        const body = data.map((row, idx) => pdfColumns.map(c => {
            if (c.key === '_no') return String(idx + 1);
            return getCellValue(row, c.key);
        }));

        autoTable(doc, {
            head,
            body,
            startY: 56,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 2.5, lineColor: [220, 220, 230], lineWidth: 0.2, textColor: [50, 50, 50] },
            headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 3 },
            alternateRowStyles: { fillColor: [250, 248, 255] },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center', fontStyle: 'bold', textColor: [150, 150, 150] },
                1: { cellWidth: 32, fontStyle: 'bold' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 24 },
                4: { cellWidth: 30 },
                5: { cellWidth: 'auto' },
                6: { cellWidth: 24, halign: 'right' },
            },
            didParseCell: function (hookData) {
                // Color the Status column cells
                if (hookData.section === 'body' && hookData.column.index === 2) {
                    const val = hookData.cell.raw;
                    if (val === 'Diterima') {
                        hookData.cell.styles.textColor = [16, 185, 129];
                        hookData.cell.styles.fontStyle = 'bold';
                    } else if (val === 'Belum Diterima') {
                        hookData.cell.styles.textColor = [245, 158, 11];
                        hookData.cell.styles.fontStyle = 'bold';
                    }
                }
                // Color the Kerugian column cells red
                if (hookData.section === 'body' && hookData.column.index === 6) {
                    const val = hookData.cell.raw;
                    if (val && val !== '-') {
                        hookData.cell.styles.textColor = [239, 68, 68];
                        hookData.cell.styles.fontStyle = 'bold';
                    }
                }
            },
            margin: { left: 14, right: 14 },
        });

        // ── Footer on each page ──
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
            doc.text('Marketplace Report — Data Return', 14, pageH - 4);
            doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 14, pageH - 4, { align: 'right' });
        }

        const fileName = mode === 'belum' ? 'Return_Belum_Diterima.pdf' : 'Return_Semua.pdf';
        doc.save(fileName);
    };

    function SortIcon({ columnKey }) {
        const size = 12;
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={size} style={{ opacity: 0.3, marginLeft: '4px' }} />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />
            : <ArrowDown size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
    }

    const tdStyle = { padding: '0.625rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8125rem' };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RotateCcw size={24} style={{ color: '#7c3aed' }} />
                        Return
                    </h2>
                    <p>{sortedData.length.toLocaleString('id-ID')} data return</p>
                </div>
                <div style={{ position: 'relative', maxWidth: '20rem', flex: '1' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input type="text" placeholder="Cari di Return..." value={search}
                        onChange={(e) => setSearch(e.target.value)} className="search-input" />
                </div>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ position: 'relative' }} ref={datePickerRef}>
                    <button type="button" onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                            background: (filterStartDate || filterEndDate) ? 'rgba(124,58,237,0.15)' : 'var(--bg-glass)',
                            color: (filterStartDate || filterEndDate) ? '#a78bfa' : 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                        }}>
                        <Calendar size={14} />
                        {(filterStartDate || filterEndDate) ? `${filterStartDate || '...'} → ${filterEndDate || '...'}` : 'Pilih Rentang Tanggal'}
                    </button>
                    {showDateRangePicker && (
                        <div style={{ position: 'absolute', zIndex: 50, marginTop: '0.5rem' }}>
                            <DateRangePicker startDate={filterStartDate || null} endDate={filterEndDate || null} onChange={({ startDate, endDate }) => {
                                setFilterStartDate(startDate); setFilterEndDate(endDate); setCurrentPage(1);
                            }} onClose={() => setShowDateRangePicker(false)} />
                        </div>
                    )}
                </div>
                <button onClick={handleDownloadExcel} type="button"
                    className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                    <Download size={14} /> Download Excel
                </button>
                <div style={{ position: 'relative' }} ref={pdfMenuRef}>
                    <button onClick={() => setShowPdfMenu(!showPdfMenu)} type="button"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.8125rem',
                            fontWeight: 700, borderRadius: 'var(--radius-md)', border: '1px solid #ef4444',
                            background: showPdfMenu ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)', color: '#f87171', cursor: 'pointer',
                        }}>
                        <FileText size={14} /> Download PDF ▾
                    </button>
                    {showPdfMenu && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, marginTop: '0.375rem', zIndex: 50,
                            background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)', overflow: 'hidden', minWidth: '200px',
                        }}>
                            <button type="button" onClick={() => handleDownloadPdf('semua')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                                    color: 'var(--text-primary)', textAlign: 'left',
                                }}
                                onMouseEnter={e => e.target.style.background = 'var(--bg-glass)'}
                                onMouseLeave={e => e.target.style.background = 'none'}>
                                📦 Semua Barang
                            </button>
                            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                            <button type="button" onClick={() => handleDownloadPdf('belum')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                                    color: '#f59e0b', textAlign: 'left',
                                }}
                                onMouseEnter={e => e.target.style.background = 'rgba(245,158,11,0.08)'}
                                onMouseLeave={e => e.target.style.background = 'none'}>
                                ⏳ Belum Diterima Saja
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="modern-table-wrapper">
                <div style={{ overflowX: 'auto' }}>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '3rem' }}>No</th>
                                    {displayColumns.map((col) => (
                                        <th key={col.key} onClick={() => requestSort(col.key)} style={{ cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span>{col.label}</span>
                                                <SortIcon columnKey={col.key} />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <tr key={`skel-${i}`}>
                                            <td><div className="skeleton" style={{ height: '1rem', width: '1.5rem' }}>&nbsp;</div></td>
                                            {displayColumns.map(col => (
                                                <td key={col.key}><div className="skeleton" style={{ height: '1rem', width: `${40 + Math.random() * 60}%` }}>&nbsp;</div></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : sortedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={displayColumns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
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
                                                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-tertiary)' }}>{startIdx + i + 1}</td>
                                                {displayColumns.map((col) => {
                                                    const val = getCellValue(row, col.key);

                                                    // Order ID — clickable with copy icon
                                                    if (col.key === 'Order ID') {
                                                        return (
                                                            <td key={col.key} style={{ ...tdStyle, color: '#a78bfa', fontWeight: 600 }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                                                                    <button type="button" title="Copy Order ID"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(val);
                                                                            const btn = e.currentTarget;
                                                                            btn.dataset.copied = 'true';
                                                                            btn.querySelector('.copy-icon').style.display = 'none';
                                                                            btn.querySelector('.check-icon').style.display = 'block';
                                                                            setTimeout(() => {
                                                                                btn.dataset.copied = '';
                                                                                btn.querySelector('.copy-icon').style.display = 'block';
                                                                                btn.querySelector('.check-icon').style.display = 'none';
                                                                            }, 1500);
                                                                        }}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: 'var(--text-tertiary)', display: 'inline-flex', transition: 'color 0.2s' }}
                                                                        onMouseOver={e => e.currentTarget.style.color = '#a78bfa'}
                                                                        onMouseOut={e => { if (!e.currentTarget.dataset.copied) e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                                                                    >
                                                                        <Copy size={13} className="copy-icon" />
                                                                        <Check size={13} className="check-icon" style={{ display: 'none', color: '#34d399' }} />
                                                                    </button>
                                                                    <span style={{ cursor: 'pointer' }}
                                                                        onClick={() => setSelectedRow(row)}
                                                                        onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                                        onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                                                    >{val}</span>
                                                                </span>
                                                            </td>
                                                        );
                                                    }

                                                    // STATUS BARANG — colored badge
                                                    if (col.key === 'STATUS BARANG') {
                                                        if (val === 'Diterima') {
                                                            return (
                                                                <td key={col.key} style={{ ...tdStyle }}>
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#34d399', fontWeight: 600 }}>
                                                                        <CheckCircle size={14} /> Diterima
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (val === 'Belum Diterima') {
                                                            return (
                                                                <td key={col.key} style={{ ...tdStyle }}>
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f87171', fontWeight: 600 }}>
                                                                        <XCircle size={14} /> Belum Diterima
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        return <td key={col.key} style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>-</td>;
                                                    }

                                                    // Resi — clickable to track
                                                    if (col.key === 'Return Logistics Tracking ID' && val && val !== '-') {
                                                        // Try to find shipping provider from the order data
                                                        const provider = row['Shipping Provider Name'] || row['Opsi Pengiriman'] || '';
                                                        return (
                                                            <td key={col.key} style={{ ...tdStyle, color: '#818cf8', fontWeight: 600 }}>
                                                                <span
                                                                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                                    onClick={() => fetchTracking(val, provider)}
                                                                    onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                                    onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                                                >
                                                                    <Truck size={13} /> {val}
                                                                </span>
                                                            </td>
                                                        );
                                                    }

                                                    return <td key={col.key} style={tdStyle} title={val}>{val}</td>;
                                                })}
                                            </tr>
                                        ));
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Pagination Controls */}
            {(() => {
                const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
                const safePage = Math.min(currentPage, totalPages);
                const startIdx = (safePage - 1) * rowsPerPage;
                const endIdx = Math.min(startIdx + rowsPerPage, sortedData.length);
                const maxButtons = 7;
                let startPage = Math.max(1, safePage - Math.floor(maxButtons / 2));
                let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                if (endPage - startPage + 1 < maxButtons) startPage = Math.max(1, endPage - maxButtons + 1);
                const pageButtons = [];
                for (let p = startPage; p <= endPage; p++) pageButtons.push(p);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Tampilkan</span>
                            <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                | {sortedData.length > 0 ? `${startIdx + 1}–${endIdx}` : '0'} dari {sortedData.length.toLocaleString('id-ID')} data
                            </span>
                        </div>
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}
                                    style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: safePage <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.5 : 1 }}>
                                    «
                                </button>
                                <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: safePage <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.5 : 1 }}>
                                    ‹
                                </button>
                                {pageButtons.map(p => (
                                    <button key={p} type="button" onClick={() => setCurrentPage(p)}
                                        style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: p === safePage ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)', background: p === safePage ? 'var(--accent-primary)' : 'var(--bg-glass)', color: p === safePage ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                        {p}
                                    </button>
                                ))}
                                <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: safePage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.5 : 1 }}>
                                    ›
                                </button>
                                <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}
                                    style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: safePage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.5 : 1 }}>
                                    »
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ─── Order Detail Popup ─────────────────────────────────── */}
            {selectedRow && (() => {
                const row = selectedRow;
                const statusBarang = getStatusBarang(row);
                const statusColor = statusBarang === 'Diterima' ? '#34d399' : statusBarang === 'Belum Diterima' ? '#f87171' : '#94a3b8';
                const returnStatus = (row['Return Status'] || '').toLowerCase();
                const headerColor = returnStatus.includes('complete') ? '#34d399' : returnStatus.includes('reject') ? '#f87171' : returnStatus.includes('process') ? '#fbbf24' : '#818cf8';

                return (
                    <div onClick={() => setSelectedRow(null)} style={{
                        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', animation: 'fadeInUp 0.2s ease',
                    }}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)',
                            boxShadow: 'var(--shadow-xl)', maxWidth: '600px', width: '95%', maxHeight: '85vh', overflow: 'auto',
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '1.25rem 1.5rem', borderBottom: `2px solid ${headerColor}`,
                                background: `linear-gradient(135deg, ${headerColor}18, transparent)`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: headerColor, fontWeight: 700, marginBottom: '0.25rem' }}>
                                        Detail Return
                                    </div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {row['Order ID'] || '-'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                        No Retur: {row['Return Order ID'] || '-'}
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRow(null)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                                    padding: '0.25rem', display: 'flex',
                                }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body — Info Grid */}
                            <div style={{ padding: '1.25rem 1.5rem' }}>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
                                }}>
                                    {allDetailColumns.map(col => {
                                        if (col.key === 'Order ID' || col.key === 'Return Order ID') return null;
                                        const val = getCellValue(row, col.key);
                                        return (
                                            <div key={col.key} style={{
                                                padding: '0.625rem 0.75rem', background: 'var(--bg-glass)',
                                                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                                            }}>
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.25rem' }}>
                                                    {col.label}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.8125rem', fontWeight: 600, wordBreak: 'break-word',
                                                    color: col.key === 'STATUS BARANG' ? statusColor
                                                        : col.key === 'Compensation Amount' ? '#fbbf24'
                                                            : 'var(--text-primary)',
                                                }}>
                                                    {val || '-'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ─── Tracking Popup ──────────────────────────────────────── */}
            {trackingPopup && (
                <div onClick={() => { setTrackingPopup(null); setTrackingData(null); setTrackingError(null); }} style={{
                    position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', animation: 'fadeInUp 0.2s ease',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)',
                        boxShadow: 'var(--shadow-xl)', maxWidth: '520px', width: '95%', maxHeight: '85vh', overflow: 'auto',
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem', borderBottom: '2px solid #818cf8',
                            background: 'linear-gradient(135deg, rgba(129,140,248,0.1), transparent)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        }}>
                            <div>
                                <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    <Truck size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                    Lacak Pengiriman
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                    {trackingPopup.awb}
                                </div>
                                {trackingPopup.provider && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                        Kurir: {trackingPopup.provider}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => { setTrackingPopup(null); setTrackingData(null); setTrackingError(null); }} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                                padding: '0.25rem', display: 'flex',
                            }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '1.25rem 1.5rem' }}>
                            {/* Loading */}
                            {trackingLoading && (
                                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                    <div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid var(--border-subtle)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>Melacak resi...</div>
                                </div>
                            )}

                            {/* Error — with manual courier picker */}
                            {trackingError && (
                                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                    <AlertCircle size={32} style={{ color: '#f87171', margin: '0 auto 0.75rem' }} />
                                    <div style={{ fontSize: '0.875rem', color: '#f87171', fontWeight: 600 }}>{trackingError}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', marginBottom: '1rem' }}>Pilih kurir dan coba lagi</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <select
                                            id="manual-courier-select"
                                            defaultValue=""
                                            style={{
                                                padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border-medium)', background: 'var(--bg-glass)', color: 'var(--text-primary)',
                                                cursor: 'pointer', minWidth: '140px',
                                            }}
                                        >
                                            <option value="" disabled>Pilih Kurir...</option>
                                            <option value="jnt">J&T Express</option>
                                            <option value="jne">JNE</option>
                                            <option value="sicepat">SiCepat</option>
                                            <option value="anteraja">AnterAja</option>
                                            <option value="spx">SPX Express</option>
                                            <option value="ninja">Ninja Express</option>
                                            <option value="tiki">TIKI</option>
                                            <option value="pos">POS Indonesia</option>
                                            <option value="lion">Lion Parcel</option>
                                            <option value="ide">ID Express</option>
                                            <option value="wahana">Wahana</option>
                                            <option value="sap">SAP Express</option>
                                        </select>
                                        <button
                                            onClick={() => {
                                                const sel = document.getElementById('manual-courier-select');
                                                if (sel && sel.value) {
                                                    setTrackingError(null);
                                                    setTrackingData(null);
                                                    setTrackingLoading(true);
                                                    fetch(`/api/tracking?awb=${encodeURIComponent(trackingPopup.awb)}&courier=${encodeURIComponent(sel.value)}`)
                                                        .then(r => r.json())
                                                        .then(json => {
                                                            if (json.error) throw new Error(json.error);
                                                            setTrackingData(json.data || json);
                                                        })
                                                        .catch(err => setTrackingError(err.message))
                                                        .finally(() => setTrackingLoading(false));
                                                }
                                            }}
                                            style={{
                                                padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
                                                borderRadius: 'var(--radius-md)', border: 'none',
                                                background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff',
                                                cursor: 'pointer', transition: 'opacity 0.15s',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
                                            onMouseOut={e => e.currentTarget.style.opacity = '1'}
                                        >
                                            Lacak Ulang
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Data */}
                            {trackingData && (() => {
                                const summary = trackingData.summary || {};
                                const history = trackingData.history || [];
                                const statusText = (summary.status || '').toUpperCase();
                                const isDelivered = statusText.includes('DELIVERED') || statusText.includes('TERKIRIM');
                                const statusColor = isDelivered ? '#34d399' : statusText.includes('TRANSIT') ? '#fbbf24' : '#818cf8';

                                return (
                                    <>
                                        {/* Status Summary Card */}
                                        <div style={{
                                            padding: '1rem', borderRadius: 'var(--radius-md)',
                                            background: `linear-gradient(135deg, ${statusColor}15, ${statusColor}05)`,
                                            border: `1px solid ${statusColor}30`,
                                            marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
                                        }}>
                                            <div style={{
                                                width: '3rem', height: '3rem', borderRadius: '50%',
                                                background: `${statusColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                {isDelivered ? <CheckCircle size={24} style={{ color: statusColor }} /> : <Package size={24} style={{ color: statusColor }} />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: statusColor }}>
                                                    {statusText || 'UNKNOWN'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                                    {summary.courier || '-'} {summary.service ? `• ${summary.service}` : ''}
                                                </div>
                                                {summary.date && (
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                                        {summary.date}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Timeline */}
                                        {history.length > 0 ? (
                                            <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                                                {/* Vertical line */}
                                                <div style={{
                                                    position: 'absolute', left: '0.4375rem', top: '0.5rem', bottom: '0.5rem',
                                                    width: '2px', background: 'var(--border-subtle)',
                                                }} />
                                                {history.map((h, idx) => {
                                                    const isFirst = idx === 0;
                                                    const dotColor = isFirst ? statusColor : 'var(--border-medium)';
                                                    return (
                                                        <div key={idx} style={{
                                                            position: 'relative', paddingBottom: idx < history.length - 1 ? '1.25rem' : 0,
                                                        }}>
                                                            {/* Dot */}
                                                            <div style={{
                                                                position: 'absolute', left: '-1.5rem',
                                                                width: isFirst ? '0.875rem' : '0.625rem',
                                                                height: isFirst ? '0.875rem' : '0.625rem',
                                                                borderRadius: '50%', background: dotColor,
                                                                top: '0.125rem',
                                                                marginLeft: isFirst ? '0' : '0.125rem',
                                                                boxShadow: isFirst ? `0 0 0 3px ${statusColor}30` : 'none',
                                                            }} />
                                                            {/* Content */}
                                                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.125rem' }}>
                                                                {h.date || '-'}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '0.8125rem', color: isFirst ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                fontWeight: isFirst ? 600 : 400, lineHeight: 1.4,
                                                            }}>
                                                                {h.desc || '-'}
                                                            </div>
                                                            {h.location && (
                                                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                    <MapPin size={10} /> {h.location}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
                                                Belum ada riwayat tracking
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
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
            if (date < internalStartDate) { setInternalStartDate(date); setInternalEndDate(null); }
            else { setInternalEndDate(date); setSelectingStart(true); }
        }
    }
    function generateCalendarDays(monthDate) {
        const year = monthDate.getFullYear(), month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        return days;
    }
    function isInRange(date) {
        if (!internalStartDate || !internalEndDate) return false;
        const d = date.getTime(), s = internalStartDate.getTime(), e = internalEndDate.getTime();
        return d >= s && d <= e;
    }
    const isStartDate = (date) => internalStartDate && date.toDateString() === internalStartDate.toDateString();
    const isEndDate = (date) => internalEndDate && date.toDateString() === internalEndDate.toDateString();
    const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
    const formatMonthYear = (date) => {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };
    const days = generateCalendarDays(calendarMonth);
    const onClear = () => { setInternalStartDate(null); setInternalEndDate(null); onChange({ startDate: '', endDate: '' }); setSelectingStart(true); setSelectedMonth(''); };
    const onApply = () => { updateInputValue(); onClose(); };
    const handleLast7Days = () => {
        const today = new Date(); const start = new Date(); start.setDate(today.getDate() - 6);
        setInternalStartDate(start); setInternalEndDate(today); setSelectingStart(true); setSelectedMonth('');
        onChange({ startDate: toLocalDateStr(start), endDate: toLocalDateStr(today) });
    };
    const handleThisMonth = () => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setInternalStartDate(firstDayOfMonth); setInternalEndDate(today); setSelectingStart(true); setSelectedMonth('');
        setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        onChange({ startDate: toLocalDateStr(firstDayOfMonth), endDate: toLocalDateStr(today) });
    };
    const handleMonthChange = (e) => {
        const val = e.target.value;
        setSelectedMonth(val);
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        const firstDay = new Date(y, m - 1, 1);
        const lastDay = new Date(y, m, 0);
        setInternalStartDate(firstDay); setInternalEndDate(lastDay); setSelectingStart(true);
        setCalendarMonth(new Date(y, m - 1, 1));
        onChange({ startDate: toLocalDateStr(firstDay), endDate: toLocalDateStr(lastDay) });
    };

    const availableMonths = [];
    const now = new Date();
    const formatMonthYearOption = (monthStr) => {
        const [y, m] = monthStr.split('-').map(Number);
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${months[m - 1]} ${y}`;
    };
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        availableMonths.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    }

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '1rem', width: '320px' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleLast7Days} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>7 Hari Terakhir</button>
                <button type="button" onClick={handleThisMonth} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Bulan Ini</button>
                <select value={selectedMonth} onChange={handleMonthChange} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <option value="">Pilih Bulan</option>
                    {availableMonths.map(m => <option key={m} value={m}>{formatMonthYearOption(m)}</option>)}
                </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{formatMonthYear(calendarMonth)}</span>
                <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><ChevronRight size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '0.7rem' }}>
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => <div key={d} style={{ fontWeight: 700, color: 'var(--text-tertiary)', padding: '0.25rem' }}>{d}</div>)}
                {days.map((day, i) => day ? (
                    <div key={i} onClick={() => onDateClick(day)} style={{
                        padding: '0.375rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 600,
                        background: isStartDate(day) || isEndDate(day) ? 'var(--accent-primary)' : isInRange(day) ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                        color: isStartDate(day) || isEndDate(day) ? '#fff' : isInRange(day) ? '#a78bfa' : 'var(--text-primary)',
                    }}>{day.getDate()}</div>
                ) : (
                    <div key={i} />
                ))}
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Clear</button>
                <button type="button" onClick={onApply} className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Close</button>
            </div>
        </div>
    );
}

export default ReturnTable;