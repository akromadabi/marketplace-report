import { useState, useEffect, useCallback } from 'react';
import {
    apiGetModalValues,
    apiSaveModalValues,
    apiSaveModalSingle,
} from '../api';
import { useDataCache } from '../contexts/DataContext';

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
    const [, setTick] = useState(0);

    // Check cache and trigger fetch if needed
    useEffect(() => {
        const cached = getData(type, storeId);
        if (!cached) {
            // Not in cache — fetch it
            fetchData(type, storeId);
        }
    }, [type, storeId, getData, fetchData, version]);

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
        loading: cached ? cached.loading : true,
        error: cached?.error ?? null,
        refetch,
    };
}

/**
 * Hook for modal values with save capability.
 * Modal values are NOT cached in DataContext since they involve
 * local editing state. They are fetched per-component.
 */
export function useModalValues(storeId) {
    const [modalValues, setModalValues] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const values = await apiGetModalValues(storeId);
                const formatted = {};
                Object.entries(values).forEach(([key, val]) => {
                    const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
                    if (num > 0) {
                        formatted[key] = 'Rp' + num.toLocaleString('id-ID');
                    }
                });
                setModalValues(formatted);
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, [storeId]);

    const saveAll = useCallback(async (values) => {
        await apiSaveModalValues(values, storeId);
    }, [storeId]);

    const saveSingle = useCallback(async (key, value) => {
        await apiSaveModalSingle(key, value, storeId);
    }, [storeId]);

    return { modalValues, setModalValues, loading, saveAll, saveSingle };
}
