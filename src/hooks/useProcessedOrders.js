import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApiData, useModalValues } from './useApiData';
import { useStore } from '../contexts/StoreContext';
import { useDataCache } from '../contexts/DataContext';

// Normalize status labels from Indonesian or English to lowercase English
const normalizeStatus = (status) => {
    if (!status) return '';
    const s = status.toString().trim().toLowerCase();
    const map = {
        'perlu dikirim': 'to ship', 'dikirim': 'shipped', 'dibatalkan': 'canceled',
        'selesai': 'completed', 'belum dibayar': 'unpaid', 'pengembalian': 'pengembalian',
        'return': 'return', 'canceled': 'canceled', 'cancelled': 'canceled',
        'shipped': 'shipped', 'completed': 'completed', 'to ship': 'to ship',
        'in transit': 'shipped', 'delivered': 'completed',
    };
    return map[s] || s;
};

const parseIndonesianDateTime = (dateTimeStr) => {
    if (typeof dateTimeStr !== 'string' || !dateTimeStr.trim()) return null;
    const [datePart, timePart = '00:00:00'] = dateTimeStr.trim().split(' ');
    const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);
    if ([hour, minute, second].some(isNaN)) return null;
    if (datePart.includes('-')) {
        const [year, month, day] = datePart.split('-').map(Number);
        if ([day, month, year].some(isNaN)) return null;
        return new Date(year, month - 1, day, hour, minute, second);
    }
    const [day, month, year] = datePart.split('/').map(Number);
    if ([day, month, year].some(isNaN)) return null;
    return new Date(year, month - 1, day, hour, minute, second);
};

const translatePaketGagalKirim = (value) => {
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
};

// ─── Province/City normalization (EN → ID) ───────────────────────────────
const PROVINCE_MAP = {
    'NORTH SUMATRA': 'SUMATERA UTARA', 'NORTH SUMATERA': 'SUMATERA UTARA',
    'SOUTH SUMATRA': 'SUMATERA SELATAN', 'SOUTH SUMATERA': 'SUMATERA SELATAN',
    'WEST SUMATRA': 'SUMATERA BARAT', 'WEST SUMATERA': 'SUMATERA BARAT',
    'NORTH KALIMANTAN': 'KALIMANTAN UTARA', 'SOUTH KALIMANTAN': 'KALIMANTAN SELATAN',
    'EAST KALIMANTAN': 'KALIMANTAN TIMUR', 'WEST KALIMANTAN': 'KALIMANTAN BARAT',
    'CENTRAL KALIMANTAN': 'KALIMANTAN TENGAH',
    'NORTH SULAWESI': 'SULAWESI UTARA', 'SOUTH SULAWESI': 'SULAWESI SELATAN',
    'SOUTHEAST SULAWESI': 'SULAWESI TENGGARA', 'CENTRAL SULAWESI': 'SULAWESI TENGAH',
    'WEST SULAWESI': 'SULAWESI BARAT',
    'EAST JAVA': 'JAWA TIMUR', 'WEST JAVA': 'JAWA BARAT', 'CENTRAL JAVA': 'JAWA TENGAH',
    'EAST NUSA TENGGARA': 'NUSA TENGGARA TIMUR', 'WEST NUSA TENGGARA': 'NUSA TENGGARA BARAT',
    'NORTH MALUKU': 'MALUKU UTARA',
    'BANGKA-BELITUNG ISLANDS': 'KEPULAUAN BANGKA BELITUNG',
    'BANGKA BELITUNG ISLANDS': 'KEPULAUAN BANGKA BELITUNG',
    'BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
    'RIAU ISLANDS': 'KEPULAUAN RIAU',
    'SPECIAL CAPITAL REGION OF JAKARTA': 'DKI JAKARTA', 'JAKARTA': 'DKI JAKARTA',
    'SPECIAL REGION OF YOGYAKARTA': 'DI YOGYAKARTA', 'YOGYAKARTA SPECIAL REGION': 'DI YOGYAKARTA',
    'YOGYAKARTA': 'DI YOGYAKARTA',
    'WEST PAPUA': 'PAPUA BARAT', 'HIGHLAND PAPUA': 'PAPUA PEGUNUNGAN',
    'SOUTH PAPUA': 'PAPUA SELATAN', 'CENTRAL PAPUA': 'PAPUA TENGAH',
    'SOUTHWEST PAPUA': 'PAPUA BARAT DAYA',
};

const normalizeProvince = (raw) => {
    if (!raw) return '';
    let s = raw.toString().trim();
    if (/[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F\u0E80-\u0EFF\u1100-\u11FF\u0900-\u097F]/.test(s)) {
        return 'TIDAK DIKETAHUI';
    }
    s = s.replace(/[+_]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    if (s.endsWith(' PROVINCE')) s = s.slice(0, -9).trim();
    return PROVINCE_MAP[s] || s;
};

const normalizeCity = (raw) => {
    if (!raw) return '';
    if (/[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F\u0E80-\u0EFF\u1100-\u11FF\u0900-\u097F]/.test(raw)) {
        return 'TIDAK DIKETAHUI';
    }
    let s = raw.toString().replace(/[+_]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    if (s.endsWith(' CITY')) return 'KOTA ' + s.slice(0, -5).trim();
    if (s.endsWith(' MUNICIPALITY')) return 'KOTA ' + s.slice(0, -13).trim();
    if (s.endsWith(' REGENCY')) return 'KABUPATEN ' + s.slice(0, -8).trim();
    if (s.endsWith(' DISTRICT')) return 'KABUPATEN ' + s.slice(0, -9).trim();
    const dirMap = [['NORTH ', ' UTARA'], ['SOUTH ', ' SELATAN'], ['EAST ', ' TIMUR'], ['WEST ', ' BARAT'], ['CENTRAL ', ' TENGAH']];
    for (const [en, id] of dirMap) if (s.startsWith(en)) return s.slice(en.length).trim() + id;
    return s;
};

export const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

export const formatIndonesianDateFromDateObj = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

/** Exported helper — used by RangkumanTransaksi for consistent date formatting */
export const formatIndonesianDateTime = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatRupiah = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '';
    return 'Rp' + number.toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

/**
 * Shared hook — processes all order data once and returns every field needed
 * by RangkumanTransaksi, OlahanDataPesanan, Dashboard, etc.
 * 
 * By centralising the computation here, we ensure it runs only ONCE per
 * data-change, regardless of how many components consume it.
 */
export function useProcessedOrders(overrideStoreId) {
    const { activeStoreId } = useStore();
    const { getComputed, setComputed } = useDataCache();
    const storeId = overrideStoreId !== undefined ? overrideStoreId : activeStoreId;

    const { data: ordersData, loading: loadingOrders } = useApiData('orders', storeId);
    const { data: paymentsData, loading: loadingPayments } = useApiData('payments', storeId);
    const { data: returnData, loading: loadingReturns } = useApiData('returns', storeId);
    const { data: pengembalianData, loading: loadingPengembalian } = useApiData('pengembalian', storeId);
    const { modalValues, setModalValues, loading: loadingModal, saveAll, saveSingle } = useModalValues(storeId);
    const [scanData, setScanData] = useState([]);
    useEffect(() => {
        fetch('/api/scan', { headers: { Accept: 'application/json' } })
            .then(r => r.ok ? r.json() : [])
            .then(d => setScanData(Array.isArray(d) ? d : []))
            .catch(() => { });
    }, []);

    const loading = loadingOrders || loadingPayments || loadingReturns || loadingPengembalian || loadingModal;

    const dataFingerprint = `${ordersData.length}::${paymentsData.length}::${returnData.length}::${pengembalianData.length}::${Object.keys(modalValues).length}::${scanData.length}::${storeId || 'all'}`;

    // ─── Payments normalization ───────────────────────────────────────────
    const normalizedPayments = useMemo(() => paymentsData.map(row => {
        const newRow = {};
        Object.entries(row).forEach(([k, v]) => {
            const lower = k.trim().toLowerCase();
            const standardKeys = {
                'order/adjustment id': 'Order/adjustment ID',
                'no. pesanan': 'Order/adjustment ID',
                'total settlement amount': 'Total settlement amount',
                'total penghasilan': 'Total settlement amount',
                'affiliate commission': 'Affiliate commission',
                'komisi affiliate': 'Affiliate commission',
                'customer payment': 'Customer payment',
                'total pembayaran pembeli': 'Customer payment',
                'return shipping costs (passed on to the customer)': 'Return shipping costs (passed on to the customer)',
            };
            newRow[standardKeys[lower] || k.trim()] = v;
        });
        return newRow;
    }), [paymentsData]);

    const paymentsByOrderId = useMemo(() => {
        const map = new Map();
        normalizedPayments.forEach(p => {
            const key = Object.keys(p).find(k => k.toLowerCase() === 'order/adjustment id');
            const id = key && p[key] != null ? p[key].toString().trim() : '';
            if (!id) return;
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(p);
        });
        return map;
    }, [normalizedPayments]);

    const ordersGroupedById = useMemo(() => {
        const map = new Map();
        ordersData.forEach(order => {
            const id = order['Order ID'] != null ? order['Order ID'].toString().trim() : '';
            if (!id) return;
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(order);
        });
        return map;
    }, [ordersData]);

    const returnStatusByOrderId = useMemo(() => {
        const map = new Map();
        returnData.forEach(r => {
            const orderId = r['Order ID'] != null ? r['Order ID'].toString().trim() : '';
            const returnStatus = (r['Return Status'] || '').toString().toLowerCase();
            if (!orderId) return;
            if (!map.has(orderId)) map.set(orderId, []);
            map.get(orderId).push(returnStatus);
        });
        return map;
    }, [returnData]);

    // ─── Pengembalian sets & maps ─────────────────────────────────────────
    const pengembalianResiSet = useMemo(() => {
        const set = new Set();
        for (const row of pengembalianData) {
            const resiKey = Object.keys(row).find(k => k.toLowerCase().includes('resi'));
            if (resiKey && row[resiKey]) set.add(row[resiKey].toString().trim());
        }
        for (const s of scanData) {
            if (s.resi) set.add(s.resi.toString().trim());
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
            const orderId = (row['Order ID'] || '').toString().trim();
            if (!orderId) continue;
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs)) continue;
            const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();
            if (!trackingId) {
                if (!map.has(orderId)) map.set(orderId, '-');
            } else {
                map.set(orderId, pengembalianResiSet.has(trackingId) ? 'Diterima' : 'Belum Diterima');
            }
        }
        return map;
    }, [returnData, pengembalianResiSet]);

    const returnResiByOrderId = useMemo(() => {
        const map = new Map();
        for (const row of returnData) {
            const orderId = (row['Order ID'] || '').toString().trim();
            if (!orderId) continue;
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs)) continue;
            const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();
            if (trackingId) map.set(orderId, trackingId);
        }
        return map;
    }, [returnData]);

    const returnTimeByOrderId = useMemo(() => {
        const map = new Map();
        for (const row of returnData) {
            const orderId = (row['Order ID'] || '').toString().trim();
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

    // ─── Modal helper ─────────────────────────────────────────────────────
    const getModalForItem = useCallback((order) => {
        const sellerSku = (order['Seller SKU'] || '').toString().trim();
        const skuId = (order['SKU ID'] || '').toString().trim();
        const variation = (order['Variation'] || '').toString().trim();
        const fullKey = `${sellerSku}||${skuId}||${variation}`;
        if (modalValues[fullKey]) return parseInt(String(modalValues[fullKey]).replace(/[^0-9]/g, ''), 10) || 0;
        if (sellerSku && modalValues[sellerSku]) return parseInt(String(modalValues[sellerSku]).replace(/[^0-9]/g, ''), 10) || 0;
        if (!sellerSku) {
            const pName = (order['Product Name'] || '').toString().trim();
            if (pName) {
                const noSkuKey = '__NSKU__' + pName;
                const noSkuVarKey = `${noSkuKey}||${skuId}||${variation}`;
                if (modalValues[noSkuVarKey]) return parseInt(String(modalValues[noSkuVarKey]).replace(/[^0-9]/g, ''), 10) || 0;
                if (modalValues[noSkuKey]) return parseInt(String(modalValues[noSkuKey]).replace(/[^0-9]/g, ''), 10) || 0;
            }
        }
        return 0;
    }, [modalValues]);

    // ─── Core processing — runs once per data-change ──────────────────────
    const rangkumanData = useMemo(() => {
        const rows = [];
        for (const [orderId, orders] of ordersGroupedById.entries()) {
            const order = orders[0];
            const createdDateObj = parseIndonesianDateTime(order['Created Time']);
            if (!createdDateObj) continue;

            // ── Quantity & Modal ──
            let totalQuantity = 0;
            let totalModal = 0;
            orders.forEach(o => {
                const qRaw = o['Quantity'];
                const q = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
                if (!isNaN(q)) totalQuantity += q;
                totalModal += getModalForItem(o) * (isNaN(q) ? 0 : q);
            });

            // Modal valid if every item has an HPP entry
            const modalValid = orders.every(o => {
                const sellerSku = (o['Seller SKU'] || '').toString().trim();
                const skuId = (o['SKU ID'] || '').toString().trim();
                const variation = (o['Variation'] || '').toString().trim();
                const fullKey = `${sellerSku}||${skuId}||${variation}`;
                const pName = (o['Product Name'] || '').toString().trim();
                const noSkuKey = '__NSKU__' + pName;
                const noSkuVarKey = `${noSkuKey}||${skuId}||${variation}`;
                return !!(modalValues[fullKey] || modalValues[sellerSku] ||
                    (!sellerSku && pName && (modalValues[noSkuVarKey] || modalValues[noSkuKey])));
            });

            // ── Status ──
            let statusOrder = normalizeStatus(order['Order Status']);
            const returnStatuses = returnStatusByOrderId.get(orderId) || [];
            const hasReturnStatus = returnStatuses.some(rs => rs && !['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan'].includes(rs));
            if (hasReturnStatus) statusOrder = 'Return';
            const cancelReasonRaw = order['Cancel Reason'];
            const paketGagalKirimRaw = cancelReasonRaw && cancelReasonRaw.toString().trim() !== '' ? cancelReasonRaw.toString() : '-';
            const paketGagalKirim = translatePaketGagalKirim(paketGagalKirimRaw);
            if (paketGagalKirim === 'Gagal Kirim Paket' || paketGagalKirim === 'Paket Ditolak') statusOrder = 'Gagal Kirim';
            const statusLower = statusOrder.toLowerCase();

            // ── Payments ──
            const paymentsForOrder = paymentsByOrderId.get(orderId) || [];
            const parseAmount = (val) => {
                if (typeof val === 'number') return val;
                if (!val) return NaN;
                return parseFloat(val.toString().replace(/,/g, ''));
            };
            let totalSettlementAmount = 0, totalAffiliateCommission = 0, totalCustomerPayment = 0, menanggungOngkirTotal = 0;
            paymentsForOrder.forEach(p => {
                const tsa = parseAmount(p['Total settlement amount']); if (!isNaN(tsa)) totalSettlementAmount += tsa;
                const aff = parseAmount(p['Affiliate commission']); if (!isNaN(aff)) totalAffiliateCommission += aff;
                const custPay = parseAmount(p['Customer payment']); if (!isNaN(custPay)) totalCustomerPayment += custPay;
                const ongkirRaw = p['Return shipping costs (passed on to the customer)'];
                const ongkir = typeof ongkirRaw === 'string' ? parseFloat(ongkirRaw.replace(/[^0-9.-]+/g, '')) : parseFloat(ongkirRaw);
                if (!isNaN(ongkir)) menanggungOngkirTotal += ongkir;
            });

            // ── Verifikasi Paket ──
            let verifikasiPaket = '-';
            if (statusLower === 'completed') {
                verifikasiPaket = '✓';
            } else if (['canceled', 'cancelled', 'gagal kirim'].includes(statusLower)) {
                const resi = (order['Tracking ID'] || '').toString().trim();
                if (!resi || resi === '-') verifikasiPaket = '✓';
                else if (pengembalianResiSet.has(resi)) verifikasiPaket = 'Diterima';
                else verifikasiPaket = 'Belum Diterima';
            } else if (statusLower === 'return') {
                verifikasiPaket = returnStatusBarangByOrderId.get(orderId) || '-';
            }

            // ── Times ──
            const shippedDateObj = parseIndonesianDateTime(order['Shipped Time']);
            const waktuPengiriman = shippedDateObj ? formatIndonesianDateTime(shippedDateObj) : '';
            const waktuPesananDibuat = formatIndonesianDateTime(createdDateObj);

            let waktuPengembalian = '-';
            if (paketGagalKirim === 'Paket Ditolak' || paketGagalKirim === 'Gagal Kirim Paket') {
                const cancelledDateObj = parseIndonesianDateTime(order['Cancelled Time']);
                waktuPengembalian = cancelledDateObj ? formatIndonesianDateTime(cancelledDateObj) : 'Dalam Proses';
            } else if (['canceled', 'cancelled'].includes(statusLower)) {
                waktuPengembalian = 'Cancel';
            }

            // ── Location & identity ──
            const regencyCity = normalizeCity((order['Regency and City'] || order['Kota / Kabupaten'] || order['Kota/Kabupaten'] || order['City'] || '').toString().trim());
            const province = normalizeProvince((order['Province'] || order['Provinsi'] || '').toString().trim());
            const customerName = order['Nama Penerima'] || order['Recipient'] || order['Username (Buyer)'] || order['Buyer Username'] || 'Unknown';
            const alamatText = regencyCity && province ? `${regencyCity}, ${province}` : regencyCity || province || '';
            const alamat = `${customerName}, ${alamatText}`;

            // ── Terkirim ──
            let terkirim = '';
            if (['canceled', 'cancelled'].includes(statusLower)) terkirim = 'Cancel';
            else if (statusLower === 'return') terkirim = 'Return';
            else if (statusLower === 'gagal kirim') terkirim = 'Gagal Kirim';
            else terkirim = order['Delivered Time'] && order['Delivered Time'].toString().trim() !== '' ? 'Terkirim' : 'Proses';

            // ── Effective modal & profit ──
            let effectiveModal = totalModal;
            let effectiveModalValid = modalValid;
            if (['canceled', 'cancelled'].includes(statusLower)) {
                effectiveModal = 0; effectiveModalValid = true;
            } else if (['return', 'gagal kirim'].includes(statusLower) && verifikasiPaket === 'Diterima') {
                effectiveModal = 0; effectiveModalValid = true;
            }
            let profitDisplay = '';
            if (['canceled', 'cancelled'].includes(statusLower)) profitDisplay = 'CANCEL';
            else if (statusLower === 'gagal kirim') profitDisplay = 'Gagal Kirim';
            else if (totalSettlementAmount === 0) profitDisplay = 'Belum Cair';
            else profitDisplay = effectiveModalValid ? formatRupiah(totalSettlementAmount - effectiveModal) : 'HPP Belum Diinput';

            // ── Resi ──
            const resiDisplay = (statusLower === 'return' && returnResiByOrderId.has(orderId))
                ? returnResiByOrderId.get(orderId)
                : (order['Tracking ID'] || '-');

            rows.push({
                orderId,
                // Date objects (for filtering / charting)
                waktuPesananDibuatObj: createdDateObj,
                // Formatted strings (for table display in RangkumanTransaksi)
                waktuPesananDibuat,
                waktuPengiriman,
                waktuPengembalian,
                statusOrder,
                paketGagalKirim,
                totalQuantity,
                totalSettlementAmount,
                totalAffiliateCommission,
                totalCustomerPayment,
                menanggungOngkir: menanggungOngkirTotal > 0 ? formatRupiah(menanggungOngkirTotal) : '-',
                totalModal,
                modalValid,
                effectiveModal,
                effectiveModalValid,
                metode: order['Payment Method'] || '',
                ketAffiliasi: totalAffiliateCommission > 0 ? 'YA' : (totalAffiliateCommission < 0 ? 'Affiliasi' : 'Tidak'),
                // Location
                regencyAndCity: regencyCity,
                district: (order['Districts'] || '').toString().trim(),
                detailAddress: (order['Detail Address'] || '').toString().trim(),
                province,
                alamat,
                // Identity & tracking
                trackingId: (order['Tracking ID'] || '').toString().trim(),
                resi: resiDisplay,
                buyerUsername: (order['Buyer Username'] || '').toString().trim(),
                customerName,
                // Product
                productName: (order['Product Name'] || '').toString().trim(),
                sellerSku: (order['Seller SKU'] || '').toString().trim(),
                variation: (order['Variation'] || '').toString().trim(),
                orders, // keep line items for product-level aggregation
                // Ready-to-display values
                verifikasiPaket,
                terkirim,
                profitDisplay,
                hppDisplay: effectiveModalValid ? formatRupiah(effectiveModal) : 'HPP Belum Diinput',
                pencairanDisplay: formatRupiah(totalSettlementAmount),
                kerugian: verifikasiPaket === 'Belum Diterima' && modalValid && totalModal > 0 ? formatRupiah(totalModal) : '-',
                _hppRaw: modalValid ? totalModal : 0,
            });
        }
        return rows;
    }, [ordersGroupedById, paymentsByOrderId, getModalForItem, returnStatusByOrderId,
        pengembalianResiSet, returnStatusBarangByOrderId, returnResiByOrderId, modalValues]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cache the computed result for instant access on remount
    const cacheKey = `processedOrders::${dataFingerprint}`;
    useEffect(() => {
        if (rangkumanData.length > 0) {
            setComputed(cacheKey, {
                rangkumanData, ordersData, paymentsData, returnData,
                modalValues, paymentsByOrderId, ordersGroupedById,
                returnStatusByOrderId, normalizedPayments,
                pengembalianResiSet, returnStatusBarangByOrderId,
                returnResiByOrderId, pengembalianDateByResi, returnTimeByOrderId,
                scanData,
            });
        }
    }, [rangkumanData]); // eslint-disable-line react-hooks/exhaustive-deps

    // On first render, return cached result if available and data hasn't loaded yet
    const cachedResult = getComputed(cacheKey);
    if (loading && cachedResult && cachedResult.rangkumanData.length > 0) {
        return {
            ...cachedResult,
            loading: false,
            setModalValues,
            saveAll,
            saveSingle,
            getModalForItem,
        };
    }

    return {
        rangkumanData,
        loading,
        ordersData,
        paymentsData,
        returnData,
        modalValues,
        setModalValues,
        saveAll,
        saveSingle,
        paymentsByOrderId,
        ordersGroupedById,
        returnStatusByOrderId,
        getModalForItem,
        normalizedPayments,
        pengembalianResiSet,
        returnStatusBarangByOrderId,
        returnResiByOrderId,
        pengembalianDateByResi,
        returnTimeByOrderId,
        scanData,
    };
}
