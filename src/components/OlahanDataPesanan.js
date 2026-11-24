import React, { useMemo, useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Calendar, Download, ChevronLeft, ChevronRight, X, Copy, Check, MapPin, Package, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, BarChart3, Search } from 'lucide-react';
import { useProcessedOrders, formatDateKey, formatIndonesianDateFromDateObj } from '../hooks/useProcessedOrders';
import { useDataCache } from '../contexts/DataContext';

const formatRupiah = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '';
    const rounded = Math.round(number);
    if (rounded < 0) return 'Rp-' + (-rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};


// Helper: aggregate an array of rangkuman rows into metric columns in a single pass
function aggregateRows(rowsForGroup) {
    const pesananOrder = rowsForGroup.length;
    let pesananPCS = 0;
    let cancelOrder = 0, cancelPCS = 0;
    let fixTerbeliOrder = 0, fixTerbeliPCS = 0;
    let terkirimOrder = 0, terkirimPCS = 0;
    let akanDikirimOrder = 0, akanDikirimPCS = 0;
    let sudahCairOrder = 0, sudahCairPCS = 0;
    let belumCairOrder = 0, belumCairPCS = 0;
    let labaKotor = 0, labaBersih = 0;
    let pengembalianOrder = 0, pengembalianPCS = 0;
    let returnOrder = 0;
    let affiliasiNominal = 0, affiliasiAffiliasiCount = 0;
    let codJumlah = 0;
    let estimasi = 0;

    for (let i = 0; i < pesananOrder; i++) {
        const r = rowsForGroup[i];
        const qty = r.totalQuantity || 0;
        const st = (r.statusOrder || '').toLowerCase();
        const settlement = r.totalSettlementAmount || 0;
        const modal = r.totalModal || 0;

        pesananPCS += qty;

        if (st === 'canceled' || st === 'cancelled') {
            cancelOrder++;
            cancelPCS += qty;
        } else if (st === 'completed' || st === 'shipped' || st === 'to ship') {
            fixTerbeliOrder++;
            fixTerbeliPCS += qty;
            if (st === 'shipped') {
                terkirimOrder++;
                terkirimPCS += qty;
            } else if (st === 'to ship') {
                akanDikirimOrder++;
                akanDikirimPCS += qty;
            }
            if (settlement <= 0) {
                belumCairOrder++;
                belumCairPCS += qty;
                if (st === 'shipped' || st === 'to ship') {
                    estimasi += modal;
                }
            }
        } else if (st === 'pengembalian') {
            pengembalianOrder++;
            pengembalianPCS += qty;
        } else if (st === 'return') {
            returnOrder++;
        }

        if (settlement > 0) {
            sudahCairOrder++;
            sudahCairPCS += qty;
            if (st !== 'canceled' && st !== 'cancelled' && st !== 'return' && st !== 'pengembalian') {
                labaKotor += settlement;
                labaBersih += (settlement - modal);
            }
        }

        affiliasiNominal += (r.totalAffiliateCommission || 0);
        if ((r.ketAffiliasi || '').toLowerCase() === 'affiliasi') affiliasiAffiliasiCount++;
        if ((r.metode || '').toLowerCase() === 'bayar di tempat') codJumlah++;
    }

    const returnPresentase = pesananOrder > 0 ? (returnOrder / pesananOrder) * 100 : 0;
    const affiliasiPresentase = pesananOrder > 0 ? (affiliasiAffiliasiCount / pesananOrder) * 100 : 0;
    const codPresentase = pesananOrder > 0 ? (codJumlah / pesananOrder) * 100 : 0;

    return {
        'PESANAN.Order': pesananOrder, 'PESANAN.PCS': pesananPCS,
        'CANCEL.Order': cancelOrder, 'CANCEL.PCS': cancelPCS,
        'FIX TERBELI.Order': fixTerbeliOrder, 'FIX TERBELI.PCS': fixTerbeliPCS,
        'TERKIRIM.Order': terkirimOrder, 'TERKIRIM.PCS': terkirimPCS,
        'AKAN DIKIRIM.Order': akanDikirimOrder, 'AKAN DIKIRIM.PCS': akanDikirimPCS,
        'SUDAH CAIR.Order': sudahCairOrder, 'SUDAH CAIR.PCS': sudahCairPCS,
        'BELUM CAIR.Order': belumCairOrder, 'BELUM CAIR.PCS': belumCairPCS,
        'LABA KOTOR': labaKotor === 0 ? '0' : formatRupiah(labaKotor),
        'LABA BERSIH': labaBersih === 0 ? '0' : formatRupiah(labaBersih),
        'Pengembalian.Order': pengembalianOrder, 'Pengembalian.PCS': pengembalianPCS,
        'RETURN.Order': returnOrder, 'RETURN.Presentase': returnPresentase.toFixed(2) + '%',
        ESTIMASI: estimasi === 0 ? '0' : formatRupiah(estimasi),
        'AFFILIASI.Nominal': affiliasiNominal === 0 ? '0' : formatRupiah(affiliasiNominal),
        'AFFILIASI.Presentase': affiliasiPresentase.toFixed(2) + '%',
        'COD.Jumlah': codJumlah,
        'COD.Presentase': codPresentase.toFixed(2) + '%',
        _rawOrders: rowsForGroup,
    };
}

// Label standar keuangan untuk header ekspor Excel (kunci data internal tidak diubah)
const EXPORT_HEADER_LABELS = {
    'PESANAN.Order': 'Pesanan (Order)', 'PESANAN.PCS': 'Pesanan (PCS)',
    'CANCEL.Order': 'Dibatalkan (Order)', 'CANCEL.PCS': 'Dibatalkan (PCS)',
    'FIX TERBELI.Order': 'Pesanan Valid (Order)', 'FIX TERBELI.PCS': 'Pesanan Valid (PCS)',
    'TERKIRIM.Order': 'Dalam Pengiriman (Order)', 'TERKIRIM.PCS': 'Dalam Pengiriman (PCS)',
    'AKAN DIKIRIM.Order': 'Perlu Dikirim (Order)', 'AKAN DIKIRIM.PCS': 'Perlu Dikirim (PCS)',
    'SUDAH CAIR.Order': 'Dana Diterima (Order)', 'SUDAH CAIR.PCS': 'Dana Diterima (PCS)',
    'BELUM CAIR.Order': 'Piutang Marketplace (Order)', 'BELUM CAIR.PCS': 'Piutang Marketplace (PCS)',
    'LABA KOTOR': 'Penerimaan Bersih', 'LABA BERSIH': 'Margin Kontribusi',
    'Pengembalian.Order': 'Pengembalian Paket (Order)', 'Pengembalian.PCS': 'Pengembalian Paket (PCS)',
    'RETURN.Order': 'Retur Penjualan (Order)', 'RETURN.Presentase': 'Retur Penjualan (% Order)',
    'ESTIMASI': 'Persediaan Dalam Pengiriman (HPP)',
    'AFFILIASI.Nominal': 'Komisi Afiliasi (Rp)', 'AFFILIASI.Presentase': 'Afiliasi (% Order)',
    'COD.Jumlah': 'COD (Order)', 'COD.Presentase': 'COD (% Order)',
};

function OlahanDataPesanan() {
    const { rangkumanData, rangkumanVersion, loading: isLoading, modalValues, getModalForItem } = useProcessedOrders();
    const { getComputed, setComputed } = useDataCache();
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showDateRangePicker, setShowDateRangePicker] = useState(false);
    const [detailPopup, setDetailPopup] = useState(null);
    const [orderDetailPopup, setOrderDetailPopup] = useState(null);
    const popupRef = useRef(null);

    // Analysis mode: 'waktu', 'provinsi', 'provinsi_kota', 'produk', 'produk_var'
    const [analysisMode, setAnalysisMode] = useState('waktu');
    const [copiedField, setCopiedField] = useState(null); // for copy button feedback

    useEffect(() => {
        function handleClickOutside(event) {
            if (popupRef.current && !popupRef.current.contains(event.target)) setShowDateRangePicker(false);
        }
        if (showDateRangePicker) document.addEventListener('mousedown', handleClickOutside);
        else document.removeEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDateRangePicker]);

    // Date-filtered base data
    const filteredData = useMemo(() => {
        if (!filterStartDate && !filterEndDate) return rangkumanData;
        return rangkumanData.filter(r => {
            const dk = r._dateKey || (r.waktuPesananDibuatObj ? formatDateKey(r.waktuPesananDibuatObj) : '');
            if (!dk) return false;
            if (filterStartDate && dk < filterStartDate) return false;
            if (filterEndDate && dk > filterEndDate) return false;
            return true;
        });
    }, [rangkumanData, filterStartDate, filterEndDate]);

    // Dynamic column label based on analysis mode
    const primaryColLabel = useMemo(() => {
        switch (analysisMode) {
            case 'provinsi': return 'PROVINSI';
            case 'provinsi_kota': return 'PROVINSI — KOTA';
            case 'produk': return 'PRODUK';
            case 'produk_var': return 'PRODUK — VARIASI';
            default: return 'TANGGAL';
        }
    }, [analysisMode]);

    // Whether the current mode has a secondary line
    const hasSecondary = analysisMode === 'provinsi_kota' || analysisMode === 'produk_var';

    // Generic grouping + aggregation (cached across page switches)
    const tableData = useMemo(() => {
        const olahanCacheKey = `olahan_v3::${rangkumanVersion || rangkumanData.length}::${analysisMode}::${filterStartDate}::${filterEndDate}`;
        const cached = getComputed(olahanCacheKey);
        if (cached && filteredData.length > 0) return cached;

        const groupMap = new Map();

        filteredData.forEach(row => {
            let groupKey, secondary = '';
            switch (analysisMode) {
                case 'provinsi':
                    groupKey = row.province || 'Tidak Diketahui';
                    break;
                case 'provinsi_kota':
                    groupKey = (row.province || 'Tidak Diketahui') + '|||' + (row.regencyAndCity || '');
                    secondary = row.regencyAndCity || '';
                    break;
                case 'produk': {
                    const skuLabel = row.sellerSku || row.productName || 'Tidak Diketahui';
                    groupKey = skuLabel;
                    break;
                }
                case 'produk_var': {
                    const skuLabel2 = row.sellerSku || row.productName || 'Tidak Diketahui';
                    groupKey = skuLabel2 + '|||' + (row.variation || '');
                    secondary = row.variation || '';
                    break;
                }
                default: // waktu
                    groupKey = row.waktuPesananDibuatObj ? formatDateKey(row.waktuPesananDibuatObj) : 'Tidak Diketahui';
                    break;
            }
            if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
            groupMap.get(groupKey).push(row);
        });

        const rows = [];
        for (const [key, groupRows] of groupMap.entries()) {
            const metrics = aggregateRows(groupRows);
            let displayLabel = key;
            let secondaryLabel = '';
            if (analysisMode === 'waktu') {
                const dateObj = groupRows[0]?.waktuPesananDibuatObj;
                if (dateObj) displayLabel = formatIndonesianDateFromDateObj(dateObj);
            } else if (key.includes('|||')) {
                const parts = key.split('|||');
                displayLabel = parts[0];
                secondaryLabel = parts[1] || '';
            }
            rows.push({ _primaryCol: displayLabel, _secondaryCol: secondaryLabel, _sortKey: key, ...metrics });
        }

        // Sort
        if (analysisMode === 'waktu') {
            rows.sort((a, b) => b._sortKey.localeCompare(a._sortKey)); // newest first
        } else {
            rows.sort((a, b) => b['PESANAN.Order'] - a['PESANAN.Order']); // most orders first
        }

        if (filteredData.length > 0) {
            setComputed(olahanCacheKey, rows);
        }
        return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredData, analysisMode, rangkumanVersion]);

    const summarySums = useMemo(() => {
        if (tableData.length === 0) return null;
        const keys = [
            'PESANAN.Order', 'PESANAN.PCS', 'CANCEL.Order', 'CANCEL.PCS', 'FIX TERBELI.Order', 'FIX TERBELI.PCS',
            'TERKIRIM.Order', 'TERKIRIM.PCS', 'AKAN DIKIRIM.Order', 'AKAN DIKIRIM.PCS', 'SUDAH CAIR.Order', 'SUDAH CAIR.PCS',
            'BELUM CAIR.Order', 'BELUM CAIR.PCS', 'LABA KOTOR', 'LABA BERSIH', 'Pengembalian.Order', 'Pengembalian.PCS',
            'RETURN.Order', 'RETURN.PCS', 'ESTIMASI', 'AFFILIASI.Nominal', 'COD.Jumlah'
        ];
        const sums = {};
        keys.forEach(key => {
            if (['LABA KOTOR', 'LABA BERSIH', 'ESTIMASI', 'AFFILIASI.Nominal'].includes(key)) {
                sums[key] = tableData.reduce((acc, row) => {
                    const val = row[key]; if (!val) return acc;
                    const num = Number(val.toString().replace(/\./g, '').replace(/[^0-9.-]+/g, ''));
                    return isNaN(num) ? acc : acc + num;
                }, 0);
            } else {
                sums[key] = tableData.reduce((acc, row) => { const num = Number(row[key]); return isNaN(num) ? acc : acc + num; }, 0);
            }
        });
        const totalOrders = rangkumanData.length;
        const ketAffiliasiCount = rangkumanData.filter(r => (r.ketAffiliasi || '').toLowerCase() === 'affiliasi').length;
        sums['AFFILIASI.Presentase'] = totalOrders > 0 ? (ketAffiliasiCount / totalOrders) * 100 : 0;
        const bayarDiTempatCount = rangkumanData.filter(r => (r.metode || '').toLowerCase() === 'bayar di tempat').length;
        sums['COD.Presentase'] = totalOrders > 0 ? (bayarDiTempatCount / totalOrders) * 100 : 0;
        const returnCount = rangkumanData.filter(r => r.statusOrder.toLowerCase() === 'return').length;
        sums['RETURN.Presentase'] = totalOrders > 0 ? (returnCount / totalOrders) * 100 : 0;
        return sums;
    }, [tableData, rangkumanData]);

    const handleDownloadExcel = () => {
        if (!tableData || tableData.length === 0) return;
        const headers = [
            primaryColLabel, 'PESANAN.Order', 'PESANAN.PCS', 'CANCEL.Order', 'CANCEL.PCS', 'FIX TERBELI.Order', 'FIX TERBELI.PCS',
            'TERKIRIM.Order', 'TERKIRIM.PCS', 'AKAN DIKIRIM.Order', 'AKAN DIKIRIM.PCS', 'SUDAH CAIR.Order', 'SUDAH CAIR.PCS',
            'BELUM CAIR.Order', 'BELUM CAIR.PCS', 'LABA KOTOR', 'LABA BERSIH', 'Pengembalian.Order', 'Pengembalian.PCS',
            'RETURN.Order', 'RETURN.Presentase', 'ESTIMASI', 'AFFILIASI.Nominal', 'AFFILIASI.Presentase', 'COD.Jumlah', 'COD.Presentase'
        ];
        const wsData = [headers.map(h => (h === primaryColLabel ? h : (EXPORT_HEADER_LABELS[h] || h)))];
        tableData.forEach(row => wsData.push(headers.map(h => h === primaryColLabel ? row._primaryCol : row[h])));
        if (summarySums) {
            wsData.push([
                'Jumlah', summarySums['PESANAN.Order'] || 0, summarySums['PESANAN.PCS'] || 0,
                summarySums['CANCEL.Order'] || 0, summarySums['CANCEL.PCS'] || 0,
                summarySums['FIX TERBELI.Order'] || 0, summarySums['FIX TERBELI.PCS'] || 0,
                summarySums['TERKIRIM.Order'] || 0, summarySums['TERKIRIM.PCS'] || 0,
                summarySums['AKAN DIKIRIM.Order'] || 0, summarySums['AKAN DIKIRIM.PCS'] || 0,
                summarySums['SUDAH CAIR.Order'] || 0, summarySums['SUDAH CAIR.PCS'] || 0,
                summarySums['BELUM CAIR.Order'] || 0, summarySums['BELUM CAIR.PCS'] || 0,
                summarySums['LABA KOTOR'] === 0 ? '0' : formatRupiah(summarySums['LABA KOTOR']),
                summarySums['LABA BERSIH'] === 0 ? '0' : formatRupiah(summarySums['LABA BERSIH']),
                summarySums['Pengembalian.Order'] || 0, summarySums['Pengembalian.PCS'] || 0,
                summarySums['RETURN.Order'] || 0, summarySums['RETURN.PCS'] || 0,
                summarySums.ESTIMASI === 0 ? '0' : formatRupiah(summarySums.ESTIMASI),
                summarySums['AFFILIASI.Nominal'] === 0 ? '0' : formatRupiah(summarySums['AFFILIASI.Nominal']),
                summarySums['AFFILIASI.Presentase'] ? summarySums['AFFILIASI.Presentase'].toFixed(2) + '%' : '0.00%',
                summarySums['COD.Jumlah'] || 0,
                summarySums['COD.Presentase'] ? summarySums['COD.Presentase'].toFixed(2) + '%' : '0.00%',
            ]);
        }
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Analisis Pesanan');
        XLSX.writeFile(wb, 'Olahan_Data_Pesanan.xlsx');
    };

    // ─── Column Detail Config ─────────────────────────────────────────
    const columnFilterMap = useMemo(() => ({
        'PESANAN.Order': { label: 'Pesanan', filter: () => true, cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'PESANAN.PCS': { label: 'Pesanan (PCS)', filter: () => true, cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'CANCEL.Order': { label: 'Dibatalkan', filter: r => ['canceled', 'cancelled'].includes(r.statusOrder.toLowerCase()), cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'CANCEL.PCS': { label: 'Dibatalkan (PCS)', filter: r => ['canceled', 'cancelled'].includes(r.statusOrder.toLowerCase()), cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'FIX TERBELI.Order': { label: 'Pesanan Valid', filter: r => ['completed', 'shipped', 'to ship'].includes(r.statusOrder.toLowerCase()), cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'FIX TERBELI.PCS': { label: 'Pesanan Valid (PCS)', filter: r => ['completed', 'shipped', 'to ship'].includes(r.statusOrder.toLowerCase()), cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'TERKIRIM.Order': { label: 'Dalam Pengiriman', filter: r => r.statusOrder.toLowerCase() === 'shipped', cols: ['orderId', 'productName', 'totalQuantity'] },
        'TERKIRIM.PCS': { label: 'Dalam Pengiriman (PCS)', filter: r => r.statusOrder.toLowerCase() === 'shipped', cols: ['orderId', 'productName', 'totalQuantity'] },
        'AKAN DIKIRIM.Order': { label: 'Perlu Dikirim', filter: r => r.statusOrder.toLowerCase() === 'to ship', cols: ['orderId', 'productName', 'totalQuantity'] },
        'AKAN DIKIRIM.PCS': { label: 'Perlu Dikirim (PCS)', filter: r => r.statusOrder.toLowerCase() === 'to ship', cols: ['orderId', 'productName', 'totalQuantity'] },
        'SUDAH CAIR.Order': { label: 'Dana Diterima', filter: r => r.totalSettlementAmount > 0, cols: ['orderId', 'productName', 'totalQuantity', 'totalSettlementAmount'] },
        'SUDAH CAIR.PCS': { label: 'Dana Diterima (PCS)', filter: r => r.totalSettlementAmount > 0, cols: ['orderId', 'productName', 'totalQuantity', 'totalSettlementAmount'] },
        'BELUM CAIR.Order': { label: 'Piutang Marketplace', filter: r => { const st = r.statusOrder.toLowerCase(); return ['completed', 'shipped', 'to ship'].includes(st) && r.totalSettlementAmount <= 0; }, cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'BELUM CAIR.PCS': { label: 'Piutang Marketplace (PCS)', filter: r => { const st = r.statusOrder.toLowerCase(); return ['completed', 'shipped', 'to ship'].includes(st) && r.totalSettlementAmount <= 0; }, cols: ['orderId', 'productName', 'totalQuantity', 'statusOrder'] },
        'LABA KOTOR': { label: 'Penerimaan Bersih', filter: r => r.totalSettlementAmount > 0, cols: ['orderId', 'productName', 'totalSettlementAmount'] },
        'LABA BERSIH': { label: 'Margin Kontribusi', filter: r => { const st = r.statusOrder.toLowerCase(); return !['canceled', 'cancelled', 'return', 'pengembalian'].includes(st) && r.totalSettlementAmount > 0; }, cols: ['orderId', 'productName', 'totalSettlementAmount', 'totalModal', '_laba'] },
        'Pengembalian.Order': { label: 'Pengembalian Paket', filter: r => r.statusOrder.toLowerCase() === 'pengembalian', cols: ['orderId', 'productName', 'totalQuantity'] },
        'Pengembalian.PCS': { label: 'Pengembalian Paket (PCS)', filter: r => r.statusOrder.toLowerCase() === 'pengembalian', cols: ['orderId', 'productName', 'totalQuantity'] },
        'RETURN.Order': { label: 'Retur Penjualan', filter: r => r.statusOrder.toLowerCase() === 'return', cols: ['orderId', 'productName', 'totalQuantity'] },
        'ESTIMASI': { label: 'Persediaan Dalam Pengiriman', filter: r => { const st = r.statusOrder.toLowerCase(); return !['canceled', 'cancelled', 'return', 'pengembalian'].includes(st) && r.totalSettlementAmount <= 0; }, cols: ['orderId', 'productName', 'totalQuantity', 'totalModal'] },
        'AFFILIASI.Nominal': { label: 'Komisi Afiliasi', filter: r => (r.ketAffiliasi || '').toLowerCase() === 'affiliasi', cols: ['orderId', 'productName', 'totalQuantity', 'totalAffiliateCommission'] },
        'COD.Jumlah': { label: 'COD', filter: r => (r.metode || '').toLowerCase() === 'bayar di tempat', cols: ['orderId', 'productName', 'totalQuantity'] },
    }), []);

    const nonClickableCols = new Set(['AFFILIASI.Presentase', 'COD.Presentase', 'RETURN.Presentase']);

    const colHeaderLabels = { orderId: 'Order ID', productName: 'Produk', totalQuantity: 'Qty', statusOrder: 'Status', totalSettlementAmount: 'Penerimaan Bersih', totalModal: 'HPP', totalAffiliateCommission: 'Komisi Afiliasi', _laba: 'Margin Kontribusi' };

    const handleCellClick = (row, colKey) => {
        if (nonClickableCols.has(colKey)) return;
        const config = columnFilterMap[colKey];
        if (!config) return;
        const rawOrders = row._rawOrders || [];
        const filtered = rawOrders.filter(config.filter);
        if (filtered.length === 0) return;
        setDetailPopup({ title: config.label, date: row._primaryCol, orders: filtered, cols: config.cols });
    };

    const dataColumns = [
        'PESANAN.Order', 'PESANAN.PCS', 'CANCEL.Order', 'CANCEL.PCS', 'FIX TERBELI.Order', 'FIX TERBELI.PCS',
        'TERKIRIM.Order', 'TERKIRIM.PCS', 'AKAN DIKIRIM.Order', 'AKAN DIKIRIM.PCS', 'SUDAH CAIR.Order', 'SUDAH CAIR.PCS',
        'BELUM CAIR.Order', 'BELUM CAIR.PCS', 'LABA KOTOR', 'LABA BERSIH', 'Pengembalian.Order', 'Pengembalian.PCS',
        'RETURN.Order', 'RETURN.Presentase', 'ESTIMASI', 'AFFILIASI.Nominal', 'AFFILIASI.Presentase', 'COD.Jumlah', 'COD.Presentase'
    ];

    const thStyle = { fontSize: '0.6875rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', padding: '0.5rem 0.75rem' };
    const tdStyle = { fontSize: '0.75rem', textAlign: 'center', whiteSpace: 'nowrap', padding: '0.375rem 0.75rem', background: 'var(--bg-card)' };
    const summaryTdStyle = { ...tdStyle, fontWeight: 700, color: '#a78bfa', background: '#ede9fe' };
    // Sticky column styles for No and primary dimension columns
    const stickyNoTh = { ...thStyle, width: '3rem', position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-card)' };
    const stickyPrimaryTh = { ...thStyle, position: 'sticky', left: '3rem', zIndex: 3, background: 'var(--bg-card)', minWidth: '140px' };
    const stickyNoTd = { ...tdStyle, fontWeight: 600, color: 'var(--text-tertiary)', position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-card)' };
    const stickyPrimaryTd = { ...tdStyle, textAlign: 'left', fontWeight: 600, position: 'sticky', left: '3rem', zIndex: 1, background: 'var(--bg-card)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: hasSecondary ? 'normal' : 'nowrap' };
    const stickyNoSummary = { ...summaryTdStyle, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-card)' };
    const stickyPrimarySummary = { ...summaryTdStyle, position: 'sticky', left: '3rem', zIndex: 3, background: 'var(--bg-card)' };
    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    useEffect(() => {
        function handleResize() { setWindowWidth(window.innerWidth); }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth < 768;

    const [searchQuery, setSearchQuery] = useState('');
    const hasAnyFilter = Boolean(filterStartDate || filterEndDate || searchQuery.trim());
    const handleResetAllFilters = () => {
        setFilterStartDate('');
        setFilterEndDate('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // ─── Sorting ───────────────────────────────────────────────────
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    function requestSort(key) {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
        setCurrentPage(1);
    }
    const sortedTableData = useMemo(() => {
        if (!sortConfig.key) return tableData;
        const key = sortConfig.key;
        const dir = sortConfig.direction;
        return [...tableData].sort((a, b) => {
            let aVal = key === '_primaryCol' ? a._primaryCol : a[key];
            let bVal = key === '_primaryCol' ? b._primaryCol : b[key];
            // Parse numeric / currency values
            const toNum = v => {
                if (v == null) return 0;
                if (typeof v === 'number') return v;
                const s = v.toString().replace(/[^0-9.,-]+/g, '').replace(/\./g, '').replace(',', '.');
                const n = parseFloat(s);
                return isNaN(n) ? 0 : n;
            };
            // Percentage strings
            if (typeof aVal === 'string' && aVal.endsWith('%') && typeof bVal === 'string' && bVal.endsWith('%')) {
                const cmp = toNum(aVal) - toNum(bVal);
                return dir === 'asc' ? cmp : -cmp;
            }
            // Both numeric
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return dir === 'asc' ? aVal - bVal : bVal - aVal;
            }
            // Try numeric parse
            const aN = toNum(aVal);
            const bN = toNum(bVal);
            if (aN !== 0 || bN !== 0) {
                const cmp = aN - bN;
                return dir === 'asc' ? cmp : -cmp;
            }
            // String fallback
            const cmp = String(aVal || '').localeCompare(String(bVal || ''));
            return dir === 'asc' ? cmp : -cmp;
        });
    }, [tableData, sortConfig]);

    const filteredSortedTableData = useMemo(() => {
        if (!searchQuery.trim()) return sortedTableData;
        const q = searchQuery.toLowerCase();
        return sortedTableData.filter(r =>
            (r._primaryCol && r._primaryCol.toString().toLowerCase().includes(q)) ||
            (r._secondaryCol && r._secondaryCol.toString().toLowerCase().includes(q))
        );
    }, [sortedTableData, searchQuery]);
    function SortIcon({ columnKey }) {
        const s = 10;
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={s} style={{ opacity: 0.3, marginLeft: '2px', verticalAlign: 'middle' }} />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={s} style={{ color: '#a78bfa', marginLeft: '2px', verticalAlign: 'middle' }} />
            : <ArrowDown size={s} style={{ color: '#a78bfa', marginLeft: '2px', verticalAlign: 'middle' }} />;
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
                {/* Left: Icon + Title + Count Badge */}
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
                            <BarChart3 size={isMobile ? 15 : 17} strokeWidth={2.3} />
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
                            Analisis Pesanan
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
                        {filteredSortedTableData.length} {analysisMode === 'waktu' ? 'hari' : analysisMode.startsWith('provinsi') ? 'lokasi' : 'produk'}
                    </span>
                </div>

                {/* Right: Search Box (Pepet Kanan) + Dimension Selector + Date Filter + Reset + Export */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: isMobile ? 'stretch' : 'flex-end',
                }}>
                    {/* Search Box */}
                    <div style={{ position: 'relative', width: isMobile ? '100%' : '180px', flexShrink: 0 }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: searchQuery ? '#6366f1' : '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Cari..."
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
                                transition: 'all 0.15s ease',
                            }}
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.15rem', display: 'flex' }}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Dimension Selector */}
                    <select
                        value={analysisMode}
                        onChange={(e) => { setAnalysisMode(e.target.value); setCurrentPage(1); }}
                        style={{
                            height: '34px',
                            padding: '0 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#334155',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="waktu">Waktu</option>
                        <option value="provinsi">Provinsi</option>
                        <option value="provinsi_kota">Provinsi + Kota</option>
                        <option value="produk">Produk</option>
                        <option value="produk_var">Produk + Variasi</option>
                    </select>

                    {/* Date Range Picker */}
                    <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }} ref={popupRef}>
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
                                border: (filterStartDate || filterEndDate) ? '1px solid #6366f1' : '1px solid #e2e8f0',
                                background: (filterStartDate || filterEndDate) ? '#f5f3ff' : '#ffffff',
                                color: (filterStartDate || filterEndDate) ? '#6366f1' : '#334155',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Calendar size={13} style={{ color: (filterStartDate || filterEndDate) ? '#6366f1' : '#64748b' }} />
                            <span>{(filterStartDate && filterEndDate) ? (`${filterStartDate} — ${filterEndDate}`) : 'Tanggal'}</span>
                            {(filterStartDate || filterEndDate) && (
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
                                <DateRangePicker startDate={filterStartDate || null} endDate={filterEndDate || null} onChange={({ startDate, endDate }) => {
                                    setFilterStartDate(startDate); setFilterEndDate(endDate); setCurrentPage(1);
                                }} onClose={() => setShowDateRangePicker(false)} />
                            </div>
                        )}
                    </div>

                    {/* Reset Filters Button */}
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
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <RotateCcw size={12} />
                            <span>Reset</span>
                        </button>
                    )}

                    {!isMobile && <div style={{ height: '20px', width: '1px', background: '#e2e8f0', margin: '0 2px' }} />}

                    {/* Export Button */}
                    <button
                        onClick={handleDownloadExcel}
                        type="button"
                        style={{
                            height: '34px',
                            display: 'inline-flex',
                            alignItems: 'center',
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
                        }}
                    >
                        <Download size={13} />
                        <span>Download</span>
                    </button>
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
                                    <th rowSpan={2} style={{ ...stickyNoTh, cursor: 'pointer' }} onClick={() => requestSort('_idx')}>No</th>
                                    <th rowSpan={2} style={{ ...stickyPrimaryTh, cursor: 'pointer' }} onClick={() => requestSort('_primaryCol')}>
                                        {primaryColLabel} <SortIcon columnKey="_primaryCol" />
                                    </th>
                                    {[
                                        { label: 'PESANAN', span: 2, tip: 'Seluruh pesanan yang masuk pada periode ini' },
                                        { label: 'DIBATALKAN', span: 2, tip: 'Pesanan berstatus batal' },
                                        { label: 'PESANAN VALID', span: 2, tip: 'Pesanan selesai, dalam pengiriman, atau perlu dikirim (tidak termasuk batal/retur)' },
                                        { label: 'DALAM PENGIRIMAN', span: 2, tip: 'Pesanan berstatus dikirim (shipped), belum selesai' },
                                        { label: 'PERLU DIKIRIM', span: 2, tip: 'Pesanan menunggu pengiriman dari penjual (to ship)' },
                                        { label: 'DANA DITERIMA', span: 2, tip: 'Pesanan yang dana settlement-nya sudah masuk' },
                                        { label: 'PIUTANG MARKETPLACE', span: 2, tip: 'Pesanan valid yang dana settlement-nya belum diterima' },
                                        { label: 'PENERIMAAN BERSIH', span: 1, rowSpan: 2, sortKey: 'LABA KOTOR', tip: 'Net settlement: dana yang diterima dari marketplace setelah potongan komisi dan biaya platform' },
                                        { label: 'MARGIN KONTRIBUSI', span: 1, rowSpan: 2, sortKey: 'LABA BERSIH', tip: 'Penerimaan Bersih - HPP (sebelum biaya operasional lain seperti iklan, packing, gaji, dan pajak)' },
                                        { label: 'PENGEMBALIAN PAKET', span: 2, tip: 'Paket fisik yang dikembalikan ke penjual' },
                                        { label: 'RETUR PENJUALAN', span: 2, tip: 'Pesanan yang diretur/direfund oleh pembeli' },
                                        { label: 'PERSEDIAAN DALAM PENGIRIMAN', span: 1, rowSpan: 2, sortKey: 'ESTIMASI', tip: 'HPP barang pada pesanan yang masih dalam pengiriman dan dananya belum diterima' },
                                        { label: 'AFILIASI', span: 2, tip: 'Komisi afiliasi dan persentase order yang berasal dari afiliasi' },
                                        { label: 'COD', span: 2, tip: 'Cash on Delivery (bayar di tempat)' }
                                    ].map(({ label, span, rowSpan, sortKey, tip }) => (
                                        <th key={label} colSpan={span} rowSpan={rowSpan} title={tip} style={{ ...thStyle, cursor: sortKey ? 'pointer' : 'default' }}
                                            onClick={sortKey ? () => requestSort(sortKey) : undefined}>
                                            {label} {sortKey && <SortIcon columnKey={sortKey} />}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {/* Sub-headers for groups with span=2 — ordered: PESANAN, CANCEL, TERJUAL, TERKIRIM, AKAN DIKIRIM, SUDAH CAIR, BELUM CAIR, Pengembalian */}
                                    {[
                                        ['PESANAN.Order', 'Order'], ['PESANAN.PCS', 'PCS'],
                                        ['CANCEL.Order', 'Order'], ['CANCEL.PCS', 'PCS'],
                                        ['FIX TERBELI.Order', 'Order'], ['FIX TERBELI.PCS', 'PCS'],
                                        ['TERKIRIM.Order', 'Order'], ['TERKIRIM.PCS', 'PCS'],
                                        ['AKAN DIKIRIM.Order', 'Order'], ['AKAN DIKIRIM.PCS', 'PCS'],
                                        ['SUDAH CAIR.Order', 'Order'], ['SUDAH CAIR.PCS', 'PCS'],
                                        ['BELUM CAIR.Order', 'Order'], ['BELUM CAIR.PCS', 'PCS'],
                                        ['Pengembalian.Order', 'Order'], ['Pengembalian.PCS', 'PCS'],
                                    ].map(([key, label]) => (
                                        <th key={key} style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort(key)}>
                                            {label} <SortIcon columnKey={key} />
                                        </th>
                                    ))}
                                    {/* RETUR PENJUALAN: Order + % Order */}
                                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort('RETURN.Order')}>Order <SortIcon columnKey="RETURN.Order" /></th>
                                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort('RETURN.Presentase')}>% Order <SortIcon columnKey="RETURN.Presentase" /></th>
                                    {/* AFILIASI: Komisi + % Order */}
                                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort('AFFILIASI.Nominal')}>Komisi <SortIcon columnKey="AFFILIASI.Nominal" /></th>
                                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort('AFFILIASI.Presentase')}>% Order <SortIcon columnKey="AFFILIASI.Presentase" /></th>
                                    {/* COD: Order + % Order */}
                                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort('COD.Jumlah')}>Order <SortIcon columnKey="COD.Jumlah" /></th>
                                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => requestSort('COD.Presentase')}>% Order <SortIcon columnKey="COD.Presentase" /></th>
                                </tr>
                                {/* Summary Row */}
                                <tr style={{ background: 'var(--bg-card)' }}>
                                    <td style={stickyNoSummary}></td>
                                    <td style={stickyPrimarySummary}>Jumlah</td>
                                    {[
                                        summarySums ? summarySums['PESANAN.Order'] : 0,
                                        summarySums ? summarySums['PESANAN.PCS'] : 0,
                                        summarySums ? summarySums['CANCEL.Order'] : 0,
                                        summarySums ? summarySums['CANCEL.PCS'] : 0,
                                        summarySums ? summarySums['FIX TERBELI.Order'] : 0,
                                        summarySums ? summarySums['FIX TERBELI.PCS'] : 0,
                                        summarySums ? summarySums['TERKIRIM.Order'] : 0,
                                        summarySums ? summarySums['TERKIRIM.PCS'] : 0,
                                        summarySums ? summarySums['AKAN DIKIRIM.Order'] : 0,
                                        summarySums ? summarySums['AKAN DIKIRIM.PCS'] : 0,
                                        summarySums ? summarySums['SUDAH CAIR.Order'] : 0,
                                        summarySums ? summarySums['SUDAH CAIR.PCS'] : 0,
                                        summarySums ? summarySums['BELUM CAIR.Order'] : 0,
                                        summarySums ? summarySums['BELUM CAIR.PCS'] : 0,
                                        summarySums ? (summarySums['LABA KOTOR'] === 0 ? '0' : formatRupiah(summarySums['LABA KOTOR'])) : '0',
                                        summarySums ? (summarySums['LABA BERSIH'] === 0 ? '0' : formatRupiah(summarySums['LABA BERSIH'])) : '0',
                                        summarySums ? summarySums['Pengembalian.Order'] : 0,
                                        summarySums ? summarySums['Pengembalian.PCS'] : 0,
                                        summarySums ? summarySums['RETURN.Order'] : 0,
                                        summarySums ? summarySums['RETURN.Presentase'].toFixed(2) + '%' : '0.00%',
                                        summarySums ? (summarySums.ESTIMASI === 0 ? '0' : formatRupiah(summarySums.ESTIMASI)) : '0',
                                        summarySums ? (summarySums['AFFILIASI.Nominal'] === 0 ? '0' : formatRupiah(summarySums['AFFILIASI.Nominal'])) : '0',
                                        summarySums ? summarySums['AFFILIASI.Presentase'].toFixed(2) + '%' : '0.00%',
                                        summarySums ? summarySums['COD.Jumlah'] : 0,
                                        summarySums ? summarySums['COD.Presentase'].toFixed(2) + '%' : '0.00%',
                                    ].map((val, idx) => (
                                        <td key={idx} style={summaryTdStyle} title={val}>{val}</td>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <tr key={`skel-${i}`}>
                                            <td style={tdStyle}><div className="skeleton" style={{ height: '1rem', width: '1.5rem', margin: '0 auto' }}>&nbsp;</div></td>
                                            <td style={tdStyle}><div className="skeleton" style={{ height: '1rem', width: '80%' }}>&nbsp;</div></td>
                                            {dataColumns.map(col => (
                                                <td key={col} style={tdStyle}><div className="skeleton" style={{ height: '1rem', width: '70%', margin: '0 auto' }}>&nbsp;</div></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : sortedTableData.length === 0 ? (
                                    <tr>
                                        <td colSpan={35} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Tidak ada data untuk ditampilkan.</td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const totalPages = Math.ceil(sortedTableData.length / rowsPerPage);
                                        const safePage = Math.min(currentPage, totalPages || 1);
                                        const startIdx = (safePage - 1) * rowsPerPage;
                                        const pageData = filteredSortedTableData.slice(startIdx, startIdx + rowsPerPage);
                                        return pageData.map((row, i) => (
                                            <tr key={startIdx + i}>
                                                <td style={stickyNoTd}>{startIdx + i + 1}</td>
                                                <td style={stickyPrimaryTd} title={row._primaryCol + (row._secondaryCol ? ' — ' + row._secondaryCol : '')}>
                                                    <div>{row._primaryCol}</div>
                                                    {row._secondaryCol && <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontWeight: 400, marginTop: '1px' }}>{row._secondaryCol}</div>}
                                                </td>
                                                {dataColumns.map(col => {
                                                    const val = row[col];
                                                    const isPercentage = nonClickableCols.has(col);
                                                    const isZero = val === 0 || val === '0' || val === '0.00%';
                                                    const isClickable = !isPercentage && !isZero && columnFilterMap[col];
                                                    return (
                                                        <td key={col} style={{
                                                            ...tdStyle,
                                                            cursor: isClickable ? 'pointer' : 'default',
                                                            color: isClickable ? '#a78bfa' : undefined,
                                                        }}
                                                            onClick={isClickable ? () => handleCellClick(row, col) : undefined}
                                                            onMouseOver={isClickable ? e => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; } : undefined}
                                                            onMouseOut={isClickable ? e => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.background = 'transparent'; } : undefined}
                                                            title={isClickable ? `Klik untuk detail ${(columnFilterMap[col]?.label || col)}` : val}
                                                        >
                                                            {val}
                                                        </td>
                                                    );
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
                        const totalPages = Math.max(1, Math.ceil(filteredSortedTableData.length / rowsPerPage));
                        const safePage = Math.min(currentPage, totalPages);
                        const startIdx = (safePage - 1) * rowsPerPage;
                        const endIdx = Math.min(startIdx + rowsPerPage, filteredSortedTableData.length);
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
                                        {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span style={{ color: 'var(--text-tertiary)' }}>
                                        | {filteredSortedTableData.length > 0 ? `${startIdx + 1}–${endIdx}` : '0'} dari <strong style={{ color: 'var(--text-primary)' }}>{filteredSortedTableData.length}</strong>
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

            {/* Detail Popup Modal */}
            {detailPopup && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1.5rem', animation: 'fadeInUp 0.2s ease-out',
                }} onClick={() => setDetailPopup(null)}>
                    <div style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px',
                        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                    {detailPopup.title}
                                </h3>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                                    {detailPopup.date} — <span style={{ color: '#a78bfa', fontWeight: 600 }}>{detailPopup.orders.length} order</span>
                                </p>
                            </div>
                            <button onClick={() => setDetailPopup(null)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-tertiary)', padding: '0.375rem',
                                borderRadius: 'var(--radius-sm)', transition: 'color var(--transition-fast)',
                            }}
                                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseOut={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {/* Table */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
                            <table className="modern-table" style={{ margin: 0, borderRadius: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, width: '3rem' }}>No</th>
                                        {detailPopup.cols.map(c => (
                                            <th key={c} style={thStyle}>{colHeaderLabels[c] || c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailPopup.orders.map((order, idx) => (
                                        <tr key={order.orderId + '-' + idx} style={{ animation: `fadeInUp 0.2s ease ${idx * 30}ms both` }}>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                                            {detailPopup.cols.map(c => {
                                                let val;
                                                if (c === '_laba') {
                                                    val = formatRupiah((order.totalSettlementAmount || 0) - (order.totalModal || 0));
                                                } else if (['totalSettlementAmount', 'totalModal', 'totalAffiliateCommission'].includes(c)) {
                                                    val = formatRupiah(order[c] || 0);
                                                } else if (c === 'productName') {
                                                    val = (order[c] || '').length > 50 ? order[c].slice(0, 50) + '…' : (order[c] || '-');
                                                } else {
                                                    val = order[c] ?? '-';
                                                }
                                                if (c === 'orderId') {
                                                    return (
                                                        <td key={c} style={{ ...tdStyle, color: '#a78bfa', fontWeight: 600 }}>
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
                                                                    onClick={() => setOrderDetailPopup(order)}
                                                                    onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                                    onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                                                >{val}</span>
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                return <td key={c} style={{ ...tdStyle, textAlign: c === 'productName' ? 'left' : 'center' }} title={order[c]}>{val}</td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* Order Detail Popup (second-level) */}
            {orderDetailPopup && (() => {
                const order = orderDetailPopup;
                const products = order.orders || [];
                const statusLower = (order.statusOrder || '').toLowerCase();
                let headerBg = 'transparent', headerBorder = '1px solid var(--border-subtle)';
                if (['canceled', 'cancelled', 'return', 'pengembalian'].includes(statusLower)) {
                    headerBg = 'rgba(248, 113, 113, 0.15)'; headerBorder = '1px solid rgba(248, 113, 113, 0.3)';
                } else if (['completed', 'shipped'].includes(statusLower)) {
                    headerBg = 'rgba(52, 211, 153, 0.15)'; headerBorder = '1px solid rgba(52, 211, 153, 0.3)';
                } else if (statusLower === 'to ship') {
                    headerBg = 'rgba(96, 165, 250, 0.15)'; headerBorder = '1px solid rgba(96, 165, 250, 0.3)';
                }
                const getStatusColor = (s) => {
                    const sl = (s || '').toLowerCase();
                    if (['canceled', 'cancelled'].includes(sl)) return '#f87171';
                    if (sl === 'return') return '#fbbf24';
                    if (sl === 'pengembalian') return '#fb923c';
                    if (['completed', 'shipped'].includes(sl)) return '#34d399';
                    if (sl === 'to ship') return '#60a5fa';
                    return 'var(--text-primary)';
                };
                const handleCopy = (text, field) => {
                    navigator.clipboard.writeText(text);
                    setCopiedField(field);
                    setTimeout(() => setCopiedField(null), 2000);
                };
                const infoItems = [
                    { label: 'Status Order', value: order.statusOrder, style: { color: getStatusColor(order.statusOrder), fontWeight: 700 } },
                    { label: 'Qty Total', value: order.totalQuantity },
                    { label: 'Penerimaan Bersih', value: formatRupiah(order.totalSettlementAmount || 0) },
                    { label: 'HPP', value: order.totalModal ? formatRupiah(order.totalModal) : '-' },
                    { label: 'Margin Kontribusi', value: order.totalSettlementAmount > 0 && order.totalModal ? formatRupiah(order.totalSettlementAmount - order.totalModal) : '-' },
                    { label: 'Komisi Afiliasi', value: order.totalAffiliateCommission ? formatRupiah(order.totalAffiliateCommission) : '-' },
                    { label: 'Ket. Afiliasi', value: order.ketAffiliasi || '-' },
                    { label: 'Metode', value: order.metode || '-' },
                    { label: 'Username Pembeli', value: order.buyerUsername || '-' },
                    { label: 'Alamat Tujuan', value: [order.regencyAndCity, order.province].filter(Boolean).join(', ') || '-' },
                ];
                return (
                    <div onClick={() => setOrderDetailPopup(null)} style={{
                        position: 'fixed', inset: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1.5rem', animation: 'fadeInUp 0.2s ease-out',
                    }}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            width: '100%', maxWidth: '720px', maxHeight: '85vh', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '1rem 1.25rem', borderBottom: headerBorder, background: headerBg,
                            }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Detail Order</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => handleCopy(order.orderId, 'orderId')}
                                            title="Klik untuk copy ID Order">
                                            {order.orderId}
                                            {copiedField === 'orderId' ? <Check size={12} style={{ marginLeft: '0.25rem', color: '#34d399' }} /> : <Copy size={12} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />}
                                        </span>
                                        {order.trackingId && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', background: 'var(--bg-glass)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
                                                onClick={() => handleCopy(order.trackingId, 'trackingId')}
                                                title="Klik untuk copy Resi">
                                                Resi: {order.trackingId}
                                                {copiedField === 'trackingId' ? <Check size={12} style={{ marginLeft: '0.25rem', color: '#34d399' }} /> : <Copy size={12} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button type="button" onClick={() => setOrderDetailPopup(null)} style={{
                                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer',
                                    color: 'var(--text-secondary)', display: 'flex',
                                }}><X size={16} /></button>
                            </div>
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
                                                        const productName = p['Product Name'] || '';
                                                        const sellerSku = p['Seller SKU'] || '';
                                                        const variation = (p['Variation'] || '').toString().trim();
                                                        const qty = p['Quantity'] || 0;
                                                        const modalPerUnit = getModalForItem ? getModalForItem(p) : 0;
                                                        const modalDisplay = modalPerUnit > 0 ? formatRupiah(modalPerUnit) : '-';
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
                                    {infoItems.map(item => (
                                        <div key={item.label} style={{
                                            display: 'flex', flexDirection: 'column', gap: '0.125rem',
                                            padding: '0.5rem 0.75rem', background: 'var(--bg-glass)',
                                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</span>
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word', ...(item.style || {}) }}>{item.value || '-'}</span>
                                        </div>
                                    ))}
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

export default OlahanDataPesanan;