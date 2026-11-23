import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    apiGetOrders,
    apiGetPayments,
    apiGetPaymentsMap,
    apiGetReturns,
    apiGetPengembalian,
    apiGetModalValues,
    apiGetSkuCatalog,
    apiGetStats,
    apiGetScans,
    apiGetDataVersion,
} from '../api';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';
import { idbGet, idbSet, idbClear } from '../idbCache';

const DataContext = createContext(null);

const MODAL_LS_PREFIX = 'marketplace_modal_v2_';
const SCAN_LS_KEY = 'marketplace_scan_v2_global';
const CATALOG_LS_PREFIX = 'marketplace_catalog_v2_';

function readLocalJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeLocalJson(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch {
        // Ignore quota errors
    }
}

function clearLocalCacheByPrefix(prefix) {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
}

/**
 * Global data cache provider.
 * - Persists processed Excel snapshots in IndexedDB keyed by store + uploadVersion.
 * - Persists lightweight modal (HPP), scan, and SKU catalog in localStorage for 0ms startup.
 * - Decouples base Excel data from modal (HPP) updates so editing HPP never re-downloads or re-parses Excel data.
 */
export function DataProvider({ children }) {
    const { user } = useAuth();
    const { activeStoreId } = useStore();
    const userId = user?.id;

    // cache: Map<string, { data, loading, error, promise, backgroundRefreshing }>
    const cacheRef = useRef(new Map());
    // Computed/processed data cache — persists heavy useMemo results across mount/unmount
    const computedRef = useRef(new Map());
    // Base Excel snapshot cache in memory: Map<storeScopeKey, { snapshot, loading, error, checkedServer, promise }>
    const baseSnapshotRef = useRef(new Map());

    const [version, setVersion] = useState(0);

    const fetchFnsRef = useRef({
        orders: apiGetOrders,
        payments: apiGetPayments,
        paymentsMap: apiGetPaymentsMap,
        returns: apiGetReturns,
        pengembalian: apiGetPengembalian,
        stats: apiGetStats,
        scan: () => apiGetScans(),
        skuCatalog: apiGetSkuCatalog,
        modal: (storeId, _userId) => apiGetModalValues(storeId),
    });

    const getCacheKey = useCallback((type, storeId) => {
        if (type === 'scan') return 'scan::global';
        return `${type}::${storeId || 'all'}::${userId || 'none'}`;
    }, [userId]);

    const getStoreScopeKey = useCallback((storeId) => {
        return `${storeId || 'all'}::${userId || 'none'}`;
    }, [userId]);

    /**
     * Get data from cache (or seed from localStorage for modal/scan/skuCatalog).
     */
    const getData = useCallback((type, storeId) => {
        const key = getCacheKey(type, storeId);
        const cached = cacheRef.current.get(key);
        if (cached && !cached.stale) {
            return cached;
        }
        // Seed synchronously from localStorage for instant 0ms first render
        if (type === 'modal') {
            const localModal = readLocalJson(MODAL_LS_PREFIX + (storeId || 'all'));
            if (localModal && typeof localModal === 'object') {
                const seeded = { data: localModal, loading: false, error: null, stale: false, promise: null, needsRevalidate: true };
                cacheRef.current.set(key, seeded);
                return seeded;
            }
        } else if (type === 'scan') {
            const localScan = readLocalJson(SCAN_LS_KEY);
            if (Array.isArray(localScan)) {
                const seeded = { data: localScan, loading: false, error: null, stale: false, promise: null, needsRevalidate: true };
                cacheRef.current.set(key, seeded);
                return seeded;
            }
        } else if (type === 'skuCatalog') {
            const localCat = readLocalJson(CATALOG_LS_PREFIX + (storeId || 'all') + '_' + (userId || 'none'));
            if (Array.isArray(localCat) && localCat.length > 0) {
                const seeded = { data: localCat, loading: false, error: null, stale: false, promise: null, needsRevalidate: true };
                cacheRef.current.set(key, seeded);
                return seeded;
            }
        }
        return null;
    }, [getCacheKey, userId]);

    /**
     * Directly set data in cache without network request.
     */
    const setCacheData = useCallback((type, storeId, data) => {
        const key = getCacheKey(type, storeId);
        cacheRef.current.set(key, {
            data,
            loading: false,
            error: null,
            stale: false,
            promise: null,
            needsRevalidate: false,
        });
        if (type === 'modal') {
            writeLocalJson(MODAL_LS_PREFIX + (storeId || 'all'), data);
        } else if (type === 'scan') {
            writeLocalJson(SCAN_LS_KEY, data);
        } else if (type === 'skuCatalog') {
            writeLocalJson(CATALOG_LS_PREFIX + (storeId || 'all') + '_' + (userId || 'none'), data);
        }
        setVersion(v => v + 1);
    }, [getCacheKey, userId]);

    /**
     * Fetch data and store in cache. Supports silent background revalidation when seeded from localStorage.
     */
    const fetchData = useCallback(async (type, storeId, options = {}) => {
        const fetchFn = fetchFnsRef.current[type];
        if (!fetchFn) return;

        const key = getCacheKey(type, storeId);
        const existing = cacheRef.current.get(key);

        if (existing && existing.promise) {
            return existing.promise;
        }

        const isBackground = Boolean(options.background || (existing && existing.needsRevalidate && !existing.loading));

        const entry = {
            data: existing?.data || (type === 'stats' ? null : (type === 'modal' ? {} : [])),
            loading: !isBackground,
            error: null,
            stale: false,
            needsRevalidate: false,
            promise: null,
        };

        const promise = (async () => {
            try {
                const result = await fetchFn(storeId, userId);
                entry.data = result;
                entry.error = null;
                if (type === 'modal') {
                    writeLocalJson(MODAL_LS_PREFIX + (storeId || 'all'), result);
                } else if (type === 'scan') {
                    writeLocalJson(SCAN_LS_KEY, result);
                } else if (type === 'skuCatalog') {
                    writeLocalJson(CATALOG_LS_PREFIX + (storeId || 'all') + '_' + (userId || 'none'), result);
                }
            } catch (err) {
                entry.error = err.message || 'Gagal memuat data';
            }
            entry.loading = false;
            entry.promise = null;
            cacheRef.current.set(key, { ...entry });
            setVersion(v => v + 1);
        })();

        entry.promise = promise;
        cacheRef.current.set(key, entry);
        if (!isBackground) {
            setVersion(v => v + 1);
        }

        return promise;
    }, [getCacheKey, userId]);

    /**
     * Get the current base Excel snapshot state for a store.
     */
    const getBaseSnapshot = useCallback((storeId) => {
        const scopeKey = getStoreScopeKey(storeId);
        return baseSnapshotRef.current.get(scopeKey) || null;
    }, [getStoreScopeKey]);

    /**
     * Load base Excel snapshot from IndexedDB or build from server once per uploadVersion.
     * Reuses IndexedDB cache across browser refreshes if no Excel file was uploaded or deleted.
     */
    const ensureBaseSnapshot = useCallback(async (storeId, buildSnapshotFn) => {
        const scopeKey = getStoreScopeKey(storeId);
        const existing = baseSnapshotRef.current.get(scopeKey);

        if (existing && existing.checkedServer && !existing.loading) {
            return existing.snapshot;
        }
        if (existing && existing.promise) {
            return existing.promise;
        }

        const idbKey = `baseSnapshot_v4::${scopeKey}`;

        const entry = {
            snapshot: existing?.snapshot || null,
            loading: !existing?.snapshot,
            error: null,
            checkedServer: false,
            promise: null,
        };

        const seedSubCaches = (snap) => {
            if (!snap) return;
            if (Array.isArray(snap.skuCatalog) && snap.skuCatalog.length > 0) {
                const catKey = getCacheKey('skuCatalog', storeId);
                cacheRef.current.set(catKey, {
                    data: snap.skuCatalog,
                    loading: false,
                    error: null,
                    stale: false,
                    promise: null,
                    needsRevalidate: false,
                });
                writeLocalJson(CATALOG_LS_PREFIX + (storeId || 'all') + '_' + (userId || 'none'), snap.skuCatalog);
            }
            if (Array.isArray(snap.returnData)) {
                cacheRef.current.set(getCacheKey('returns', storeId), {
                    data: snap.returnData,
                    loading: false,
                    error: null,
                    stale: false,
                    promise: null,
                    needsRevalidate: false,
                });
            }
            if (Array.isArray(snap.pengembalianData)) {
                cacheRef.current.set(getCacheKey('pengembalian', storeId), {
                    data: snap.pengembalianData,
                    loading: false,
                    error: null,
                    stale: false,
                    promise: null,
                    needsRevalidate: false,
                });
            }
        };

        const hydrateDates = (snap) => {
            if (!snap || !Array.isArray(snap.baseOrders)) return snap;
            for (let i = 0; i < snap.baseOrders.length; i++) {
                const bo = snap.baseOrders[i];
                if (!(bo.waktuPesananDibuatObj instanceof Date)) {
                    bo.waktuPesananDibuatObj = new Date(bo._timestamp);
                }
            }
            return snap;
        };

        const promise = (async () => {
            try {
                // Start IndexedDB read and Server version check in parallel
                const idbPromise = idbGet(idbKey);
                const versionPromise = apiGetDataVersion(storeId, userId).catch(() => null);

                const idbSnap = await idbPromise;
                if (idbSnap && Array.isArray(idbSnap.baseOrders)) {
                    hydrateDates(idbSnap);
                    entry.snapshot = idbSnap;
                    entry.loading = false;
                    seedSubCaches(idbSnap);
                    baseSnapshotRef.current.set(scopeKey, { ...entry });
                    setVersion(v => v + 1);
                }

                const serverVer = await versionPromise;
                if (serverVer && serverVer.stats) {
                    cacheRef.current.set(getCacheKey('stats', storeId), {
                        data: serverVer.stats,
                        loading: false,
                        error: null,
                        stale: false,
                        promise: null,
                    });
                }

                // If IndexedDB snapshot matches the server's uploadVersion, we are 100% done!
                if (
                    idbSnap &&
                    Array.isArray(idbSnap.baseOrders) &&
                    (!serverVer || idbSnap.uploadVersion === serverVer.uploadVersion)
                ) {
                    entry.checkedServer = true;
                    entry.loading = false;
                    entry.promise = null;
                    baseSnapshotRef.current.set(scopeKey, { ...entry });
                    setVersion(v => v + 1);
                    return idbSnap;
                }

                // If store has 0 uploaded rows across all categories, build empty snapshot immediately
                const stats = serverVer?.stats;
                const isCompletelyEmpty = stats &&
                    stats.orders === 0 &&
                    stats.payments === 0 &&
                    stats.returns === 0 &&
                    stats.pengembalian === 0;

                let ordersData = [];
                let paymentsMap = {};
                let returnData = [];
                let pengembalianData = [];

                if (!isCompletelyEmpty) {
                    const [ordRes, payRes, retRes, pngRes] = await Promise.all([
                        (!stats || stats.orders > 0) ? apiGetOrders(storeId, userId) : Promise.resolve([]),
                        (!stats || stats.payments > 0) ? apiGetPaymentsMap(storeId, userId) : Promise.resolve({}),
                        (!stats || stats.returns > 0) ? apiGetReturns(storeId, userId) : Promise.resolve([]),
                        (!stats || stats.pengembalian > 0) ? apiGetPengembalian(storeId, userId) : Promise.resolve([]),
                    ]);
                    ordersData = Array.isArray(ordRes) ? ordRes : [];
                    paymentsMap = (payRes && typeof payRes === 'object') ? payRes : {};
                    returnData = Array.isArray(retRes) ? retRes : [];
                    pengembalianData = Array.isArray(pngRes) ? pngRes : [];
                }

                const uploadVersion = serverVer?.uploadVersion || `v3_fallback_${ordersData.length}_${returnData.length}_${pengembalianData.length}`;
                const freshSnap = buildSnapshotFn({
                    ordersData,
                    paymentsMap,
                    returnData,
                    pengembalianData,
                    uploadVersion,
                });

                entry.snapshot = freshSnap;
                entry.loading = false;
                entry.error = null;
                entry.checkedServer = true;
                entry.promise = null;
                seedSubCaches(freshSnap);
                baseSnapshotRef.current.set(scopeKey, { ...entry });
                setVersion(v => v + 1);

                // Persist to IndexedDB in the background so future page reloads are instant
                idbSet(idbKey, freshSnap);
                return freshSnap;
            } catch (err) {
                entry.error = err.message || 'Gagal memuat data';
                entry.loading = false;
                entry.promise = null;
                baseSnapshotRef.current.set(scopeKey, { ...entry });
                setVersion(v => v + 1);
                return entry.snapshot;
            }
        })();

        entry.promise = promise;
        baseSnapshotRef.current.set(scopeKey, entry);
        if (entry.loading) {
            setVersion(v => v + 1);
        }
        return promise;
    }, [getStoreScopeKey, getCacheKey, userId]);

    /**
     * Invalidate all cached data — called after Excel file upload, delete, or clear.
     */
    const invalidateAll = useCallback(() => {
        cacheRef.current.clear();
        computedRef.current.clear();
        baseSnapshotRef.current.clear();
        clearLocalCacheByPrefix(CATALOG_LS_PREFIX);
        idbClear();
        setVersion(v => v + 1);
    }, []);

    /**
     * Invalidate a specific data type (e.g. 'modal' or 'scan').
     * IMPORTANT: Does NOT clear baseSnapshotRef so Excel data is never re-downloaded or re-parsed!
     */
    const invalidateType = useCallback((type) => {
        for (const key of cacheRef.current.keys()) {
            if (key.startsWith(`${type}::`)) {
                cacheRef.current.delete(key);
            }
        }
        if (type === 'modal') {
            clearLocalCacheByPrefix(MODAL_LS_PREFIX);
        } else if (type === 'scan') {
            try { localStorage.removeItem(SCAN_LS_KEY); } catch { /* ignore */ }
        } else if (type === 'orders' || type === 'payments' || type === 'returns' || type === 'pengembalian') {
            baseSnapshotRef.current.clear();
            idbClear();
        }
        // Only clear modal-dependent computed entries, preserve non-modal caches
        for (const cKey of computedRef.current.keys()) {
            if (!cKey.startsWith('wawasan_base::')) {
                computedRef.current.delete(cKey);
            }
        }
        setVersion(v => v + 1);
    }, []);

    // When user changes (login/logout), clear in-memory caches
    useEffect(() => {
        cacheRef.current.clear();
        computedRef.current.clear();
        baseSnapshotRef.current.clear();
        setVersion(v => v + 1);
    }, [userId]);

    // When active store changes, just bump version so consumers read the new store's key (do not wipe other stores' caches!)
    useEffect(() => {
        setVersion(v => v + 1);
    }, [activeStoreId]);

    const getComputed = useCallback((key) => computedRef.current.get(key), []);
    const setComputed = useCallback((key, data) => { computedRef.current.set(key, data); }, []);

    return (
        <DataContext.Provider value={{
            getData,
            fetchData,
            setCacheData,
            getBaseSnapshot,
            ensureBaseSnapshot,
            invalidateAll,
            invalidateType,
            version,
            getComputed,
            setComputed,
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useDataCache() {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useDataCache must be used within DataProvider');
    return ctx;
}

export default DataContext;
