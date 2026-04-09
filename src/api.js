// Centralized API helper — all components call these instead of managing state
const API_BASE = '/api';

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────
export async function apiLogin(username, password) {
    return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function apiGetUsers() {
    return apiFetch('/auth/users');
}

export async function apiCreateUser(data) {
    return apiFetch('/auth/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function apiUpdateUser(id, data) {
    return apiFetch(`/auth/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function apiDeleteUser(id) {
    return apiFetch(`/auth/users/${id}`, { method: 'DELETE' });
}

// ─── Roles / Class Permissions ───────────────────────────────────
export async function apiGetRoles() {
    return apiFetch('/auth/roles');
}

export async function apiUpdateRole(className, permissions) {
    return apiFetch(`/auth/roles/${className}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
    });
}

// ─── Class Limits ────────────────────────────────────────────────
export async function apiGetClassLimits() {
    return apiFetch('/auth/limits');
}

export async function apiUpdateClassLimits(className, data) {
    return apiFetch(`/auth/limits/${className}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function apiGetUsage(userId) {
    return apiFetch(`/auth/usage/${userId}`);
}

export async function apiGetPermissions(className) {
    return apiFetch(`/auth/permissions/${className}`);
}

// ─── Stores ──────────────────────────────────────────────────────
export async function apiGetStores(userId) {
    return apiFetch(`/stores?user_id=${userId}`);
}

export async function apiGetAllStores() {
    return apiFetch('/stores/all');
}

export async function apiCreateStore(data) {
    return apiFetch('/stores', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function apiUpdateStore(id, data) {
    return apiFetch(`/stores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function apiDeleteStore(id) {
    return apiFetch(`/stores/${id}`, { method: 'DELETE' });
}

// ─── Profile ─────────────────────────────────────────────────
export async function apiUpdateProfile(userId, { name, currentPassword, newPassword }) {
    return apiFetch('/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name, current_password: currentPassword, new_password: newPassword }),
    });
}

// ─── Upload ──────────────────────────────────────────────────────
export async function apiUploadFiles(files, userId, storeId) {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (userId) formData.append('user_id', userId);
    if (storeId) formData.append('store_id', storeId);

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — browser sets it with boundary for multipart
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload gagal' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function apiUploadParsedFiles(filesData, userId, storeId) {
    const res = await fetch(`${API_BASE}/upload/parsed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files_data: filesData, user_id: userId, store_id: storeId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload gagal' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function apiGetUploadHistory(userId, storeId) {
    let url = '/upload/history';
    const params = [];
    if (userId) params.push(`user_id=${userId}`);
    if (storeId) params.push(`store_id=${storeId}`);
    if (params.length) url += '?' + params.join('&');
    return apiFetch(url);
}

export async function apiDeleteUpload(id) {
    return apiFetch(`/upload/${id}`, { method: 'DELETE' });
}

// ─── Data (scoped by store_id or user_id) ────────────────────────
function dataQuery(storeId, userId) {
    const params = [];
    if (storeId) params.push(`store_id=${storeId}`);
    else if (userId) params.push(`user_id=${userId}`);
    return params.length ? '?' + params.join('&') : '';
}

export async function apiGetOrders(storeId, userId) {
    return apiFetch(`/data/orders${dataQuery(storeId, userId)}`);
}

export async function apiGetPayments(storeId, userId) {
    return apiFetch(`/data/payments${dataQuery(storeId, userId)}`);
}

export async function apiGetReturns(storeId, userId) {
    return apiFetch(`/data/returns${dataQuery(storeId, userId)}`);
}

export async function apiGetPengembalian(storeId, userId) {
    return apiFetch(`/data/pengembalian${dataQuery(storeId, userId)}`);
}

export async function apiGetStats(storeId, userId) {
    return apiFetch(`/data/stats${dataQuery(storeId, userId)}`);
}

export async function apiClearData(storeId) {
    return apiFetch(`/data/clear${dataQuery(storeId)}`, { method: 'DELETE' });
}

// ─── Modal Values ────────────────────────────────────────────────
export async function apiGetModalValues(storeId) {
    return apiFetch(`/modal${dataQuery(storeId)}`);
}

export async function apiSaveModalValues(values, storeId) {
    return apiFetch('/modal', {
        method: 'PUT',
        body: JSON.stringify({ values, store_id: storeId }),
    });
}

export async function apiSaveModalSingle(key, value, storeId) {
    return apiFetch('/modal/single', {
        method: 'PUT',
        body: JSON.stringify({ key, value, store_id: storeId }),
    });
}

// ─── Promo TikTok ─────────────────────────────────────────────────────
export async function apiGetPromoValues(storeId) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return apiFetch(`/promo${q}`);
}

export async function apiUploadPromoProducts(products, storeId) {
    return apiFetch('/promo/upload', {
        method: 'POST',
        body: JSON.stringify({ products, store_id: storeId }),
    });
}

export async function apiSavePromoBatch(updates, storeId) {
    return apiFetch('/promo/batch', {
        method: 'PUT',
        body: JSON.stringify({ updates, store_id: storeId }),
    });
}

export async function apiDeletePromoItems(ids, storeId) {
    return apiFetch('/promo', {
        method: 'DELETE',
        body: JSON.stringify({ ids, store_id: storeId }),
    });
}

// ─── Promo Shopee ─────────────────────────────────────────────────────
export async function apiGetPromoShopeeValues(storeId) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return apiFetch(`/promo-shopee${q}`);
}

export async function apiUploadPromoShopeeProducts(products, storeId) {
    return apiFetch('/promo-shopee/upload', {
        method: 'POST',
        body: JSON.stringify({ products, store_id: storeId }),
    });
}

export async function apiSavePromoShopeeBatch(updates, storeId) {
    return apiFetch('/promo-shopee/batch', {
        method: 'PUT',
        body: JSON.stringify({ updates, store_id: storeId }),
    });
}

export async function apiDeletePromoShopeeItems(ids, storeId) {
    return apiFetch('/promo-shopee', {
        method: 'DELETE',
        body: JSON.stringify({ ids, store_id: storeId }),
    });
}

// ─── Promo Templates / Presets ────────────────────────────────────────
export async function apiGetCampaignTemplates(storeId, platform = 'tiktok') {
    const q = storeId ? `?store_id=${storeId}&platform=${platform}` : `?platform=${platform}`;
    return apiFetch(`/promo/templates${q}`);
}

export async function apiSaveCampaignTemplate(storeId, platform, name, payload) {
    return apiFetch('/promo/templates', {
        method: 'POST',
        body: JSON.stringify({ store_id: storeId, platform, name, payload }),
    });
}

export async function apiDeleteCampaignTemplate(id) {
    return apiFetch(`/promo/templates/${id}`, { method: 'DELETE' });
}

// ─── Fee Profiles ───────────────────────────────────────────────────
export async function apiGetFeeProfiles(storeId) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return apiFetch(`/fee-profiles${q}`);
}

export async function apiSaveFeeProfile(data) {
    if (data.id) {
        return apiFetch(`/fee-profiles/${data.id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
    return apiFetch('/fee-profiles', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function apiDeleteFeeProfile(id) {
    return apiFetch(`/fee-profiles/${id}`, { method: 'DELETE' });
}
