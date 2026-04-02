import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiGetUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiGetRoles, apiUpdateRole } from '../api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'marketplace_session';

function getStoredSession() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return null;
}

// Visual config for classes (user tiers)
export const CLASS_CONFIG = {
    platinum: {
        label: 'Platinum',
        color: '#0984e3',
        bgColor: 'rgba(9, 132, 227, 0.08)',
        borderColor: 'rgba(9, 132, 227, 0.2)',
        gradient: 'linear-gradient(135deg, #0984e3, #74b9ff)',
        icon: '💎',
    },
    gold: {
        label: 'Gold',
        color: '#e67e22',
        bgColor: 'rgba(230, 126, 34, 0.08)',
        borderColor: 'rgba(230, 126, 34, 0.2)',
        gradient: 'linear-gradient(135deg, #f39c12, #fdcb6e)',
        icon: '⭐',
    },
    silver: {
        label: 'Silver',
        color: '#636e72',
        bgColor: 'rgba(99, 110, 114, 0.08)',
        borderColor: 'rgba(99, 110, 114, 0.15)',
        gradient: 'linear-gradient(135deg, #636e72, #b2bec3)',
        icon: '🥈',
    },
};

// Visual config for roles
export const ROLE_CONFIG = {
    admin: {
        label: 'Admin',
        color: '#6c5ce7',
        bgColor: 'rgba(108, 92, 231, 0.08)',
        borderColor: 'rgba(108, 92, 231, 0.2)',
        gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
        icon: '👑',
    },
    user: {
        label: 'User',
        color: '#00b894',
        bgColor: 'rgba(0, 184, 148, 0.08)',
        borderColor: 'rgba(0, 184, 148, 0.2)',
        gradient: 'linear-gradient(135deg, #00b894, #55efc4)',
        icon: '👤',
    },
};

// All available user-facing pages/features
export const ALL_USER_FEATURES = [
    { path: '/', label: 'Dashboard' },
    { path: '/upload', label: 'Upload File' },
    { path: '/input-modal', label: 'Input HPP' },
    { path: '/return', label: 'Retur' },
    { path: '/pengembalian', label: 'Pengembalian' },
    { path: '/analisis', label: 'Analisis Produk' },
    { path: '/rangkuman', label: 'Rekap Transaksi' },
    { path: '/olahan', label: 'Analisis Pesanan' },
    { path: '/stores', label: 'Kelola Toko' },
    { path: '/aset', label: 'Aset' },
    { path: '/operasional', label: 'Operasional' },
];

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(getStoredSession);

    // Sync session to localStorage
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [currentUser]);

    const login = useCallback(async (username, password) => {
        try {
            const user = await apiLogin(username, password);
            const session = {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                class: user.class,
                store_name: user.store_name || '',
                status: user.status,
                permissions: user.permissions || [],
                limits: user.limits || { max_stores: -1, max_orders: -1 },
            };
            setCurrentUser(session);
            return { success: true, user: session };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
    }, []);

    const isAdmin = currentUser?.role === 'admin';

    const hasPermission = useCallback((page) => {
        if (!currentUser) return false;
        // Admin has access to all admin pages but NOT user pages
        if (currentUser.role === 'admin') return false;
        // User: check class-based permissions
        if (!currentUser.permissions) return false;
        // /upload and / are always available for users
        if (page === '/upload' || page === '/') return true;
        return currentUser.permissions.includes(page);
    }, [currentUser]);

    const hasAdminAccess = useCallback(() => {
        return currentUser?.role === 'admin';
    }, [currentUser]);

    // Refresh permissions from server (useful after admin updates class permissions)
    const refreshPermissions = useCallback(async () => {
        if (!currentUser || currentUser.role !== 'user' || !currentUser.class) return;
        try {
            const { apiGetPermissions } = await import('../api');
            const permissions = await apiGetPermissions(currentUser.class);
            setCurrentUser(prev => ({ ...prev, permissions }));
        } catch (e) { /* ignore */ }
    }, [currentUser]);

    // User management via API
    const getUsers = useCallback(async () => {
        return apiGetUsers();
    }, []);

    const addUser = useCallback(async (userData) => {
        return apiCreateUser(userData);
    }, []);

    const updateUser = useCallback(async (id, userData) => {
        const result = await apiUpdateUser(id, userData);
        // Update session if editing self
        if (currentUser && currentUser.id === id) {
            setCurrentUser((prev) => ({ ...prev, ...userData, id }));
        }
        return result;
    }, [currentUser]);

    const deleteUser = useCallback(async (id) => {
        return apiDeleteUser(id);
    }, []);

    const getRoles = useCallback(async () => {
        return apiGetRoles();
    }, []);

    const updateRole = useCallback(async (className, permissions) => {
        return apiUpdateRole(className, permissions);
    }, []);

    const value = {
        user: currentUser,
        setUser: setCurrentUser,
        isAuthenticated: !!currentUser,
        isAdmin,
        login,
        logout,
        hasPermission,
        hasAdminAccess,
        refreshPermissions,
        getUsers,
        addUser,
        updateUser,
        deleteUser,
        getRoles,
        updateRole,
        ROLE_CONFIG,
        CLASS_CONFIG,
        ALL_USER_FEATURES,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export default AuthContext;
