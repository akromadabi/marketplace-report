import { useMemo, useCallback, useRef, useEffect } from 'react';
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
        'package delivery failed': 'Gagal Kirim Paket', 'package rejected': 'Paket Ditolak',
    };
    if (translations[lowerVal]) return translations[lowerVal];
    for (const key in translations) if (lowerVal.includes(key)) return translations[key];
    return value.toString();
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

/**
 * Shared hook for processing order data.
 * Extracts the core data processing logic from OlahanDataPesanan so that
 * Dashboard and other components can reuse the exact same calculations.
 *
 * Returns:
 *   rangkumanData: array of processed order objects with correct status overrides,
 *                  modal, settlement, affiliate, etc.
 *   loading: boolean
 *   modalValues, setModalValues, saveAll, saveSingle: from useModalValues (for InputModal)
 */
export function useProcessedOrders(overrideStoreId) {
    const { activeStoreId } = useStore();
    const { getComputed, setComputed } = useDataCache();
    const storeId = overrideStoreId !== undefined ? overrideStoreId : activeStoreId;
    const { data: ordersData, loading: loadingOrders } = useApiData('orders', storeId);
    const { data: paymentsData, loading: loadingPayments } = useApiData('payments', storeId);
    const { data: returnData, loading: loadingReturns } = useApiData('returns', storeId);
    const { modalValues, setModalValues, loading: loadingModal, saveAll, saveSingle } = useModalValues(storeId);

    const loading = loadingOrders || loadingPayments || loadingReturns || loadingModal;

    // Build a fingerprint from raw data lengths to detect changes
    const dataFingerprint = `${ordersData.length}::${paymentsData.length}::${returnData.length}::${Object.keys(modalValues).length}::${storeId || 'all'}`;

    const normalizedPayments = useMemo(() => paymentsData.map(row => {
        const newRow = {};
        Object.entries(row).forEach(([k, v]) => {
            const lower = k.trim().toLowerCase();
            const standardKeys = {
                'order/adjustment id': 'Order/adjustment ID',
                'total settlement amount': 'Total settlement amount',
                'affiliate commission': 'Affiliate commission',
                'customer payment': 'Customer payment',
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
            const id = key ? p[key] : '';
            if (!id) return;
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(p);
        });
        return map;
    }, [normalizedPayments]);

    const ordersGroupedById = useMemo(() => {
        const map = new Map();
        ordersData.forEach(order => {
            const id = order['Order ID'] || '';
            if (!id) return;
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(order);
        });
        return map;
    }, [ordersData]);

    const returnStatusByOrderId = useMemo(() => {
        const map = new Map();
        returnData.forEach(r => {
            const orderId = r['Order ID'] || '';
            const returnStatus = (r['Return Status'] || '').toString().toLowerCase();
            if (!orderId) return;
            if (!map.has(orderId)) map.set(orderId, []);
            map.get(orderId).push(returnStatus);
        });
        return map;
    }, [returnData]);

    const getModalForItem = useCallback((order) => {
        const sellerSku = (order['Seller SKU'] || '').toString().trim();
        const skuId = (order['SKU ID'] || '').toString().trim();
        const variation = (order['Variation'] || '').toString().trim();
        const fullKey = `${sellerSku}||${skuId}||${variation}`;
        if (modalValues[fullKey]) {
            return parseInt(String(modalValues[fullKey]).replace(/[^0-9]/g, ''), 10) || 0;
        }
        if (modalValues[sellerSku]) {
            return parseInt(String(modalValues[sellerSku]).replace(/[^0-9]/g, ''), 10) || 0;
        }
        return 0;
    }, [modalValues]);

    const rangkumanData = useMemo(() => {
        const rows = [];
        for (const [orderId, orders] of ordersGroupedById.entries()) {
            const order = orders[0];
            const createdDateObj = parseIndonesianDateTime(order['Created Time']);
            if (!createdDateObj) continue;

            let totalQuantity = 0;
            let totalModal = 0;
            orders.forEach(o => {
                const qRaw = o['Quantity'];
                const q = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
                if (!isNaN(q)) totalQuantity += q;
                const modalPerUnit = getModalForItem(o);
                totalModal += modalPerUnit * (isNaN(q) ? 0 : q);
            });

            // Status override: same logic as OlahanDataPesanan
            let statusOrder = normalizeStatus(order['Order Status']);
            const returnStatuses = returnStatusByOrderId.get(orderId) || [];
            const hasReturnStatus = returnStatuses.some(rs => ['completed', 'in process', 'to process'].includes(rs));
            if (hasReturnStatus) statusOrder = 'Return';
            const cancelReasonRaw = order['Cancel Reason'];
            const paketGagalKirimRaw = cancelReasonRaw && cancelReasonRaw.toString().trim() !== '' ? cancelReasonRaw.toString() : '-';
            const paketGagalKirim = translatePaketGagalKirim(paketGagalKirimRaw);
            if (paketGagalKirim === 'Gagal Kirim Paket' || paketGagalKirim === 'Paket Ditolak') statusOrder = 'Pengembalian';

            const paymentsForOrder = paymentsByOrderId.get(orderId) || [];
            let totalSettlementAmount = 0, totalAffiliateCommission = 0, totalCustomerPayment = 0;
            paymentsForOrder.forEach(p => {
                const tsa = parseFloat(p['Total settlement amount']); if (!isNaN(tsa)) totalSettlementAmount += tsa;
                const aff = parseFloat(p['Affiliate commission']); if (!isNaN(aff)) totalAffiliateCommission += aff;
                const custPay = parseFloat(p['Customer payment']); if (!isNaN(custPay)) totalCustomerPayment += custPay;
            });

            rows.push({
                orderId,
                waktuPesananDibuat: createdDateObj,
                statusOrder,
                totalQuantity,
                totalSettlementAmount,
                totalAffiliateCommission,
                totalCustomerPayment,
                totalModal,
                metode: order['Payment Method'] || '',
                ketAffiliasi: totalAffiliateCommission > 0 ? 'YA' : (totalAffiliateCommission < 0 ? 'Affiliasi' : 'Tidak'),
                // Location fields
                regencyAndCity: (order['Regency and City'] || '').toString().trim(),
                district: (order['Districts'] || '').toString().trim(),
                detailAddress: (order['Detail Address'] || '').toString().trim(),
                province: (order['Province'] || '').toString().trim(),
                // Tracking & buyer
                trackingId: (order['Tracking ID'] || '').toString().trim(),
                buyerUsername: (order['Buyer Username'] || '').toString().trim(),
                // Product fields
                productName: (order['Product Name'] || '').toString().trim(),
                sellerSku: (order['Seller SKU'] || '').toString().trim(),
                variation: (order['Variation'] || '').toString().trim(),
                orders, // keep all line items for product-level aggregation
            });
        }
        return rows;
    }, [ordersGroupedById, paymentsByOrderId, getModalForItem, returnStatusByOrderId]);

    // Cache the computed result for instant access on remount
    const cacheKey = `processedOrders::${dataFingerprint}`;
    useEffect(() => {
        if (rangkumanData.length > 0) {
            setComputed(cacheKey, {
                rangkumanData, ordersData, paymentsData, returnData,
                modalValues, paymentsByOrderId, ordersGroupedById,
                returnStatusByOrderId, normalizedPayments,
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
    };
}
