import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    apiGetOrders,
    apiGetPayments,
    apiGetReturns,
    apiGetPengembalian,
    apiGetModalValues,
    apiGetStats,
} from '../api';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';

const DataContext = createContext(null);

/**
 * Global data cache provider.
 * Stores fetched data in memory keyed by "type::storeId".
 * Re-uses cached data on navigation instead of re-fetching.
 * Auto-invalidates when storeId or userId changes.
 */
export function DataProvider({ children }) {
    const { user } = useAuth();
    const { activeStoreId } = useStore();
    const userId = user?.id;

    // cache: Map<string, { data, loading, error, promise }>
    const cacheRef = useRef(new Map());
    // Computed/processed data cache — persists heavy useMemo results across mount/unmount
    const computedRef = useRef(new Map());
    // A counter that, when bumped, tells consumers to re-check cache
    const [version, setVersion] = useState(0);

    const fetchFns = {
        orders: apiGetOrders,
        payments: apiGetPayments,
        returns: apiGetReturns,
        pengembalian: apiGetPengembalian,
        stats: apiGetStats,
    };

    const getCacheKey = useCallback((type, storeId) => {
        return `${type}::${storeId || 'all'}::${userId || 'none'}`;
    }, [userId]);

    /**
     * Get data from cache or fetch if not cached.
     * Returns { data, loading, error }.
     */
    const getData = useCallback((type, storeId) => {
        const key = getCacheKey(type, storeId);
        const cached = cacheRef.current.get(key);
        if (cached && !cached.stale) {
            return cached;
        }
        return null;
    }, [getCacheKey]);

    /**
     * Fetch data and store in cache. Returns a promise.
     */
    const fetchData = useCallback(async (type, storeId) => {
        const fetchFn = fetchFns[type];
        if (!fetchFn) return;

        const key = getCacheKey(type, storeId);
        const existing = cacheRef.current.get(key);

        // If there's already an in-flight request, don't start another
        if (existing && existing.loading && existing.promise) {
            return existing.promise;
        }

        const entry = {
            data: existing?.data || (type === 'stats' ? null : []),
            loading: true,
            error: null,
            stale: false,
            promise: null,
        };

        const promise = (async () => {
            try {
                const result = await fetchFn(storeId, userId);
                entry.data = result;
                entry.error = null;
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
        setVersion(v => v + 1);

        return promise;
    }, [getCacheKey, userId]);

    /**
     * Invalidate all cached data — forces re-fetch on next access.
     * Called after upload, store change, etc.
     */
    const invalidateAll = useCallback(() => {
        cacheRef.current.clear();
        computedRef.current.clear();
        setVersion(v => v + 1);
    }, []);

    /**
     * Invalidate a specific data type (for all stores).
     */
    const invalidateType = useCallback((type) => {
        for (const key of cacheRef.current.keys()) {
            if (key.startsWith(`${type}::`)) {
                cacheRef.current.delete(key);
            }
        }
        setVersion(v => v + 1);
    }, []);

    // When user changes, clear all cache
    useEffect(() => {
        cacheRef.current.clear();
        computedRef.current.clear();
        setVersion(v => v + 1);
    }, [userId]);

    // When active store changes, clear all cache so stale data is not shown
    useEffect(() => {
        cacheRef.current.clear();
        computedRef.current.clear();
        setVersion(v => v + 1);
    }, [activeStoreId]);

    /**
     * Get a computed/processed result from cache.
     * @param {string} key — unique key for the computed result
     * @returns cached data or undefined
     */
    const getComputed = useCallback((key) => computedRef.current.get(key), []);

    /**
     * Store a computed/processed result in cache.
     * @param {string} key — unique key for the computed result
     * @param {*} data — the processed data to cache
     */
    const setComputed = useCallback((key, data) => { computedRef.current.set(key, data); }, []);

    return (
        <DataContext.Provider value={{
            getData, fetchData, invalidateAll, invalidateType, version,
            getComputed, setComputed,
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
