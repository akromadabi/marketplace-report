import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    apiSaveModalValues,
    apiSaveModalSingle,
} from '../api';
import { useDataCache } from '../contexts/DataContext';
import { useStore } from '../contexts/StoreContext';

const formatRpInt = (num) => 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Hook to fetch data from API with loading/error states.
 * Uses the global DataContext cache — data is fetched once and reused
 * across page navigations. Supports 0ms localStorage seed with silent background revalidation.
 */
export function useApiData(type, storeId) {
    const { getData, fetchData, version } = useDataCache();
    const { loading: storesLoading } = useStore();
    const [, setTick] = useState(0);

    useEffect(() => {
        if (storesLoading) return;
        const cached = getData(type, storeId);
        if (!cached) {
            fetchData(type, storeId);
        } else if (cached.needsRevalidate && !cached.promise) {
            fetchData(type, storeId, { background: true });
        }
    }, [type, storeId, getData, fetchData, version, storesLoading]);

    useEffect(() => {
        setTick(t => t + 1);
    }, [version]);

    const cached = getData(type, storeId);

    const refetch = useCallback(async () => {
        await fetchData(type, storeId);
    }, [fetchData, type, storeId]);

    return {
        data: cached?.data ?? (type === 'stats' ? null : []),
        loading: storesLoading ? true : (cached ? cached.loading : true),
        error: cached?.error ?? null,
        refetch,
    };
}

/**
 * Hook for modal values (HPP) with save capability.
 * - Seeded synchronously from localStorage for 0ms startup, revalidated in background.
 * - Updates cache optimistically on save without invalidating Excel order snapshots.
 */
export function useModalValues(storeId) {
    const { getData, fetchData, setCacheData, version } = useDataCache();
    const [localEdits, setLocalEdits] = useState({});
    const [, setTick] = useState(0);

    useEffect(() => {
        const cached = getData('modal', storeId);
        if (!cached) {
            fetchData('modal', storeId);
        } else if (cached.needsRevalidate && !cached.promise) {
            fetchData('modal', storeId, { background: true });
        }
    }, [storeId, getData, fetchData, version]);

    useEffect(() => {
        setTick(t => t + 1);
    }, [version]);

    const cached = getData('modal', storeId);
    const loading = cached ? cached.loading : true;
    const rawData = cached?.data;

    // Pre-format server modal values ONLY when rawData reference changes
    const formattedServerModal = useMemo(() => {
        const rawValues = rawData ?? {};
        const formatted = {};
        for (const [key, val] of Object.entries(rawValues)) {
            const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
            if (num > 0) {
                formatted[key] = formatRpInt(num);
            }
        }
        return formatted;
    }, [rawData]);

    // Overlay unsaved local edits cheaply
    const modalValues = useMemo(() => {
        if (!localEdits || Object.keys(localEdits).length === 0) {
            return formattedServerModal;
        }
        const merged = { ...formattedServerModal };
        for (const [k, v] of Object.entries(localEdits)) {
            if (v === null || v === undefined || v === '') {
                delete merged[k];
            } else {
                merged[k] = v;
            }
        }
        return merged;
    }, [formattedServerModal, localEdits]);

    const setModalValues = useCallback((updater) => {
        setLocalEdits(prev => {
            const currentFull = { ...formattedServerModal, ...prev };
            const nextFull = typeof updater === 'function' ? updater(currentFull) : updater;
            return nextFull;
        });
    }, [formattedServerModal]);

    const saveAll = useCallback(async (values) => {
        await apiSaveModalValues(values, storeId);
        const cleanRaw = {};
        for (const [k, v] of Object.entries(values)) {
            const num = parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0;
            if (num > 0) cleanRaw[k] = String(num);
        }
        setLocalEdits({});
        setCacheData('modal', storeId, cleanRaw);
    }, [storeId, setCacheData]);

    const saveSingle = useCallback(async (key, value) => {
        await apiSaveModalSingle(key, value, storeId);
        const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
        const nextRaw = { ...(rawData || {}) };
        if (num > 0) nextRaw[key] = String(num);
        else delete nextRaw[key];
        setLocalEdits(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setCacheData('modal', storeId, nextRaw);
    }, [storeId, rawData, setCacheData]);

    return { modalValues, setModalValues, loading, saveAll, saveSingle };
}
