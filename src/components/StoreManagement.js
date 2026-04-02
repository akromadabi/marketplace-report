import React, { useState, useEffect, useCallback } from 'react';
import { Store, Plus, Edit3, Trash2, Package, ShoppingBag } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

function StoreManagement() {
    const { stores, addStore, editStore, removeStore, activeStore, setActiveStore, loading } = useStore();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', platform: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const maxStores = user?.limits?.max_stores ?? -1;
    const storeLimit = maxStores !== -1 ? maxStores : Infinity;
    const limitReached = stores.length >= storeLimit;

    const resetForm = useCallback(() => {
        setForm({ name: '', platform: '', description: '' });
        setEditingId(null);
        setShowForm(false);
        setError('');
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Nama toko wajib diisi'); return; }
        setSaving(true);
        setError('');
        try {
            if (editingId) {
                await editStore(editingId, form);
            } else {
                await addStore(form);
            }
            resetForm();
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const handleEdit = (store) => {
        setForm({ name: store.name, platform: store.platform || '', description: store.description || '' });
        setEditingId(store.id);
        setShowForm(true);
    };

    const handleDelete = async (store) => {
        if (!window.confirm(`Hapus toko "${store.name}"?\n\nSemua data (orders, payments, returns) yang terkait akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) return;
        try {
            await removeStore(store.id);
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-tertiary)' }}>
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem' }} />
                <span style={{ fontSize: '0.875rem' }}>Memuat toko...</span>
            </div>
        </div>
    );

    const cardStyle = {
        padding: '1.5rem', position: 'relative', overflow: 'hidden',
        cursor: 'pointer', transition: 'all var(--transition-fast)',
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ margin: 0 }}>Kelola Toko</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                        Kelola toko marketplace Anda. Pilih toko aktif untuk melihat data yang sesuai.
                    </p>
                </div>
                <button onClick={() => { if (limitReached) return; resetForm(); setShowForm(true); }} disabled={limitReached} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem',
                    background: limitReached ? 'var(--bg-secondary)' : 'var(--accent-primary)', border: 'none', borderRadius: 'var(--radius-full)',
                    cursor: limitReached ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                    color: limitReached ? 'var(--text-tertiary)' : 'white',
                    boxShadow: limitReached ? 'none' : 'var(--shadow-sm)', transition: 'all var(--transition-fast)',
                    opacity: limitReached ? 0.7 : 1,
                }}>
                    <Plus size={16} /> {limitReached ? `Limit ${maxStores} Toko` : 'Tambah Toko'}
                </button>
            </div>

            {/* Store Form Popup */}
            {showForm && (
                <div onClick={resetForm} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.2s ease',
                }}>
                    <div onClick={e => e.stopPropagation()} className="glass-card" style={{
                        padding: '2rem', width: '90%', maxWidth: '480px',
                        animation: 'fadeInUp 0.3s ease both',
                    }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                            {editingId ? 'Edit Toko' : 'Tambah Toko Baru'}
                        </h3>
                        {error && <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{error}</p>}
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Nama Toko *</label>
                                    <input
                                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Contoh: Toko Baju Online" autoFocus
                                        style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Platform</label>
                                    <select
                                        value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                                        style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                    >
                                        <option value="">Campuran / Multi-Platform</option>
                                        <option value="shopee">Shopee</option>
                                        <option value="tiktok">TikTok Shop</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Deskripsi</label>
                                    <input
                                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Opsional"
                                        style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={resetForm} style={{
                                    padding: '0.625rem 1.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                                    borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                                }}>Batal</button>
                                <button type="submit" disabled={saving} style={{
                                    padding: '0.625rem 1.25rem', background: 'var(--accent-primary)', border: 'none',
                                    borderRadius: 'var(--radius-md)', color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                                }}>
                                    {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Toko'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Store Cards */}
            {stores.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <Store size={48} color="var(--text-tertiary)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Belum Ada Toko</h3>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Klik "Tambah Toko" untuk membuat toko pertama Anda</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {stores.map(store => {
                        const isActive = activeStore && activeStore.id === store.id;
                        return (
                            <div
                                key={store.id}
                                className="glass-card"
                                style={{
                                    ...cardStyle,
                                    border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    animation: 'fadeInUp 0.3s ease both',
                                }}
                                onClick={() => setActiveStore(store)}
                            >
                                {isActive && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(135deg, var(--accent-primary), #06b6d4)' }} />
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)',
                                            background: isActive ? 'linear-gradient(135deg, var(--accent-primary), #06b6d4)' : 'var(--bg-secondary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Store size={18} color={isActive ? 'white' : 'var(--text-tertiary)'} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{store.name}</h3>
                                            {store.platform && <span style={{
                                                display: 'inline-block', fontSize: '0.625rem', fontWeight: 700,
                                                padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)',
                                                background: store.platform === 'shopee' ? 'rgba(255, 87, 34, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                                                color: store.platform === 'shopee' ? '#ff5722' : 'var(--text-secondary)',
                                                textTransform: 'uppercase', marginTop: '0.25rem',
                                            }}>{store.platform}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleEdit(store)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', borderRadius: 'var(--radius-sm)' }}>
                                            <Edit3 size={14} color="var(--text-tertiary)" />
                                        </button>
                                        <button onClick={() => handleDelete(store)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', borderRadius: 'var(--radius-sm)' }}>
                                            <Trash2 size={14} color="#ef4444" />
                                        </button>
                                    </div>
                                </div>
                                {store.description && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{store.description}</p>}
                                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Package size={12} /> {store.upload_count || 0} upload</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ShoppingBag size={12} /> {store.order_count || 0} order</span>
                                </div>
                                {isActive && (
                                    <div style={{
                                        marginTop: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-full)',
                                        background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-primary)',
                                        fontSize: '0.6875rem', fontWeight: 700, textAlign: 'center',
                                    }}>✓ Toko Aktif</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default StoreManagement;
