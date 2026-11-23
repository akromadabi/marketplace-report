// Lightweight IndexedDB key-value store for persistent processed Excel snapshots.
// Ensures Excel data is parsed/joined only ONCE and persists across page reloads
// until a file is uploaded or deleted.

const DB_NAME = 'MarketplaceReportCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

let dbPromise = null;

function openDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return Promise.resolve(null);
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        try {
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

    return dbPromise;
}

export async function idbGet(key) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

export async function idbSet(key, value) {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(value, key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        } catch {
            resolve(false);
        }
    });
}

export async function idbDelete(key) {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        } catch {
            resolve(false);
        }
    });
}

export async function idbClear() {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        } catch {
            resolve(false);
        }
    });
}
