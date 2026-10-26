import { useMemo, useCallback } from 'react';
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
    const { data: scanData } = useApiData('scan', storeId);
    const { modalValues, setModalValues, loading: loadingModal, saveAll, saveSingle } = useModalValues(storeId);

    const loading = loadingOrders || loadingPayments || loadingReturns || loadingPengembalian || loadingModal;

    // Pre-parse modal values into numeric map once
    const { numericModalMap, modalHash } = useMemo(() => {
        const map = new Map();
        let sum = 0;
        if (!modalValues) return { numericModalMap: map, modalHash: '0_0' };
        for (const [k, v] of Object.entries(modalValues)) {
            const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
            if (n > 0) {
                map.set(k, n);
                sum += n;
            }
        }
        return { numericModalMap: map, modalHash: `${map.size}_${sum}` };
    }, [modalValues]);

    // ─── Modal helper ─────────────────────────────────────────────────────
    const getModalForItem = useCallback((order) => {
        const sellerSku = (order['Seller SKU'] || '').toString().trim();
        const skuId = (order['SKU ID'] || '').toString().trim();
        const variation = (order['Variation'] || '').toString().trim();
        const fullKey = `${sellerSku}||${skuId}||${variation}`;
        if (numericModalMap.has(fullKey)) return numericModalMap.get(fullKey);
        if (sellerSku && numericModalMap.has(sellerSku)) return numericModalMap.get(sellerSku);
        if (!sellerSku) {
            const pName = (order['Product Name'] || '').toString().trim();
            if (pName) {
                const noSkuKey = '__NSKU__' + pName;
                const noSkuVarKey = `${noSkuKey}||${skuId}||${variation}`;
                if (numericModalMap.has(noSkuVarKey)) return numericModalMap.get(noSkuVarKey);
                if (numericModalMap.has(noSkuKey)) return numericModalMap.get(noSkuKey);
            }
        }
        return 0;
    }, [numericModalMap]);

    const dataFingerprint = `${ordersData.length}::${paymentsData.length}::${returnData.length}::${pengembalianData.length}::${modalHash}::${scanData.length}::${storeId || 'all'}`;
    const cacheKey = `processedOrders::${dataFingerprint}`;

    const computedBundle = useMemo(() => {
        const existing = getComputed(cacheKey);
        if (existing && existing.rangkumanData && existing.rangkumanData.length > 0) {
            return existing;
        }

        const standardPaymentKeys = {
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

        const normalizedPayments = [];
        const paymentsByOrderId = new Map();
        for (let i = 0; i < paymentsData.length; i++) {
            const row = paymentsData[i];
            const newRow = {};
            for (const [k, v] of Object.entries(row)) {
                const trimmed = k.trim();
                const lower = trimmed.toLowerCase();
                newRow[standardPaymentKeys[lower] || trimmed] = v;
            }
            normalizedPayments.push(newRow);
            const rawId = newRow['Order/adjustment ID'];
            const id = rawId != null ? rawId.toString().trim() : '';
            if (id) {
                let arr = paymentsByOrderId.get(id);
                if (!arr) {
                    arr = [];
                    paymentsByOrderId.set(id, arr);
                }
                arr.push(newRow);
            }
        }

        const ordersGroupedById = new Map();
        for (let i = 0; i < ordersData.length; i++) {
            const order = ordersData[i];
            const id = order['Order ID'] != null ? order['Order ID'].toString().trim() : '';
            if (!id) continue;
            let arr = ordersGroupedById.get(id);
            if (!arr) {
                arr = [];
                ordersGroupedById.set(id, arr);
            }
            arr.push(order);
        }

        const returnStatusByOrderId = new Map();
        for (let i = 0; i < returnData.length; i++) {
            const r = returnData[i];
            const orderId = r['Order ID'] != null ? r['Order ID'].toString().trim() : '';
            if (!orderId) continue;
            const returnStatus = (r['Return Status'] || '').toString().toLowerCase();
            let arr = returnStatusByOrderId.get(orderId);
            if (!arr) {
                arr = [];
                returnStatusByOrderId.set(orderId, arr);
            }
            arr.push(returnStatus);
        }

        const pengembalianResiSet = new Set();
        const pengembalianDateByResi = new Map();
        for (let i = 0; i < scanData.length; i++) {
            const s = scanData[i];
            if (s.resi) {
                const rStr = s.resi.toString().trim();
                pengembalianResiSet.add(rStr);
                if (s.scan_date) pengembalianDateByResi.set(rStr, s.scan_date);
            }
        }
        for (let i = 0; i < pengembalianData.length; i++) {
            const row = pengembalianData[i];
            let resiVal = null;
            let waktuVal = null;
            for (const [k, v] of Object.entries(row)) {
                const lk = k.toLowerCase();
                if (!resiVal && lk.includes('resi') && v) resiVal = v.toString().trim();
                if (!waktuVal && lk.includes('waktu pengembalian') && v) waktuVal = v.toString();
            }
            if (resiVal) {
                pengembalianResiSet.add(resiVal);
                if (waktuVal) pengembalianDateByResi.set(resiVal, waktuVal);
            }
        }

        const returnStatusBarangByOrderId = new Map();
        const returnResiByOrderId = new Map();
        const returnTimeByOrderId = new Map();
        const ignoredReturnStatuses = new Set(['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan']);

        for (let i = 0; i < returnData.length; i++) {
            const row = returnData[i];
            const orderId = (row['Order ID'] || '').toString().trim();
            if (!orderId) continue;
            const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
            if (ignoredReturnStatuses.has(rs)) continue;
            const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();

            if (!trackingId) {
                if (!returnStatusBarangByOrderId.has(orderId)) returnStatusBarangByOrderId.set(orderId, '-');
            } else {
                const hasResi = pengembalianResiSet.has(trackingId);
                returnStatusBarangByOrderId.set(orderId, hasResi ? 'Diterima' : 'Belum Diterima');
                returnResiByOrderId.set(orderId, trackingId);
                if (hasResi) {
                    const dateStr = pengembalianDateByResi.get(trackingId);
                    if (dateStr) {
                        const dateObj = parseIndonesianDateTime(dateStr);
                        returnTimeByOrderId.set(orderId, dateObj ? formatIndonesianDateTime(dateObj) : dateStr);
                        continue;
                    }
                }
            }
            if (!returnTimeByOrderId.has(orderId)) returnTimeByOrderId.set(orderId, '-');
        }

        const parseAmount = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return NaN;
            return parseFloat(val.toString().replace(/,/g, ''));
        };

        const rangkumanData = [];
        for (const [orderId, orders] of ordersGroupedById.entries()) {
            const order = orders[0];
            const createdDateObj = parseIndonesianDateTime(order['Created Time']);
            if (!createdDateObj) continue;

            // ── Quantity & Modal ──
            let totalQuantity = 0;
            let totalModal = 0;
            let modalValid = true;
            for (let i = 0; i < orders.length; i++) {
                const o = orders[i];
                const qRaw = o['Quantity'];
                const q = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
                const qty = isNaN(q) ? 0 : q;
                totalQuantity += qty;
                const itemModal = getModalForItem(o);
                totalModal += itemModal * qty;
                if (modalValid && itemModal <= 0) {
                    modalValid = false;
                }
            }

            // ── Status ──
            let statusOrder = normalizeStatus(order['Order Status']);
            const returnStatuses = returnStatusByOrderId.get(orderId);
            if (returnStatuses && returnStatuses.some(rs => rs && !ignoredReturnStatuses.has(rs))) {
                statusOrder = 'Return';
            }
            const cancelReasonRaw = order['Cancel Reason'];
            const paketGagalKirimRaw = cancelReasonRaw && cancelReasonRaw.toString().trim() !== '' ? cancelReasonRaw.toString() : '-';
            const paketGagalKirim = translatePaketGagalKirim(paketGagalKirimRaw);
            if (paketGagalKirim === 'Gagal Kirim Paket' || paketGagalKirim === 'Paket Ditolak') statusOrder = 'Gagal Kirim';
            const statusLower = statusOrder.toLowerCase();

            // ── Payments ──
            const paymentsForOrder = paymentsByOrderId.get(orderId);
            let totalSettlementAmount = 0, totalAffiliateCommission = 0, totalCustomerPayment = 0, menanggungOngkirTotal = 0;
            if (paymentsForOrder) {
                for (let i = 0; i < paymentsForOrder.length; i++) {
                    const p = paymentsForOrder[i];
                    const tsa = parseAmount(p['Total settlement amount']); if (!isNaN(tsa)) totalSettlementAmount += tsa;
                    const aff = parseAmount(p['Affiliate commission']); if (!isNaN(aff)) totalAffiliateCommission += aff;
                    const custPay = parseAmount(p['Customer payment']); if (!isNaN(custPay)) totalCustomerPayment += custPay;
                    const ongkirRaw = p['Return shipping costs (passed on to the customer)'];
                    if (ongkirRaw) {
                        const ongkir = typeof ongkirRaw === 'string' ? parseFloat(ongkirRaw.replace(/[^0-9.-]+/g, '')) : parseFloat(ongkirRaw);
                        if (!isNaN(ongkir)) menanggungOngkirTotal += ongkir;
                    }
                }
            }

            // ── Verifikasi Paket ──
            let verifikasiPaket = '-';
            if (statusLower === 'completed') {
                verifikasiPaket = '✓';
            } else if (statusLower === 'canceled' || statusLower === 'cancelled' || statusLower === 'gagal kirim') {
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
            } else if (statusLower === 'canceled' || statusLower === 'cancelled') {
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
            if (statusLower === 'canceled' || statusLower === 'cancelled') terkirim = 'Cancel';
            else if (statusLower === 'return') terkirim = 'Return';
            else if (statusLower === 'gagal kirim') terkirim = 'Gagal Kirim';
            else terkirim = order['Delivered Time'] && order['Delivered Time'].toString().trim() !== '' ? 'Terkirim' : 'Proses';

            // ── Effective modal & profit ──
            let effectiveModal = totalModal;
            let effectiveModalValid = modalValid;
            if (statusLower === 'canceled' || statusLower === 'cancelled') {
                effectiveModal = 0; effectiveModalValid = true;
            } else if ((statusLower === 'return' || statusLower === 'gagal kirim') && verifikasiPaket === 'Diterima') {
                effectiveModal = 0; effectiveModalValid = true;
            }
            let profitDisplay = '';
            if (statusLower === 'canceled' || statusLower === 'cancelled') profitDisplay = 'CANCEL';
            else if (statusLower === 'gagal kirim') profitDisplay = 'Gagal Kirim';
            else if (totalSettlementAmount === 0) profitDisplay = 'Belum Cair';
            else profitDisplay = effectiveModalValid ? formatRupiah(totalSettlementAmount - effectiveModal) : 'HPP Belum Diinput';

            // ── Resi ──
            const resiDisplay = (statusLower === 'return' && returnResiByOrderId.has(orderId))
                ? returnResiByOrderId.get(orderId)
                : (order['Tracking ID'] || '-');

            rangkumanData.push({
                orderId,
                waktuPesananDibuatObj: createdDateObj,
                _dateKey: formatDateKey(createdDateObj),
                _timestamp: createdDateObj.getTime(),
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
                regencyAndCity: regencyCity,
                district: (order['Districts'] || '').toString().trim(),
                detailAddress: (order['Detail Address'] || '').toString().trim(),
                province,
                alamat,
                trackingId: (order['Tracking ID'] || '').toString().trim(),
                resi: resiDisplay,
                buyerUsername: (order['Buyer Username'] || '').toString().trim(),
                customerName,
                productName: (order['Product Name'] || '').toString().trim(),
                sellerSku: (order['Seller SKU'] || '').toString().trim(),
                variation: (order['Variation'] || '').toString().trim(),
                orders,
                verifikasiPaket,
                terkirim,
                profitDisplay,
                hppDisplay: effectiveModalValid ? formatRupiah(effectiveModal) : 'HPP Belum Diinput',
                pencairanDisplay: formatRupiah(totalSettlementAmount),
                kerugian: verifikasiPaket === 'Belum Diterima' && modalValid && totalModal > 0 ? formatRupiah(totalModal) : '-',
                _hppRaw: modalValid ? totalModal : 0,
            });
        }

        const result = {
            rangkumanData,
            ordersData,
            paymentsData,
            returnData,
            modalValues,
            paymentsByOrderId,
            ordersGroupedById,
            returnStatusByOrderId,
            normalizedPayments,
            pengembalianResiSet,
            returnStatusBarangByOrderId,
            returnResiByOrderId,
            pengembalianDateByResi,
            returnTimeByOrderId,
            scanData,
        };

        if (rangkumanData.length > 0) {
            setComputed(cacheKey, result);
        }
        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey, loading]);

    return {
        ...computedBundle,
        loading,
        modalValues,
        setModalValues,
        saveAll,
        saveSingle,
        getModalForItem,
    };
}
