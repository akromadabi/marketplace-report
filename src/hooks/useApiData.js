import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    apiSaveModalValues,
    apiSaveModalSingle,
} from '../api';
import { useDataCache } from '../contexts/DataContext';
import { useStore } from '../contexts/StoreContext';

/**
 * Hook to fetch data from API with loading/error states.
 * Uses the global DataContext cache — data is fetched once and reused
 * across page navigations. Only re-fetches when cache is invalidated
 * (e.g. after upload, store change, or login).
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApiData('orders', storeId);
 */
export function useApiData(type, storeId) {
    const { getData, fetchData, version } = useDataCache();
    const { loading: storesLoading } = useStore();
    const [, setTick] = useState(0);

    // Check cache and trigger fetch if needed
    useEffect(() => {
        // Wait until stores have finished loading before fetching data.
        // This prevents fetching with storeId=null when a store exists.
        if (storesLoading) return;
        const cached = getData(type, storeId);
        if (!cached) {
            // Not in cache — fetch it
            fetchData(type, storeId);
        }
    }, [type, storeId, getData, fetchData, version, storesLoading]);

    // Force re-render when version changes (cache updates)
    useEffect(() => {
        setTick(t => t + 1);
    }, [version]);

    const cached = getData(type, storeId);

    const refetch = useCallback(async () => {
        await fetchData(type, storeId);
    }, [fetchData, type, storeId]);

    return {
        data: cached?.data ?? (type === 'stats' ? null : []),
        // If stores are still loading, report loading=true even if no cache yet
        loading: storesLoading ? true : (cached ? cached.loading : true),
        error: cached?.error ?? null,
        refetch,
    };
}

/**
 * Hook for modal values with save capability.
 * Modal values are now cached in DataContext so they are fetched once
 * and reused across components — no more re-fetch on every mount.
 * Invalidates cache after save so the next read gets fresh data.
 */
export function useModalValues(storeId) {
    const { getData, fetchData, invalidateType, version } = useDataCache();
    const [localEdits, setLocalEdits] = useState({});
    const [, setTick] = useState(0);

    // Trigger fetch if not in cache
    useEffect(() => {
        const cached = getData('modal', storeId);
        if (!cached) {
            fetchData('modal', storeId);
        }
    }, [storeId, getData, fetchData, version]);

    // Force re-render when cache version changes
    useEffect(() => {
        setTick(t => t + 1);
    }, [version]);

    const cached = getData('modal', storeId);
    const loading = cached ? cached.loading : true;

    // Format raw numeric values as "RpXXX" display strings
    const modalValues = useMemo(() => {
        const rawValues = cached?.data ?? {};
        const formatted = {};
        Object.entries(rawValues).forEach(([key, val]) => {
            const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
            if (num > 0) {
                formatted[key] = 'Rp' + num.toLocaleString('id-ID');
            }
        });
        // Overlay any unsaved local edits
        return { ...formatted, ...localEdits };
    }, [cached, localEdits]);

    const setModalValues = useCallback((updater) => {
        setLocalEdits(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return next;
        });
    }, []);

    const saveAll = useCallback(async (values) => {
        await apiSaveModalValues(values, storeId);
        setLocalEdits({});
        invalidateType('modal');
    }, [storeId, invalidateType]);

    const saveSingle = useCallback(async (key, value) => {
        await apiSaveModalSingle(key, value, storeId);
        // Update local cache optimistically so UI reflects change immediately
        setLocalEdits(prev => ({ ...prev, [key]: value }));
        invalidateType('modal');
    }, [storeId, invalidateType]);

    return { modalValues, setModalValues, loading, saveAll, saveSingle };
}
