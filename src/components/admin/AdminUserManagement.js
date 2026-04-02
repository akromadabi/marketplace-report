import React, { useState, useEffect } from 'react';
import { useAuth, CLASS_CONFIG } from '../../contexts/AuthContext';
import { Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronUp, Store, Package } from 'lucide-react';

function AdminUserManagement() {
    const { getUsers, addUser, updateUser, deleteUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', name: '', class: 'silver', store_name: '', status: 'active' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [expandedUser, setExpandedUser] = useState(null);

    const loadUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data.filter(u => u.role !== 'admin'));
        } catch (e) { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { loadUsers(); }, [getUsers]); // eslint-disable-line

    function openAdd() {
        setForm({ username: '', password: '', name: '', class: 'silver', store_name: '', status: 'active' });
        setEditUser(null);
        setError('');
        setModal('add');
    }

    function openEdit(u) {
        setForm({ username: u.username, password: '', name: u.name, class: u.class || 'silver', store_name: u.store_name || '', status: u.status || 'active' });
        setEditUser(u);
        setError('');
        setModal('edit');
    }

    async function handleSave() {
        if (!form.username || !form.name || (modal === 'add' && !form.password)) {
            setError('Username, nama, dan password wajib diisi');
            return;
        }
        setSaving(true);
        setError('');
        try {
            if (modal === 'add') {
                await addUser({ ...form, role: 'user' });
            } else {
                const updateData = { ...form, role: 'user' };
                if (!updateData.password) delete updateData.password;
                await updateUser(editUser.id, updateData);
            }
            setModal(null);
            await loadUsers();
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    }

    async function handleDelete(id) {
        if (!window.confirm('Hapus user ini?')) return;
        try {
            await deleteUser(id);
            await loadUsers();
        } catch (e) { /* ignore */ }
    }

    async function toggleStatus(u) {
        try {
            await updateUser(u.id, { status: u.status === 'active' ? 'inactive' : 'active' });
            await loadUsers();
        } catch (e) { /* ignore */ }
    }

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.store_name || '').toLowerCase().includes(search.toLowerCase())
    );

    const fmt = n => Number(n).toLocaleString('id-ID');

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-tertiary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        width: '2rem', height: '2rem', border: '3px solid var(--border-medium)',
                        borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem',
                    }} />
                    <span style={{ fontSize: '0.875rem' }}>Memuat data...</span>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        Manajemen User
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                        Kelola semua pengguna, kelas, dan status akun
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem',
                        background: 'var(--gradient-primary)', color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem',
                    }}
                >
                    <Plus size={16} /> Tambah User
                </button>
            </div>

            {/* Search */}
            <div style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
                <Search size={16} color="var(--text-tertiary)" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama, username, atau toko..."
                    style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', fontSize: '0.8125rem',
                    }}
                />
                {search && (
                    <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* User Cards */}
            <div style={{ display: 'grid', gap: '0.75rem' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Tidak ada data.</div>
                ) : filtered.map(u => {
                    const cls = CLASS_CONFIG[u.class] || CLASS_CONFIG.silver;
                    const isExpanded = expandedUser === u.id;
                    const stores = u.stores || [];
                    const storeCount = u.store_count || 0;
                    const orderCount = u.order_count || 0;
                    const limits = u.limits || { max_stores: -1, max_orders: -1 };
                    const maxStoresLabel = limits.max_stores === -1 ? '∞' : fmt(limits.max_stores);
                    const maxOrdersLabel = limits.max_orders === -1 ? '∞' : fmt(limits.max_orders);

                    return (
                        <div key={u.id} style={{
                            background: 'var(--bg-glass)', border: `1px solid ${isExpanded ? cls.borderColor : 'var(--border-subtle)'}`,
                            borderRadius: 'var(--radius-lg)', overflow: 'hidden', backdropFilter: 'blur(12px)',
                            transition: 'all var(--transition-fast)',
                        }}>
                            {/* Main Row */}
                            <div
                                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                style={{
                                    padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center',
                                    gap: '0.75rem', cursor: 'pointer',
                                }}
                            >
                                {/* Avatar */}
                                <div style={{
                                    width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-full)',
                                    background: cls.gradient, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: '#fff', flexShrink: 0,
                                }}>
                                    {u.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                            {u.name}
                                        </span>
                                        <span className="badge" style={{
                                            background: cls.bgColor, color: cls.color,
                                            border: `1px solid ${cls.borderColor}`, fontSize: '0.5625rem', padding: '0.0625rem 0.375rem',
                                        }}>{cls.icon} {cls.label}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleStatus(u); }}
                                            style={{
                                                background: u.status === 'active' ? 'rgba(0,184,148,0.1)' : 'rgba(225,112,85,0.1)',
                                                color: u.status === 'active' ? '#00b894' : '#e17055',
                                                border: `1px solid ${u.status === 'active' ? 'rgba(0,184,148,0.2)' : 'rgba(225,112,85,0.2)'}`,
                                                borderRadius: 'var(--radius-sm)', padding: '0.125rem 0.5rem',
                                                cursor: 'pointer', fontSize: '0.5625rem', fontWeight: 600,
                                            }}
                                        >
                                            {u.status === 'active' ? '● Aktif' : '○ Nonaktif'}
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.125rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <span>@{u.username}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Store size={10} /> {storeCount}/{maxStoresLabel}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Package size={10} /> {fmt(orderCount)}/{maxOrdersLabel}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => openEdit(u)}
                                        style={{
                                            width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(9,132,227,0.1)', border: '1px solid rgba(9,132,227,0.2)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        <Pencil size={14} color="#0984e3" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(u.id)}
                                        style={{
                                            width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.2)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        <Trash2 size={14} color="#e17055" />
                                    </button>
                                </div>

                                {/* Expand Toggle */}
                                <div style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {isExpanded && (
                                <div style={{
                                    padding: '0 1.25rem 1rem', borderTop: `1px solid ${cls.borderColor}`,
                                    paddingTop: '0.875rem', animation: 'fadeIn 0.2s ease',
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        {/* Stores */}
                                        <div style={{
                                            background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                                            padding: '0.875rem', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                                🏪 Toko ({storeCount}/{maxStoresLabel})
                                            </div>
                                            {stores.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    {stores.map((name, i) => (
                                                        <div key={i} style={{
                                                            fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500,
                                                            padding: '0.25rem 0.5rem', background: cls.bgColor,
                                                            borderRadius: 'var(--radius-sm)', border: `1px solid ${cls.borderColor}`,
                                                        }}>
                                                            {name}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Belum ada toko</div>
                                            )}
                                        </div>

                                        {/* Limits & Usage */}
                                        <div style={{
                                            background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                                            padding: '0.875rem', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                                📊 Penggunaan & Limit
                                            </div>
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                {/* Store progress */}
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                        <span>Toko</span>
                                                        <span style={{ fontWeight: 600 }}>{storeCount} / {maxStoresLabel}</span>
                                                    </div>
                                                    <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: '3px',
                                                            background: cls.gradient,
                                                            width: limits.max_stores === -1 ? '10%' : `${Math.min(100, (storeCount / limits.max_stores) * 100)}%`,
                                                            transition: 'width 0.3s ease',
                                                        }} />
                                                    </div>
                                                </div>
                                                {/* Order progress */}
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                        <span>Pesanan</span>
                                                        <span style={{ fontWeight: 600 }}>{fmt(orderCount)} / {maxOrdersLabel}</span>
                                                    </div>
                                                    <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: '3px',
                                                            background: cls.gradient,
                                                            width: limits.max_orders === -1 ? '10%' : `${Math.min(100, (orderCount / limits.max_orders) * 100)}%`,
                                                            transition: 'width 0.3s ease',
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {modal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setModal(null)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xl)', padding: '1.5rem', width: '100%', maxWidth: '440px',
                            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                        }}
                    >
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
                            {modal === 'add' ? 'Tambah User Baru' : 'Edit User'}
                        </h2>

                        {error && (
                            <div style={{
                                background: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.2)',
                                borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '1rem',
                                color: '#e17055', fontSize: '0.8125rem',
                            }}>{error}</div>
                        )}

                        {[
                            { key: 'name', label: 'Nama Lengkap', type: 'text' },
                            { key: 'username', label: 'Username', type: 'text' },
                            { key: 'password', label: modal === 'add' ? 'Password' : 'Password (kosongkan jika tidak diubah)', type: 'password' },
                            { key: 'store_name', label: 'Nama Toko', type: 'text' },
                        ].map(f => (
                            <div key={f.key} style={{ marginBottom: '0.875rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                                    {f.label}
                                </label>
                                <input
                                    type={f.type}
                                    value={form[f.key]}
                                    onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    style={{
                                        width: '100%', padding: '0.625rem 0.75rem', background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        ))}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                                    Kelas
                                </label>
                                <select
                                    value={form.class}
                                    onChange={(e) => setForm(prev => ({ ...prev, class: e.target.value }))}
                                    style={{
                                        width: '100%', padding: '0.625rem 0.75rem', background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
                                    }}
                                >
                                    <option value="platinum">💎 Platinum</option>
                                    <option value="gold">⭐ Gold</option>
                                    <option value="silver">🥈 Silver</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                                    Status
                                </label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                                    style={{
                                        width: '100%', padding: '0.625rem 0.75rem', background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
                                    }}
                                >
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Nonaktif</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setModal(null)}
                                style={{
                                    padding: '0.625rem 1.25rem', background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600,
                                }}
                            >Batal</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    padding: '0.625rem 1.25rem', background: 'var(--gradient-primary)',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    color: '#fff', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600,
                                    opacity: saving ? 0.6 : 1,
                                }}
                            >{saving ? 'Menyimpan...' : 'Simpan'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminUserManagement;
