import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClipboardList, Filter, ArrowUp, ArrowDown, ArrowUpDown, X, Download, CheckCircle, XCircle, Calendar, ChevronLeft, ChevronRight, Search, Copy, Check, FileText } from 'lucide-react';
import { useApiData, useModalValues } from '../hooks/useApiData';
import { useDataCache } from '../contexts/DataContext';

// Normalize status labels from Indonesian or English to lowercase English
const normalizeStatus = (status) => {
    if (!status) return '';
    const s = status.toString().trim().toLowerCase();
    const map = {
        'perlu dikirim': 'to ship',
        'dikirim': 'shipped',
        'dibatalkan': 'canceled',
        'selesai': 'completed',
        'belum dibayar': 'unpaid',
        'pengembalian': 'gagal kirim',
        'gagal kirim': 'gagal kirim',
        'return': 'return',
        'canceled': 'canceled',
        'cancelled': 'canceled',
        'shipped': 'shipped',
        'completed': 'completed',
        'to ship': 'to ship',
        'in transit': 'shipped',
        'delivered': 'completed',
    };
    return map[s] || s;
};

function RangkumanTransaksi() {
    const { getComputed, setComputed } = useDataCache();
    const { data: ordersData, loading: loadingOrders } = useApiData('orders');
    const { data: paymentsData, loading: loadingPayments } = useApiData('payments');
    const { data: returnData, loading: loadingReturns } = useApiData('returns');
    const { data: pengembalianData, loading: loadingPengembalian } = useApiData('pengembalian');
    const { modalValues, loading: loadingModal } = useModalValues();
    // ─── Fetch scan data (barcode-scanned resi) ──────────────────
    const [scanData, setScanData] = useState([]);
    const [loadingScan, setLoadingScan] = useState(true);
    const fetchScanData = useCallback(async () => {
        try {
            const res = await fetch('/api/scan', { headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const ct = res.headers.get('content-type');
                if (ct && ct.includes('application/json')) setScanData(await res.json());
            }
        } catch (err) { console.error('Fetch scan data error:', err); }
        setLoadingScan(false);
    }, []);
    useEffect(() => { fetchScanData(); }, [fetchScanData]);

    const isLoading = loadingOrders || loadingPayments || loadingReturns || loadingPengembalian || loadingModal || loadingScan;

    // Fingerprint to detect raw data changes
    const dataFingerprint = `rangkuman::${ordersData.length}::${paymentsData.length}::${returnData.length}::${pengembalianData.length}::${Object.keys(modalValues).length}::${scanData.length}`;
    const normalizedPayments = useMemo(() => paymentsData.map(row => {
        const newRow = {};
        Object.entries(row).forEach(([k, v]) => {
            const trimmed = k.trim();
            const lower = trimmed.toLowerCase();
            const standardKeys = {
                'order/adjustment id': 'Order/adjustment ID',
                'total settlement amount': 'Total settlement amount',
                'affiliate commission': 'Affiliate commission',
                'customer payment': 'Customer payment',
                'return shipping costs (passed on to the customer)': 'Return shipping costs (passed on to the customer)',
            };
            newRow[standardKeys[lower] || trimmed] = v;
        });
        return newRow;
    }), [paymentsData]);

    const paymentsByOrderId = useMemo(() => {
        const map = new Map();
        normalizedPayments.forEach(p => {
            const orderIdKey = Object.keys(p).find(k => k.toLowerCase() === 'order/adjustment id');
            const orderId = orderIdKey ? p[orderIdKey] : '';
            if (!orderId) return;
            if (!map.has(orderId)) map.set(orderId, []);
            map.get(orderId).push(p);
        });
        return map;
    }, [normalizedPayments]);

    const ordersGroupedById = useMemo(() => {
        const map = new Map();
        ordersData.forEach(order => {
            const orderId = order['Order ID'] || '';
            if (!orderId) return;
            if (!map.has(orderId)) map.set(orderId, []);
            map.get(orderId).push(order);
        });
        return map;
    }, [ordersData]);

    const normalizedReturnData = useMemo(() => returnData.map(row => {
        const newRow = {};
        Object.entries(row).forEach(([k, v]) => newRow[k.trim()] = v);
        return newRow;
    }), [returnData]);

    const returnStatusByOrderId = useMemo(() => {
        const map = new Map();
        normalizedReturnData.forEach(r => {
            const orderId = r['Order ID'] || '';
            const returnStatusRaw = r['Return Status'] || '';
            const returnStatus = returnStatusRaw.toString().toLowerCase();
            if (!orderId) return;
            if (!map.has(orderId)) map.set(orderId, []);
            map.get(orderId).push(returnStatus);
        });
        return map;
    }, [normalizedReturnData]);

    const pengembalianResiSet = useMemo(() => {
        const set = new Set();
        // From uploaded pengembalian file data
        for (const row of pengembalianData) {
            const resiKey = Object.keys(row).find(k => k.toLowerCase().includes('resi'));
            if (resiKey) {
                const val = row[resiKey];
                if (val && val.toString().trim() !== '') set.add(val.toString().trim());
            }
        }
        // From barcode-scanned resi data
        for (const s of scanData) {
            if (s.resi && s.resi.toString().trim() !== '') set.add(s.resi.toString().trim());
        }
        return set;
    }, [pengembalianData, scanData]);

    const pengembalianDateByResi = useMemo(() => {
        const map = new Map();
        for (const s of scanData) {
            if (s.resi && s.scan_date) map.set(s.resi.toString().trim(), s.scan_date);
        }
        for (const row of pengembalianData) {
            const resiKey = Object.keys(row).find(k => k.toLowerCase().includes('resi'));
            if (resiKey) {
                const resi = row[resiKey];
                const waktuKey = Object.keys(row).find(k => k.toLowerCase().includes('waktu pengembalian'));
                if (resi && waktuKey && row[waktuKey]) map.set(resi.toString().trim(), row[waktuKey].toString());
            }
        }
        return map;
    }, [pengembalianData, scanData]);

    const returnStatusBarangByOrderId = useMemo(() => {
        const map = new Map();
        for (const row of returnData) {
            const orderId = row['Order ID'] || '';
            if (!orderId) continue;
            // Skip rejected/cancelled return entries — they should not overwrite valid data
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs)) continue;
            const trackingId = row['Return Logistics Tracking ID'];
            if (!trackingId || trackingId.toString().trim() === '') {
                // Only set '-' if there's no better value already
                if (!map.has(orderId)) map.set(orderId, '-');
            } else {
                map.set(orderId, pengembalianResiSet.has(trackingId.toString().trim()) ? 'Diterima' : 'Belum Diterima');
            }
        }
        return map;
    }, [returnData, pengembalianResiSet]);

    // Map Order ID → Return Logistics Tracking ID (resi retur) for PDF export
    const returnResiByOrderId = useMemo(() => {
        const map = new Map();
        for (const row of returnData) {
            const orderId = row['Order ID'] || '';
            if (!orderId) continue;
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs)) continue;
            const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();
            if (trackingId) map.set(orderId, trackingId);
        }
        return map;
    }, [returnData]);

    // Map Order ID → Time Returned from scan data (for Tanggal Kembali on return orders)
    const returnTimeByOrderId = useMemo(() => {
        const map = new Map();
        for (const row of returnData) {
            const orderId = row['Order ID'] || '';
            const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();
            if (!orderId) continue;
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs)) continue;

            if (trackingId && pengembalianResiSet.has(trackingId)) {
                const dateStr = pengembalianDateByResi.get(trackingId);
                if (dateStr) {
                    const dateObj = parseIndonesianDateTime(dateStr);
                    map.set(orderId, dateObj ? formatIndonesianDateTime(dateObj) : dateStr);
                    continue;
                }
            }
            map.set(orderId, '-');
        }
        return map;
    }, [returnData, pengembalianResiSet, pengembalianDateByResi]);

    function formatRupiah(number) {
        if (typeof number !== 'number' || isNaN(number)) return '';
        return 'Rp' + number.toLocaleString('id-ID', { maximumFractionDigits: 0 });
    }

    function parseIndonesianDateTime(dateTimeStr) {
        if (typeof dateTimeStr !== 'string' || !dateTimeStr.trim()) return null;
        const parts = dateTimeStr.trim().split(' ');
        if (parts.length === 0) return null;
        const datePart = parts[0];
        const timePart = parts[1] || '00:00:00';
        const timeParts2 = timePart.split(':');
        const hour = timeParts2.length > 0 ? parseInt(timeParts2[0], 10) : 0;
        const minute = timeParts2.length > 1 ? parseInt(timeParts2[1], 10) : 0;
        const second = timeParts2.length > 2 ? parseInt(timeParts2[2], 10) : 0;
        if (isNaN(hour) || isNaN(minute) || isNaN(second)) return null;
        // Try YYYY-MM-DD format (Shopee)
        if (datePart.includes('-')) {
            const dp = datePart.split('-');
            if (dp.length !== 3) return null;
            const year = parseInt(dp[0], 10);
            const month = parseInt(dp[1], 10) - 1;
            const day = parseInt(dp[2], 10);
            if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
            return new Date(year, month, day, hour, minute, second);
        }
        // Try dd/mm/yyyy format (TikTok)
        const dateParts = datePart.split('/');
        if (dateParts.length !== 3) return null;
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        return new Date(year, month, day, hour, minute, second);
    }

    function formatIndonesianDateTime(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jumat", 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    function calculateTotalModalForOrderId(orderId) {
        const orders = ordersGroupedById.get(orderId);
        if (!orders || orders.length === 0) return NaN;
        let totalModal = 0;
        let modalValid = true;
        orders.forEach(order => {
            const quantityRaw = order['Quantity'];
            const quantity = typeof quantityRaw === 'string' ? parseInt(quantityRaw.replace(/\D/g, ''), 10) : Number(quantityRaw);
            if (isNaN(quantity) || quantity <= 0) { modalValid = false; return; }
            const sellerSku = (order['Seller SKU'] || '').toString().trim();
            const skuIdRaw = order['SKU ID'];
            const skuId = skuIdRaw !== undefined && skuIdRaw !== null ? skuIdRaw.toString().trim() : '';
            const variationRaw = order['Variation'];
            const variation = variationRaw !== undefined && variationRaw !== null ? variationRaw.toString().trim() : '';
            let modalValueStr = '';
            let foundModal = false;
            // Normal lookup: by variation key or sellerSku
            const variationKey = sellerSku + '||' + skuId + '||' + variation;
            if (modalValues && modalValues[variationKey]) { modalValueStr = modalValues[variationKey]; foundModal = true; }
            else if (modalValues && modalValues[sellerSku] && sellerSku) { modalValueStr = modalValues[sellerSku]; foundModal = true; }
            // Fallback for products without Seller SKU: use __NSKU__ + productName
            if (!foundModal && !sellerSku) {
                const pName = (order['Product Name'] || '').toString().trim();
                if (pName) {
                    const noSkuKey = '__NSKU__' + pName;
                    const noSkuVarKey = noSkuKey + '||' + skuId + '||' + variation;
                    if (modalValues && modalValues[noSkuVarKey]) { modalValueStr = modalValues[noSkuVarKey]; foundModal = true; }
                    else if (modalValues && modalValues[noSkuKey]) { modalValueStr = modalValues[noSkuKey]; foundModal = true; }
                }
            }
            if (!foundModal) { modalValid = false; return; }
            const modalValueNum = parseInt(modalValueStr.toString().replace(/[^0-9]/g, ''), 10);
            if (isNaN(modalValueNum)) { modalValid = false; return; }
            totalModal += quantity * modalValueNum;
        });
        if (!modalValid) return NaN;
        return totalModal;
    }

    function translatePaketGagalKirim(value) {
        if (!value) return '-';
        const lowerVal = value.toString().toLowerCase();
        const translations = {
            'lost': 'Hilang', 'damaged': 'Rusak', 'address not found': 'Alamat Tidak Ditemukan',
            'customer not available': 'Pelanggan Tidak Tersedia', 'failed delivery': 'Gagal Kirim',
            'returned to sender': 'Dikembalikan ke Pengirim', 'cancelled by customer': 'Dibatalkan oleh Pelanggan',
            'package delayed': 'Paket Tertunda', 'wrong address': 'Alamat Salah',
            'refused by customer': 'Ditolak oleh Pelanggan', 'other': 'Lainnya',
            'package delivery failed': 'Gagal Kirim Paket', 'package rejected': 'Paket Ditolak',
        };
        if (translations[lowerVal]) return translations[lowerVal];
        for (const key in translations) if (lowerVal.includes(key)) return translations[key];
        return value.toString();
    }

    // ─── Deferred data processing ────────────────────────────────────
    // Instead of a blocking useMemo that freezes the page, we process
    // data in a deferred useEffect so the page shell renders instantly.
    // On revisit, cached results display immediately.
    const [rawTableData, setRawTableData] = useState(() => {
        // Try cache first for instant display on revisit
        const cached = getComputed(dataFingerprint);
        return cached && cached.length > 0 ? cached : [];
    });
    const [dataProcessing, setDataProcessing] = useState(false);

    // Track which fingerprint we've processed to avoid re-running
    const processedFingerprintRef = useRef(null);

    useEffect(() => {
        // Skip if still loading raw data
        if (isLoading) return;
        // Skip if we already processed this fingerprint
        if (processedFingerprintRef.current === dataFingerprint) return;
        // Skip if no data to process
        if (ordersGroupedById.size === 0) {
            setRawTableData([]);
            processedFingerprintRef.current = dataFingerprint;
            return;
        }

        // Check cache first — instant display if available
        const cached = getComputed(dataFingerprint);
        if (cached && cached.length > 0) {
            setRawTableData(cached);
            processedFingerprintRef.current = dataFingerprint;
            return;
        }

        // Defer heavy processing so page shell paints first
        setDataProcessing(true);
        const timerId = setTimeout(() => {
            const rows = [];
            for (const [orderId, orders] of ordersGroupedById.entries()) {
                const totalModal = calculateTotalModalForOrderId(orderId);
                const modalValid = !isNaN(totalModal);
                const order = orders[0];
                const createdDateObj = parseIndonesianDateTime(order['Created Time']);
                const waktuPesananDibuat = createdDateObj ? formatIndonesianDateTime(createdDateObj) : '';
                const shippedDateObj = parseIndonesianDateTime(order['Shipped Time']);
                const waktuPengiriman = shippedDateObj ? formatIndonesianDateTime(shippedDateObj) : '';
                let totalQuantity = 0;
                orders.forEach(o => {
                    const quantityRaw = o['Quantity'];
                    const quantity = typeof quantityRaw === 'string' ? parseInt(quantityRaw.replace(/\D/g, ''), 10) : Number(quantityRaw);
                    if (!isNaN(quantity)) totalQuantity += quantity;
                });
                let statusOrder = normalizeStatus(order['Order Status']);
                const returnStatuses = returnStatusByOrderId.get(orderId) || [];
                const hasReturnStatus = returnStatuses.some(rs => rs && !['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs));
                if (hasReturnStatus) statusOrder = 'Return';
                const cancelReasonRaw = order['Cancel Reason'];
                const paketGagalKirimRaw = cancelReasonRaw && cancelReasonRaw.toString().trim() !== '' ? cancelReasonRaw.toString() : '-';
                const paketGagalKirim = translatePaketGagalKirim(paketGagalKirimRaw);
                if (paketGagalKirim === 'Gagal Kirim Paket' || paketGagalKirim === 'Paket Ditolak') statusOrder = 'Gagal Kirim';
                const paymentsForOrder = paymentsByOrderId.get(orderId) || [];
                let totalSettlementAmount = 0;
                paymentsForOrder.forEach(p => { const val = parseFloat(p['Total settlement amount']); if (!isNaN(val)) totalSettlementAmount += val; });
                let menanggungOngkirTotal = 0;
                paymentsForOrder.forEach(p => {
                    const val = p['Return shipping costs (passed on to the customer)'];
                    const numVal = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : parseFloat(val);
                    if (!isNaN(numVal)) menanggungOngkirTotal += numVal;
                });
                const menanggungOngkirDisplay = menanggungOngkirTotal > 0 ? formatRupiah(menanggungOngkirTotal) : '-';
                let totalAffiliateCommission = 0;
                paymentsForOrder.forEach(p => { const val = parseFloat(p['Affiliate commission']); if (!isNaN(val)) totalAffiliateCommission += val; });
                let ketAffiliasi = 'YA';
                if (totalAffiliateCommission === 0) ketAffiliasi = 'Tidak';
                else if (totalAffiliateCommission < 0) ketAffiliasi = 'Affiliasi';
                let totalCustomerPayment = 0;
                paymentsForOrder.forEach(p => { const val = parseFloat(p['Customer payment']); if (!isNaN(val)) totalCustomerPayment += val; });
                const metode = order['Payment Method'] || '';
                const regencyCity = order['Regency and City'] || '';
                const province = order['Province'] || '';
                const alamat = regencyCity && province ? `${regencyCity}, ${province}` : regencyCity || province || '';
                let terkirim = '';
                const statusLower = statusOrder.toLowerCase();
                if (['canceled', 'cancelled'].includes(statusLower)) terkirim = 'Cancel';
                else if (statusLower === 'return') terkirim = 'Return';
                else if (statusLower === 'gagal kirim') terkirim = 'Gagal Kirim';
                else terkirim = order['Delivered Time'] && order['Delivered Time'].toString().trim() !== '' ? 'Terkirim' : 'Proses';
                let waktuPengembalian = '-';
                if (paketGagalKirim === 'Paket Ditolak' || paketGagalKirim === 'Gagal Kirim Paket') {
                    const cancelledDateObj = parseIndonesianDateTime(order['Cancelled Time']);
                    waktuPengembalian = cancelledDateObj ? formatIndonesianDateTime(cancelledDateObj) : 'Dalam Proses';
                } else if (['canceled', 'cancelled'].includes(statusLower) && !['Paket Ditolak', 'Gagal Kirim Paket'].includes(paketGagalKirim)) {
                    waktuPengembalian = 'Cancel';
                }
                let verifikasiPaketText = '-';
                let verifikasiPaketJSX = '-';
                if (statusLower === 'completed') {
                    // Selesai → langsung tanda centang
                    verifikasiPaketText = '✓';
                    verifikasiPaketJSX = (
                        <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Pesanan selesai">
                            <CheckCircle size={14} />
                        </span>
                    );
                } else if (['canceled', 'cancelled'].includes(statusLower) || statusLower === 'gagal kirim') {
                    // Canceled & Gagal Kirim → cocokkan resi pesanan langsung dengan resi pengembalian
                    const resi = (order['Tracking ID'] || '').toString().trim();
                    if (!resi || resi === '-') {
                        // Cancel tanpa resi → otomatis ✅
                        verifikasiPaketText = '✓';
                        verifikasiPaketJSX = (
                            <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Cancel tanpa resi">
                                <CheckCircle size={14} />
                            </span>
                        );
                    } else if (pengembalianResiSet.has(resi)) {
                        verifikasiPaketText = 'Diterima';
                        verifikasiPaketJSX = (
                            <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Resi ditemukan">
                                <CheckCircle size={14} />Diterima
                            </span>
                        );
                    } else {
                        verifikasiPaketText = 'Belum Diterima';
                        verifikasiPaketJSX = (
                            <span style={{ color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Resi tidak ditemukan">
                                <XCircle size={14} />Belum Diterima
                            </span>
                        );
                    }
                } else if (statusLower === 'return') {
                    // Retur → cari Order ID di data retur, ambil resi retur, cocokkan dengan pengembalian
                    const statusBarang = returnStatusBarangByOrderId.get(orderId) || '-';
                    if (statusBarang === 'Diterima') {
                        verifikasiPaketText = 'Diterima';
                        verifikasiPaketJSX = (
                            <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Resi retur ditemukan di Pengembalian">
                                <CheckCircle size={14} />Diterima
                            </span>
                        );
                    } else if (statusBarang === 'Belum Diterima') {
                        verifikasiPaketText = 'Belum Diterima';
                        verifikasiPaketJSX = (
                            <span style={{ color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Resi retur tidak ditemukan di Pengembalian">
                                <XCircle size={14} />Belum Diterima
                            </span>
                        );
                    }
                }
                // Determine effective modal based on status and verifikasi paket
                let effectiveModal = totalModal;
                let effectiveModalValid = modalValid;
                if (['canceled', 'cancelled'].includes(statusLower)) {
                    effectiveModal = 0;
                    effectiveModalValid = true;
                } else if (['return', 'gagal kirim'].includes(statusLower) && verifikasiPaketText === 'Diterima') {
                    effectiveModal = 0;
                    effectiveModalValid = true;
                }
                let profitDisplay = '';
                if (['canceled', 'cancelled'].includes(statusLower)) profitDisplay = 'CANCEL';
                else if (statusLower === 'gagal kirim') profitDisplay = 'Gagal Kirim';
                else {
                    if (totalSettlementAmount === 0) profitDisplay = 'Belum Cair';
                    else profitDisplay = effectiveModalValid ? formatRupiah(totalSettlementAmount - effectiveModal) : 'HPP Belum Diinput';
                }
                rows.push({
                    'ORDER ID': orderId, 'WAKTU PESANAN DIBUAT': waktuPesananDibuat, 'WAKTU PENGIRIMAN': waktuPengiriman,
                    'QTT': totalQuantity.toString(), 'STATUS ORDER': statusOrder,
                    'HPP': effectiveModalValid ? formatRupiah(effectiveModal) : 'HPP Belum Diinput',
                    '_hppRaw': modalValid ? totalModal : 0,
                    'PENCAIRAN': formatRupiah(totalSettlementAmount), 'LABA': profitDisplay,
                    'AFFILIASI': totalAffiliateCommission.toString(), 'KET AFFILIASI': ketAffiliasi,
                    'PEMBAYARAN CS': formatRupiah(totalCustomerPayment), 'METODE': metode, 'ALAMAT': alamat,
                    'TERKIRIM': terkirim, 'Menanggung Ongkir': menanggungOngkirDisplay,
                    'Alasan Cancel': paketGagalKirim, 'Waktu Pengembalian': waktuPengembalian,
                    'Resi': (statusLower === 'return' && returnResiByOrderId.has(orderId)) ? returnResiByOrderId.get(orderId) : (order['Tracking ID'] || '-'),
                    'Verifikasi Paket': { jsx: verifikasiPaketJSX, text: verifikasiPaketText },
                    'Kerugian': verifikasiPaketText === 'Belum Diterima' && modalValid && totalModal > 0 ? formatRupiah(totalModal) : '-',
                });
            }

            // Cache the processed result for future revisits
            setComputed(dataFingerprint, rows);
            processedFingerprintRef.current = dataFingerprint;
            setRawTableData(rows);
            setDataProcessing(false);
        }, 0);

        return () => clearTimeout(timerId);
    }, [isLoading, dataFingerprint, ordersGroupedById, paymentsByOrderId, modalValues, returnStatusByOrderId, pengembalianResiSet, returnStatusBarangByOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Effective loading: show skeleton if API still loading or if processing deferred data
    const effectiveTableData = rawTableData;
    const effectiveLoading = isLoading || (dataProcessing && rawTableData.length === 0);

    const [showOnlyCancel, setShowOnlyCancel] = useState(false);
    const [filterPaketGagalKirim, setFilterPaketGagalKirim] = useState('');
    const paketGagalKirimOptions = useMemo(() => {
        const setOptions = new Set();
        effectiveTableData.forEach(row => { const val = row['Alasan Cancel'] || '-'; if (val && val !== '-') setOptions.add(val); });
        return Array.from(setOptions).sort((a, b) => a.localeCompare(b));
    }, [effectiveTableData]);

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
    const [copiedField, setCopiedField] = useState(null);
    const [showPdfMenu, setShowPdfMenu] = useState(false);
    const [pdfChecked, setPdfChecked] = useState({ retur: false, gagal_kirim: false, cancel: false });
    const pdfMenuRef = useRef(null);

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
        }
        if (showPdfMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPdfMenu]);

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
                        return new Date(y, mIdx, d, parseInt(hm[0]||0), parseInt(hm[1]||0)).getTime();
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

    // Memoized unique values for all columns (computed once, not 19 times per render)
    const uniqueValuesByColumn = useMemo(() => {
        const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const result = {};
        const allCols = ['ORDER ID', 'WAKTU PESANAN DIBUAT', 'WAKTU PENGIRIMAN', 'QTT', 'STATUS ORDER', 'HPP', 'PENCAIRAN', 'LABA', 'AFFILIASI', 'KET AFFILIASI', 'PEMBAYARAN CS', 'METODE', 'ALAMAT', 'TERKIRIM', 'Menanggung Ongkir', 'Alasan Cancel', 'Waktu Pengembalian', 'Resi', 'Verifikasi Paket', 'Kerugian'];
        allCols.forEach(col => {
            const valuesSet = new Set();
            effectiveTableData.forEach(row => {
                let val = row[col];
                if (val !== undefined && val !== null) {
                    if (col === 'Verifikasi Paket') {
                        if (typeof val === 'object' && val !== null && 'text' in val) val = val.text;
                        else if (typeof val !== 'string') val = '';
                    } else val = val.toString();
                    const isDateTime = dayNamesIndo.some(day => val.includes(day)) && monthsIndo.some(month => val.includes(month));
                    if (isDateTime) {
                        const parts = val.split(' ');
                        if (parts.length >= 3) { const monthName = parts[2]; if (monthsIndo.includes(monthName)) { valuesSet.add(monthName); return; } }
                        valuesSet.add(val);
                    } else valuesSet.add(val);
                }
            });
            result[col] = Array.from(valuesSet).sort((a, b) => a.localeCompare(b));
        });
        return result;
    }, [effectiveTableData]);

    function getUniqueValuesForColumn(col) {
        return uniqueValuesByColumn[col] || [];
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
        return effectiveTableData.filter(row => {
            // Date range filter on WAKTU PESANAN DIBUAT
            if (filterStartDate || filterEndDate) {
                const dateStr = row['WAKTU PESANAN DIBUAT'];
                if (!dateStr) return false;
                // Format: "Kamis, 19 Desember 2025 14:30"
                const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                const stripped = dateStr.replace(/^\S+,\s*/, ''); // remove "Kamis, " → "19 Desember 2025 14:30"
                const parts = stripped.split(' ');
                if (parts.length < 3) return false;
                const day = parseInt(parts[0], 10);
                const monthIdx = monthsIndo.indexOf(parts[1]);
                const year = parseInt(parts[2], 10);
                if (isNaN(day) || monthIdx < 0 || isNaN(year)) return false;
                const dateKey = `${year}-${(monthIdx + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                if (filterStartDate && dateKey < filterStartDate) return false;
                if (filterEndDate && dateKey > filterEndDate) return false;
            }
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const searchable = [
                    row['ORDER ID'], row['STATUS ORDER'], row['ALAMAT'],
                    row['METODE'], row['Resi'], row['Alasan Cancel'],
                    row['HPP'], row['PENCAIRAN'], row['LABA'],
                ].map(v => (v || '').toString().toLowerCase());
                if (!searchable.some(v => v.includes(q))) return false;
            }
            const hasCustomFilter = pdfChecked.retur || pdfChecked.gagal_kirim || pdfChecked.cancel;
            if (hasCustomFilter) {
                const status = (row['STATUS ORDER'] || '').toLowerCase();
                let matched = false;
                if (pdfChecked.retur && status === 'return') matched = true;
                if (pdfChecked.gagal_kirim && status === 'gagal kirim') matched = true;
                if (pdfChecked.cancel && ['canceled', 'cancelled'].includes(status)) matched = true;
                if (!matched) return false;
            }
            for (const [col, filterSet] of Object.entries(columnFilters)) {
                if (filterSet && filterSet.size > 0) {
                    let val = row[col];
                    if (col === 'Verifikasi Paket') {
                        if (typeof val === 'object' && val !== null && 'text' in val) val = val.text;
                        else if (typeof val !== 'string') val = '';
                    } else { if (val == null) val = ''; val = val.toString(); }
                    const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                    const isDateTime = dayNamesIndo.some(day => val.includes(day)) && monthsIndo.some(month => val.includes(month));
                    if (isDateTime) { const parts = val.split(' '); if (parts.length >= 3) { const monthName = parts[2]; if (monthsIndo.includes(monthName)) val = monthName; } }
                    if (!filterSet.has(val)) return false;
                }
            }
            return true;
        });
    }, [effectiveTableData, pdfChecked, columnFilters, filterStartDate, filterEndDate, searchQuery]);

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
        const key = sortConfig.key; const direction = sortConfig.direction;
        return [...filteredTableData].sort((a, b) => {
            let aVal = a[key]; let bVal = b[key];
            if (key === 'Verifikasi Paket') {
                if (typeof aVal === 'object' && aVal !== null && 'text' in aVal) aVal = aVal.text;
                if (typeof bVal === 'object' && bVal !== null && 'text' in bVal) bVal = bVal.text;
            }
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
                        if (dayNum && monthIndex >= 0 && yearNum && !isNaN(hour) && !isNaN(minute)) return new Date(yearNum, monthIndex, dayNum, hour, minute);
                    }
                }
                return null;
            }
            const aDate = parseDateForSort(aVal); const bDate = parseDateForSort(bVal);
            if (aDate && bDate) { const cmp = aDate - bDate; return direction === 'asc' ? cmp : -cmp; }
            const cmp = sortValues(aVal, bVal);
            return direction === 'asc' ? cmp : -cmp;
        });
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
    function getStatusStyle(val) {
        if (!val) return {};
        const lower = val.toString().toLowerCase();
        if (['canceled', 'cancelled', 'cancel'].includes(lower)) return { color: '#f87171', fontWeight: 600 };
        if (lower === 'return') return { color: '#fbbf24', fontWeight: 600 };
        if (lower === 'gagal kirim') return { color: '#fb923c', fontWeight: 600 };
        if (lower === 'completed' || lower === 'terkirim') return { color: '#34d399', fontWeight: 600 };
        if (lower === 'proses') return { color: '#60a5fa', fontWeight: 600 };
        return {};
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ClipboardList size={24} style={{ color: '#7c3aed' }} />
                        Rekap Transaksi
                    </h2>
                    <p>{sortedData.length.toLocaleString('id-ID')} transaksi</p>
                </div>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                {/* Search */}
                <div style={{ position: 'relative', minWidth: '200px', flex: '0 1 280px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: searchQuery ? '#a78bfa' : 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input
                        type="text" placeholder="Cari Order ID, Alamat, Resi..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        style={{
                            width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                            background: searchQuery ? 'rgba(124,58,237,0.08)' : 'var(--bg-glass)',
                            color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 500,
                            outline: 'none', transition: 'border-color 0.2s, background 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#a78bfa'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                    />
                    {searchQuery && (
                        <button type="button" onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                            style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0.125rem', display: 'flex' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                {/* Date Range Filter */}
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
                        {filterStartDate && filterEndDate ? `${filterStartDate} — ${filterEndDate}` : 'Pilih Rentang Tanggal'}
                    </button>
                    {showDateRangePicker && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 999, marginTop: '0.5rem' }}>
                            <DateRangePicker startDate={filterStartDate} endDate={filterEndDate}
                                onChange={({ startDate, endDate }) => { setFilterStartDate(startDate); setFilterEndDate(endDate); setCurrentPage(1); }}
                                onClose={() => setShowDateRangePicker(false)} />
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem', height: '36px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginRight: '0.25rem' }}>FILTER:</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={pdfChecked.retur} onChange={e => setPdfChecked({...pdfChecked, retur: e.target.checked})} style={{ accentColor: '#3b82f6', width: '0.875rem', height: '0.875rem' }} />
                        <span>🔄 Retur</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={pdfChecked.gagal_kirim} onChange={e => setPdfChecked({...pdfChecked, gagal_kirim: e.target.checked})} style={{ accentColor: '#f97316', width: '0.875rem', height: '0.875rem' }} />
                        <span>🚚 Gagal Kirim</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={pdfChecked.cancel} onChange={e => setPdfChecked({...pdfChecked, cancel: e.target.checked})} style={{ accentColor: '#ef4444', width: '0.875rem', height: '0.875rem' }} />
                        <span>❌ Cancel</span>
                    </label>
                </div>
                <button
                    onClick={() => {
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
                    className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                    type="button"
                >
                    <Download size={14} /> Download Laporan Pengembalian
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
                            <button type="button" onClick={() => {
                                setShowPdfMenu(false);
                                handleDownloadVerifikasiPdf('semua');
                            }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                                    color: 'var(--text-primary)', textAlign: 'left',
                                }}
                                onMouseEnter={e => e.target.style.background = 'var(--bg-glass)'}
                                onMouseLeave={e => e.target.style.background = 'none'}>
                                📦 Semua
                            </button>
                            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                            <button type="button" onClick={() => {
                                setShowPdfMenu(false);
                                handleDownloadVerifikasiPdf('belum');
                            }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                                    color: '#f59e0b', textAlign: 'left',
                                }}
                                onMouseEnter={e => e.target.style.background = 'rgba(245,158,11,0.08)'}
                                onMouseLeave={e => e.target.style.background = 'none'}>
                                ⏳ Belum Diterima
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
                                    {columns.map(col => {
                                        const uniqueValues = getUniqueValuesForColumn(col);
                                        const selectedValues = columnFilters[col] || new Set();
                                        const isFilterActive = selectedValues.size > 0;
                                        return (
                                            <th key={col} style={{ position: 'relative' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <span onClick={() => requestSort(col)} style={{ cursor: 'pointer', flex: 1, userSelect: 'none' }}>{col}</span>
                                                    <button type="button" onClick={e => { e.stopPropagation(); setFilterPopupOpen(filterPopupOpen === col ? null : col); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isFilterActive ? '#a78bfa' : 'var(--text-tertiary)' }}>
                                                        <Filter size={11} />
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
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <tr key={`skel-${i}`}>
                                            <td><div className="skeleton" style={{ height: '1rem', width: '1.5rem' }}>&nbsp;</div></td>
                                            {columns.map(col => (
                                                <td key={col}><div className="skeleton" style={{ height: '1rem', width: `${40 + Math.random() * 60}%` }}>&nbsp;</div></td>
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
                                                <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{startIdx + i + 1}</td>
                                                {columns.map(col => {
                                                    if (col === 'ORDER ID') {
                                                        return (
                                                            <td key={col} title="Klik untuk detail"
                                                                onClick={() => setSelectedRow(row)}
                                                                style={{ cursor: 'pointer', color: '#a78bfa', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(167,139,250,0.3)' }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#c4b5fd'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#a78bfa'}>
                                                                {row[col]}
                                                            </td>
                                                        );
                                                    }
                                                    if (col === 'Verifikasi Paket') {
                                                        if (typeof row[col] === 'string') return <td key={col} title={row[col]}>{row[col]}</td>;
                                                        if (typeof row[col] === 'object' && row[col] !== null && 'jsx' in row[col]) return <td key={col}>{row[col].jsx}</td>;
                                                        return <td key={col}>-</td>;
                                                    }
                                                    if (col && typeof col === 'string' && col.trim().toLowerCase() === 'resi') {
                                                        const resiVal = row['Resi'] || row['RESI'] || row[col];
                                                        if (resiVal && resiVal.toString().trim() !== '-' && resiVal.toString().trim() !== '') {
                                                            return (
                                                                <td key={col} title="Tampilkan QR Code"
                                                                    onClick={(e) => { e.stopPropagation(); setQrPopupResi(resiVal.toString().trim()); }}
                                                                    style={{ cursor: 'pointer', color: '#818cf8', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(129,140,248,0.3)' }}
                                                                    onMouseEnter={e => e.currentTarget.style.color = '#c4b5fd'}
                                                                    onMouseLeave={e => e.currentTarget.style.color = '#818cf8'}>
                                                                    {resiVal}
                                                                </td>
                                                            );
                                                        }
                                                    }
                                                    if (col === 'STATUS ORDER' || col === 'TERKIRIM') {
                                                        return <td key={col} title={row[col]} style={getStatusStyle(row[col])}>{row[col]}</td>;
                                                    }
                                                    if (col === 'PROFIT') {
                                                        const profitVal = row[col];
                                                        let profitStyle = {};
                                                        if (profitVal && profitVal.startsWith && profitVal.startsWith('Rp')) {
                                                            const num = parseFloat(profitVal.replace(/[^0-9.-]+/g, ''));
                                                            if (!isNaN(num)) profitStyle = { color: num >= 0 ? '#34d399' : '#f87171', fontWeight: 600 };
                                                        } else if (profitVal === 'CANCEL') profitStyle = { color: '#f87171', fontWeight: 600 };
                                                        else if (profitVal === 'Return' || profitVal === 'Gagal Kirim') profitStyle = { color: '#fbbf24', fontWeight: 600 };
                                                        else if (profitVal === 'Belum Cair') profitStyle = { color: '#60a5fa', fontWeight: 600 };
                                                        return <td key={col} title={row[col]} style={profitStyle}>{row[col]}</td>;
                                                    }
                                                    return <td key={col} title={row[col]}>{row[col]}</td>;
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
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                        gap: '0.75rem', marginTop: '1rem', padding: '0.75rem 1rem',
                        background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Tampilkan</span>
                            <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                style={{
                                    padding: '0.25rem 0.5rem', fontSize: '0.8125rem', fontWeight: 600,
                                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer',
                                }}>
                                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                | {sortedData.length > 0 ? `${startIdx + 1}–${endIdx}` : '0'} dari {sortedData.length.toLocaleString('id-ID')} transaksi
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
                                        return (
                                            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.5rem 0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{col}</span>
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>{val || '-'}</span>
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

export default RangkumanTransaksi;