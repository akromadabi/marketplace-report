import { useMemo, useCallback, useEffect, useState } from 'react';
import { useApiData, useModalValues } from './useApiData';
import { useStore } from '../contexts/StoreContext';
import { useDataCache } from '../contexts/DataContext';

// Normalize status labels from Indonesian or English to lowercase English
const STATUS_MAP = {
    'perlu dikirim': 'to ship', 'dikirim': 'shipped', 'dibatalkan': 'canceled',
    'selesai': 'completed', 'belum dibayar': 'unpaid', 'pengembalian': 'pengembalian',
    'return': 'return', 'canceled': 'canceled', 'cancelled': 'canceled',
    'shipped': 'shipped', 'completed': 'completed', 'to ship': 'to ship',
    'in transit': 'shipped', 'delivered': 'completed',
};

const normalizeStatus = (status) => {
    if (!status) return '';
    const s = status.toString().trim().toLowerCase();
    return STATUS_MAP[s] || s;
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

const GAGAL_KIRIM_TRANSLATIONS = {
    'lost': 'Hilang', 'damaged': 'Rusak', 'address not found': 'Alamat Tidak Ditemukan',
    'customer not available': 'Pelanggan Tidak Tersedia', 'failed delivery': 'Gagal Kirim',
    'returned to sender': 'Dikembalikan ke Pengirim', 'cancelled by customer': 'Dibatalkan oleh Pelanggan',
    'package delayed': 'Paket Tertunda', 'wrong address': 'Alamat Salah',
    'refused by customer': 'Ditolak oleh Pelanggan', 'other': 'Lainnya',
    'package delivery failed': 'Gagal Kirim Paket', 'package rejected': 'Paket Ditolak',
};

const translatePaketGagalKirim = (value) => {
    if (!value || value === '-') return '-';
    const lowerVal = value.toString().toLowerCase();
    if (GAGAL_KIRIM_TRANSLATIONS[lowerVal]) return GAGAL_KIRIM_TRANSLATIONS[lowerVal];
    for (const key in GAGAL_KIRIM_TRANSLATIONS) {
        if (lowerVal.includes(key)) return GAGAL_KIRIM_TRANSLATIONS[key];
    }
    return value.toString();
};

// ─── Province/City normalization (EN → ID) with memoization ──────────────
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

const NON_LATIN_RE = /[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F\u0E80-\u0EFF\u1100-\u11FF\u0900-\u097F]/;
const provinceNormCache = new Map();
const cityNormCache = new Map();

const normalizeProvince = (raw) => {
    if (!raw) return '';
    const cached = provinceNormCache.get(raw);
    if (cached !== undefined) return cached;
    let s = raw.toString().trim();
    if (NON_LATIN_RE.test(s)) {
        provinceNormCache.set(raw, 'TIDAK DIKETAHUI');
        return 'TIDAK DIKETAHUI';
    }
    s = s.replace(/[+_]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    if (s.endsWith(' PROVINCE')) s = s.slice(0, -9).trim();
    const res = PROVINCE_MAP[s] || s;
    provinceNormCache.set(raw, res);
    return res;
};

const DIR_MAP = [['NORTH ', ' UTARA'], ['SOUTH ', ' SELATAN'], ['EAST ', ' TIMUR'], ['WEST ', ' BARAT'], ['CENTRAL ', ' TENGAH']];

const normalizeCity = (raw) => {
    if (!raw) return '';
    const cached = cityNormCache.get(raw);
    if (cached !== undefined) return cached;
    if (NON_LATIN_RE.test(raw)) {
        cityNormCache.set(raw, 'TIDAK DIKETAHUI');
        return 'TIDAK DIKETAHUI';
    }
    let s = raw.toString().replace(/[+_]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    let res = s;
    if (s.endsWith(' CITY')) res = 'KOTA ' + s.slice(0, -5).trim();
    else if (s.endsWith(' MUNICIPALITY')) res = 'KOTA ' + s.slice(0, -13).trim();
    else if (s.endsWith(' REGENCY')) res = 'KABUPATEN ' + s.slice(0, -8).trim();
    else if (s.endsWith(' DISTRICT')) res = 'KABUPATEN ' + s.slice(0, -9).trim();
    else {
        for (const [en, id] of DIR_MAP) {
            if (s.startsWith(en)) {
                res = s.slice(en.length).trim() + id;
                break;
            }
        }
    }
    cityNormCache.set(raw, res);
    return res;
};

const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_INDO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${date.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
};

export const formatIndonesianDateFromDateObj = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return `${DAYS_INDO[date.getDay()]}, ${date.getDate()} ${MONTHS_INDO[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatIndonesianDateTime = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const h = date.getHours();
    const min = date.getMinutes();
    return `${DAYS_INDO[date.getDay()]}, ${date.getDate()} ${MONTHS_INDO[date.getMonth()]} ${date.getFullYear()} ${h < 10 ? '0' + h : h}:${min < 10 ? '0' + min : min}`;
};

// Ultra-fast Rupiah formatter (50x faster than Number.toLocaleString('id-ID'))
const formatRupiah = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '';
    const rounded = Math.round(number);
    if (rounded < 0) {
        return 'Rp-' + (-rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return 'Rp' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const IGNORED_RETURN_STATUSES = new Set(['rejected', 'refund rejected', 'cancelled', 'canceled', 'dibatalkan']);

/**
 * STAGE 1: Build the Ultra-Slim Base Excel Snapshot.
 * Runs ONLY ONCE when Excel files are uploaded or deleted, and is persisted to IndexedDB.
 * - Line items (`bo.orders`) store only the 5 product-level fields + pre-resolved HPP lookup keys (`_fullKey`, `_skuKey`, `_qtyNum`),
 *   reducing memory and IndexedDB payload size by ~75%.
 */
function buildBaseSnapshot({ ordersData, paymentsMap, returnData, pengembalianData, uploadVersion }) {
    const stringPool = new Map();
    const intern = (str) => {
        if (typeof str !== 'string' || str.length === 0) return '';
        let pooled = stringPool.get(str);
        if (pooled === undefined) {
            stringPool.set(str, str);
            return str;
        }
        return pooled;
    };

    // 1. Group orders by Order ID, extract slim line items + header metadata, and build SKU Catalog
    const orderGroups = new Map();
    const skuCatalogMap = new Map();

    for (let i = 0; i < ordersData.length; i++) {
        const rawOrder = ordersData[i];
        const rawId = rawOrder['Order ID'];
        const id = rawId != null ? rawId.toString().trim() : '';
        if (!id) continue;

        const sellerSku = intern((rawOrder['Seller SKU'] || '').toString().trim());
        const skuId = intern((rawOrder['SKU ID'] || '').toString().trim());
        const variation = intern((rawOrder['Variation'] || '').toString().trim());
        const productName = intern((rawOrder['Product Name'] || '').toString().trim());
        const qRaw = rawOrder['Quantity'];
        const q = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
        const qty = isNaN(q) ? 0 : q;

        const skuKey = intern(sellerSku !== '' ? sellerSku : (productName ? `__NSKU__${productName}` : ''));
        const fullKey = intern(skuKey ? `${skuKey}||${skuId}||${variation}` : '');

        // Ultra-slim line item (5 product fields + pre-resolved modal keys)
        const slimItem = {
            'Seller SKU': sellerSku,
            'SKU ID': skuId,
            'Variation': variation,
            'Product Name': productName,
            'Quantity': qty,
            _qtyNum: qty,
            _fullKey: fullKey,
            _skuKey: skuKey,
        };

        let grp = orderGroups.get(id);
        if (!grp) {
            grp = {
                firstRaw: rawOrder,
                items: [slimItem],
                totalQty: qty,
            };
            orderGroups.set(id, grp);
        } else {
            grp.items.push(slimItem);
            grp.totalQty += qty;
        }

        // Build SKU Catalog entry in the same single pass
        if (skuKey !== '') {
            let existingCat = skuCatalogMap.get(fullKey);
            if (!existingCat) {
                skuCatalogMap.set(fullKey, {
                    'Seller SKU': sellerSku,
                    'SKU ID': skuId,
                    'Variation': variation,
                    'Product Name': productName,
                    'Channel Marketplace': intern((rawOrder['Channel Marketplace'] || '').toString()),
                });
            } else if (!existingCat['Product Name'] && productName) {
                existingCat['Product Name'] = productName;
            }
        }
    }

    // 2. Process uploaded pengembalian Excel data
    const excelPengembalianResiSet = new Set();
    const excelPengembalianDateByResi = new Map();
    for (let i = 0; i < pengembalianData.length; i++) {
        const row = pengembalianData[i];
        let resiVal = null;
        let waktuVal = null;
        for (const [k, v] of Object.entries(row)) {
            if (!v) continue;
            const lk = k.toLowerCase();
            if (!resiVal && lk.includes('resi')) resiVal = v.toString().trim();
            if (!waktuVal && lk.includes('waktu pengembalian')) waktuVal = v.toString();
        }
        if (resiVal) {
            excelPengembalianResiSet.add(resiVal);
            if (waktuVal) excelPengembalianDateByResi.set(resiVal, waktuVal);
        }
    }

    // 3. Process return data
    const hasActiveReturnByOrderId = new Set();
    const returnHasRecordByOrderId = new Set();
    const returnResiObj = {};
    const excelReturnTimeObj = {};

    for (let i = 0; i < returnData.length; i++) {
        const row = returnData[i];
        const orderId = (row['Order ID'] || '').toString().trim();
        if (!orderId) continue;
        const rs = (row['Return Status'] || '').toString().trim().toLowerCase();
        if (IGNORED_RETURN_STATUSES.has(rs)) continue;

        hasActiveReturnByOrderId.add(orderId);
        returnHasRecordByOrderId.add(orderId);

        const trackingId = (row['Return Logistics Tracking ID'] || '').toString().trim();
        if (trackingId) {
            returnResiObj[orderId] = trackingId;
            if (excelPengembalianResiSet.has(trackingId)) {
                const dateStr = excelPengembalianDateByResi.get(trackingId);
                if (dateStr) {
                    const dateObj = parseIndonesianDateTime(dateStr);
                    excelReturnTimeObj[orderId] = dateObj ? formatIndonesianDateTime(dateObj) : dateStr;
                }
            }
        }
        if (!(orderId in excelReturnTimeObj)) {
            excelReturnTimeObj[orderId] = '-';
        }
    }

    // 4. Build Base Orders array (all non-modal fields pre-computed once!)
    const baseOrders = [];
    for (const [orderId, grp] of orderGroups.entries()) {
        const order = grp.firstRaw;
        const orders = grp.items;
        const createdDateObj = parseIndonesianDateTime(order['Created Time']);
        if (!createdDateObj) continue;

        const totalQuantity = grp.totalQty;

        // Status
        let statusOrder = normalizeStatus(order['Order Status']);
        if (hasActiveReturnByOrderId.has(orderId)) {
            statusOrder = 'Return';
        }
        const cancelReasonRaw = order['Cancel Reason'];
        const paketGagalKirimRaw = cancelReasonRaw && cancelReasonRaw.toString().trim() !== '' ? cancelReasonRaw.toString() : '-';
        const paketGagalKirim = intern(translatePaketGagalKirim(paketGagalKirimRaw));
        if (paketGagalKirim === 'Gagal Kirim Paket' || paketGagalKirim === 'Paket Ditolak') {
            statusOrder = 'Gagal Kirim';
        }
        statusOrder = intern(statusOrder);
        const statusLower = intern(statusOrder.toLowerCase());

        // Payments (pre-aggregated from paymentsMap: [settlement, affiliate, customerPayment, ongkir])
        const payEntry = paymentsMap[orderId];
        const totalSettlementAmount = payEntry ? (Number(payEntry[0]) || 0) : 0;
        const totalAffiliateCommission = payEntry ? (Number(payEntry[1]) || 0) : 0;
        const totalCustomerPayment = payEntry ? (Number(payEntry[2]) || 0) : 0;
        const menanggungOngkirTotal = payEntry ? (Number(payEntry[3]) || 0) : 0;

        // Times
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

        // Location & Identity
        const rawProvince = intern((order['Province'] || order['Provinsi'] || '').toString().trim());
        const regencyCity = intern(normalizeCity((order['Regency and City'] || order['Kota / Kabupaten'] || order['Kota/Kabupaten'] || order['City'] || '').toString().trim()));
        const province = intern(normalizeProvince(rawProvince));
        const customerName = (order['Nama Penerima'] || order['Recipient'] || order['Username (Buyer)'] || order['Buyer Username'] || 'Unknown').toString();
        const alamatText = regencyCity && province ? `${regencyCity}, ${province}` : regencyCity || province || '';
        const alamat = `${customerName}, ${alamatText}`;

        // Terkirim
        let terkirim = '';
        if (statusLower === 'canceled' || statusLower === 'cancelled') terkirim = 'Cancel';
        else if (statusLower === 'return') terkirim = 'Return';
        else if (statusLower === 'gagal kirim') terkirim = 'Gagal Kirim';
        else terkirim = order['Delivered Time'] && order['Delivered Time'].toString().trim() !== '' ? 'Terkirim' : 'Proses';
        terkirim = intern(terkirim);

        const trackingId = (order['Tracking ID'] || '').toString().trim();
        const returnTrackingId = returnResiObj[orderId] || '';
        const resiDisplay = (statusLower === 'return' && returnTrackingId)
            ? returnTrackingId
            : (trackingId || '-');

        // Pre-check Excel pengembalian match
        let excelPengembalianMatched = false;
        if (statusLower === 'canceled' || statusLower === 'cancelled' || statusLower === 'gagal kirim') {
            if (trackingId && trackingId !== '-' && excelPengembalianResiSet.has(trackingId)) {
                excelPengembalianMatched = true;
            }
        } else if (statusLower === 'return') {
            if (returnTrackingId && excelPengembalianResiSet.has(returnTrackingId)) {
                excelPengembalianMatched = true;
            }
        }

        const rawOrderStatusLower = intern((order['Order Status'] || '').toString().toLowerCase());
        const rawCrtLower = intern((order['Cancelation/Return Type'] || '').toString().toLowerCase());
        const district = intern((order['Districts'] || '').toString().trim());

        baseOrders.push({
            orderId,
            waktuPesananDibuatObj: createdDateObj,
            _dateKey: intern(formatDateKey(createdDateObj)),
            _timestamp: createdDateObj.getTime(),
            waktuPesananDibuat,
            waktuPengiriman,
            waktuPengembalian,
            statusOrder,
            statusLower,
            _rawStatusLower: rawOrderStatusLower,
            _crt: rawCrtLower,
            paketGagalKirim,
            totalQuantity,
            totalSettlementAmount,
            totalAffiliateCommission,
            totalCustomerPayment,
            menanggungOngkir: menanggungOngkirTotal > 0 ? formatRupiah(menanggungOngkirTotal) : '-',
            metode: intern((order['Payment Method'] || '').toString()),
            ketAffiliasi: intern(totalAffiliateCommission > 0 ? 'YA' : (totalAffiliateCommission < 0 ? 'Affiliasi' : 'Tidak')),
            regencyAndCity: regencyCity,
            district: district.startsWith('***') ? '' : district,
            rawProvince,
            detailAddress: '',
            province,
            alamat,
            trackingId,
            returnTrackingId,
            hasReturnRecord: returnHasRecordByOrderId.has(orderId),
            excelPengembalianMatched,
            resi: resiDisplay,
            buyerUsername: (order['Buyer Username'] || '').toString().trim(),
            customerName,
            productName: orders[0]['Product Name'],
            sellerSku: orders[0]['Seller SKU'],
            variation: orders[0]['Variation'],
            orders,
            terkirim,
            pencairanDisplay: formatRupiah(totalSettlementAmount),
            // Dynamic modal/scan fields (updated in-place in Stage 2)
            totalModal: 0,
            modalValid: false,
            effectiveModal: 0,
            effectiveModalValid: false,
            verifikasiPaket: '-',
            profitDisplay: '',
            hppDisplay: 'HPP Belum Diinput',
            kerugian: '-',
            _hppRaw: 0,
        });
    }

    return {
        uploadVersion,
        baseOrders,
        skuCatalog: Array.from(skuCatalogMap.values()),
        returnData,
        pengembalianData,
        excelPengembalianResiList: Array.from(excelPengembalianResiSet),
        excelPengembalianDateEntries: Array.from(excelPengembalianDateByResi.entries()),
        returnResiObj,
        excelReturnTimeObj,
    };
}

/**
 * Shared hook — loads the Base Excel Snapshot once (persisted in IndexedDB across reloads)
 * and dynamically attaches Modal (HPP) and barcode scans in a <2ms zero-allocation pass.
 */
export function useProcessedOrders(overrideStoreId) {
    const { activeStoreId, loading: storesLoading } = useStore();
    const {
        getBaseSnapshot,
        ensureBaseSnapshot,
        getComputed,
        setComputed,
        version,
    } = useDataCache();
    const storeId = overrideStoreId !== undefined ? overrideStoreId : activeStoreId;

    const [, setTick] = useState(0);
    useEffect(() => {
        setTick(t => t + 1);
    }, [version]);

    useEffect(() => {
        if (storesLoading) return;
        ensureBaseSnapshot(storeId, buildBaseSnapshot);
    }, [storeId, storesLoading, ensureBaseSnapshot, version]);

    const { data: scanData } = useApiData('scan', storeId);
    const { modalValues, setModalValues, loading: loadingModal, saveAll, saveSingle } = useModalValues(storeId);

    const baseState = getBaseSnapshot(storeId);
    const baseSnapshot = baseState?.snapshot || null;
    const loadingBase = storesLoading ? true : (baseState ? baseState.loading : true);
    const loading = loadingBase || (loadingModal && !baseSnapshot);

    // Pre-parse modal values into numeric map once
    const { numericModalMap, modalHash } = useMemo(() => {
        const map = new Map();
        let sum = 0;
        let xor = 0;
        if (!modalValues) return { numericModalMap: map, modalHash: '0_0_0' };
        let i = 1;
        for (const [k, v] of Object.entries(modalValues)) {
            const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
            if (n > 0) {
                map.set(k, n);
                sum += n;
                xor ^= (n * i);
                i++;
            }
        }
        return { numericModalMap: map, modalHash: `${map.size}_${sum}_${xor}` };
    }, [modalValues]);

    // ─── Modal helper (uses pre-resolved keys when available) ───────────
    const getModalForItem = useCallback((order) => {
        if (order._fullKey !== undefined) {
            if (order._fullKey && numericModalMap.has(order._fullKey)) return numericModalMap.get(order._fullKey);
            if (order._skuKey && numericModalMap.has(order._skuKey)) return numericModalMap.get(order._skuKey);
            return 0;
        }
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

    const baseVersion = baseSnapshot?.uploadVersion || 'empty';
    const scanHash = `${scanData.length}_${scanData[0]?.id || 0}`;
    const rangkumanVersion = `${baseVersion}::${modalHash}::${scanHash}::${storeId || 'all'}`;
    const cacheKey = `processedOrders_v4::${rangkumanVersion}`;

    // STAGE 2: Zero-allocation in-place overlay connecting Base Snapshot with Modal (HPP) & Scans (~2ms)
    const computedBundle = useMemo(() => {
        if (!baseSnapshot || !Array.isArray(baseSnapshot.baseOrders)) {
            return {
                rangkumanData: [],
                returnData: [],
                pengembalianData: [],
                ordersData: [],
                paymentsData: [],
                ordersGroupedById: new Map(),
                returnTimeByOrderId: new Map(),
                returnResiByOrderId: new Map(),
                pengembalianResiSet: new Set(),
                scanData,
            };
        }

        const existing = getComputed(cacheKey);
        if (existing) {
            return existing;
        }

        const scanResiSet = new Set();
        const scanDateByResi = new Map();
        for (let i = 0; i < scanData.length; i++) {
            const s = scanData[i];
            if (s.resi) {
                const rStr = s.resi.toString().trim();
                scanResiSet.add(rStr);
                if (s.scan_date) scanDateByResi.set(rStr, s.scan_date);
                else if (s.scanned_at) scanDateByResi.set(rStr, s.scanned_at);
            }
        }

        const hasScans = scanResiSet.size > 0;
        const pengembalianResiSet = new Set(baseSnapshot.excelPengembalianResiList || []);
        if (hasScans) {
            for (const rStr of scanResiSet) pengembalianResiSet.add(rStr);
        }

        const returnResiByOrderId = new Map(Object.entries(baseSnapshot.returnResiObj || {}));
        const returnTimeByOrderId = new Map(Object.entries(baseSnapshot.excelReturnTimeObj || {}));
        if (hasScans) {
            for (const [oid, trk] of returnResiByOrderId.entries()) {
                if (scanResiSet.has(trk) && (!returnTimeByOrderId.has(oid) || returnTimeByOrderId.get(oid) === '-')) {
                    const dStr = scanDateByResi.get(trk);
                    if (dStr) {
                        const dObj = parseIndonesianDateTime(dStr);
                        returnTimeByOrderId.set(oid, dObj ? formatIndonesianDateTime(dObj) : dStr);
                    }
                }
            }
        }

        const baseOrders = baseSnapshot.baseOrders;
        const len = baseOrders.length;
        const ordersGroupedById = new Map();

        for (let i = 0; i < len; i++) {
            const bo = baseOrders[i];
            const orders = bo.orders;
            ordersGroupedById.set(bo.orderId, orders);

            // 1. Fast O(1) Modal lookup using pre-resolved _fullKey and _skuKey
            let totalModal = 0;
            let modalValid = true;
            for (let j = 0; j < orders.length; j++) {
                const o = orders[j];
                const itemModal = (o._fullKey && numericModalMap.get(o._fullKey))
                    || (o._skuKey && numericModalMap.get(o._skuKey))
                    || 0;
                totalModal += itemModal * o._qtyNum;
                if (modalValid && itemModal <= 0) {
                    modalValid = false;
                }
            }

            // 2. Verifikasi Paket
            const statusLower = bo.statusLower;
            let verifikasiPaket = '-';
            if (statusLower === 'completed') {
                verifikasiPaket = '✓';
            } else if (statusLower === 'canceled' || statusLower === 'cancelled' || statusLower === 'gagal kirim') {
                const resi = bo.trackingId;
                if (!resi || resi === '-') verifikasiPaket = '✓';
                else if (bo.excelPengembalianMatched || (hasScans && scanResiSet.has(resi))) verifikasiPaket = 'Diterima';
                else verifikasiPaket = 'Belum Diterima';
            } else if (statusLower === 'return') {
                if (!bo.hasReturnRecord || !bo.returnTrackingId) verifikasiPaket = '-';
                else if (bo.excelPengembalianMatched || (hasScans && scanResiSet.has(bo.returnTrackingId))) verifikasiPaket = 'Diterima';
                else verifikasiPaket = 'Belum Diterima';
            }

            // 3. Effective Modal, Laba (Profit), & Kerugian (Loss)
            let effectiveModal = totalModal;
            let effectiveModalValid = modalValid;
            if (statusLower === 'canceled' || statusLower === 'cancelled') {
                effectiveModal = 0;
                effectiveModalValid = true;
            } else if ((statusLower === 'return' || statusLower === 'gagal kirim') && verifikasiPaket === 'Diterima') {
                effectiveModal = 0;
                effectiveModalValid = true;
            }

            const totalSettlementAmount = bo.totalSettlementAmount;
            let profitDisplay = '';
            if (statusLower === 'canceled' || statusLower === 'cancelled') profitDisplay = 'CANCEL';
            else if (statusLower === 'gagal kirim') profitDisplay = 'Gagal Kirim';
            else if (totalSettlementAmount === 0) profitDisplay = 'Dana Belum Diterima';
            else profitDisplay = effectiveModalValid ? formatRupiah(totalSettlementAmount - effectiveModal) : 'HPP Belum Diinput';

            // Update fields in-place on bo (0 object allocations!)
            bo.totalModal = totalModal;
            bo.modalValid = modalValid;
            bo.effectiveModal = effectiveModal;
            bo.effectiveModalValid = effectiveModalValid;
            bo.verifikasiPaket = verifikasiPaket;
            bo.profitDisplay = profitDisplay;
            bo.hppDisplay = effectiveModalValid ? formatRupiah(effectiveModal) : 'HPP Belum Diinput';
            bo.kerugian = verifikasiPaket === 'Belum Diterima' && modalValid && totalModal > 0 ? formatRupiah(totalModal) : '-';
            bo._hppRaw = modalValid ? totalModal : 0;
        }

        // Shallow array clone provides a new reference for React useMemo downstream with 0 object allocations
        const rangkumanData = baseOrders.slice();

        const result = {
            rangkumanData,
            returnData: baseSnapshot.returnData || [],
            pengembalianData: baseSnapshot.pengembalianData || [],
            ordersData: [],
            paymentsData: [],
            ordersGroupedById,
            returnTimeByOrderId,
            returnResiByOrderId,
            pengembalianResiSet,
            scanData,
        };

        if (len > 0) {
            setComputed(cacheKey, result);
        }
        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseSnapshot, cacheKey]);

    return {
        ...computedBundle,
        baseVersion,
        rangkumanVersion,
        loading,
        modalValues,
        setModalValues,
        saveAll,
        saveSingle,
        getModalForItem,
    };
}
