import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGetStores, apiCreateStore, apiUpdateStore, apiDeleteStore } from '../api';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

const STORE_KEY = 'marketplace_active_store';

export function StoreProvider({ children }) {
    const { user } = useAuth();
    const [stores, setStores] = useState([]);
    const [activeStore, setActiveStoreState] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load stores when user changes
    const loadStores = useCallback(async () => {
        if (!user || user.role === 'admin') {
            setStores([]);
            setActiveStoreState(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const storeList = await apiGetStores(user.id);
            setStores(storeList);

            // Restore active store from localStorage
            const savedId = localStorage.getItem(STORE_KEY);
            const savedStore = savedId ? storeList.find(s => s.id === parseInt(savedId)) : null;
            if (savedStore) {
                setActiveStoreState(savedStore);
            } else if (storeList.length > 0) {
                setActiveStoreState(storeList[0]);
                localStorage.setItem(STORE_KEY, storeList[0].id.toString());
            }
        } catch (err) {
            console.error('Failed to load stores:', err);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        loadStores();
    }, [loadStores]);

    useEffect(() => {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        if (activeStore && activeStore.logo_url) {
            link.href = `/api/${activeStore.logo_url}`;
        } else {
            link.href = '/favicon.ico'; // default or fallback
        }
    }, [activeStore]);

    const setActiveStore = useCallback((store) => {
        setActiveStoreState(store);
        if (store) {
            localStorage.setItem(STORE_KEY, store.id.toString());
        } else {
            localStorage.removeItem(STORE_KEY);
        }
    }, []);

    const addStore = useCallback(async (data) => {
        if (!user) return;
        const result = await apiCreateStore({ ...data, user_id: user.id });
        await loadStores();
        return result;
    }, [user, loadStores]);

    const editStore = useCallback(async (id, data) => {
        const result = await apiUpdateStore(id, data);
        await loadStores();
        // If editing the active store, update it
        if (activeStore && activeStore.id === id) {
            setActiveStoreState(prev => ({ ...prev, ...data }));
        }
        return result;
    }, [loadStores, activeStore]);

    const removeStore = useCallback(async (id) => {
        const result = await apiDeleteStore(id);
        // If deleting the active store, clear it
        if (activeStore && activeStore.id === id) {
            setActiveStoreState(null);
            localStorage.removeItem(STORE_KEY);
        }
        await loadStores();
        return result;
    }, [activeStore, loadStores]);

    const value = {
        stores,
        activeStore,
        activeStoreId: activeStore?.id || null,
        setActiveStore,
        addStore,
        editStore,
        removeStore,
        loadStores,
        loading,
    };

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error('useStore must be used within StoreProvider');
    return ctx;
}

export default StoreContext;
