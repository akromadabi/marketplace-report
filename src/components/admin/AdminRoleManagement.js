import React, { useState, useEffect } from 'react';
import { useAuth, CLASS_CONFIG, ALL_USER_FEATURES } from '../../contexts/AuthContext';
import { apiGetClassLimits, apiUpdateClassLimits } from '../../api';
import { Check, Save, Users, Infinity, Settings2, X } from 'lucide-react';

function AdminRoleManagement() {
    const { getRoles, updateRole, getUsers } = useAuth();
    const [permissions, setPermissions] = useState({});
    const [limits, setLimits] = useState({});
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(null);
    const [editingClass, setEditingClass] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [roles, allUsers, classLimits] = await Promise.all([
                    getRoles(), getUsers(), apiGetClassLimits()
                ]);
                setPermissions(roles);
                setUsers(allUsers.filter(u => u.role !== 'admin'));
                const limState = {};
                for (const cls of ['platinum', 'gold', 'silver']) {
                    const l = classLimits[cls] || { max_stores: -1, max_orders: -1 };
                    limState[cls] = {
                        max_stores: l.max_stores === -1 ? '' : String(l.max_stores),
                        max_orders: l.max_orders === -1 ? '' : String(l.max_orders),
                        unlimited_stores: l.max_stores === -1,
                        unlimited_orders: l.max_orders === -1,
                    };
                }
                setLimits(limState);
            } catch (e) { /* ignore */ }
            setLoading(false);
        })();
    }, [getRoles, getUsers]);

    function togglePerm(className, perm) {
        setPermissions(prev => {
            const current = prev[className] || [];
            const has = current.includes(perm);
            return { ...prev, [className]: has ? current.filter(p => p !== perm) : [...current, perm] };
        });
    }

    function updateLimit(cls, field, value) {
        setLimits(prev => ({ ...prev, [cls]: { ...prev[cls], [field]: value } }));
    }

    function toggleUnlimited(cls, type) {
        setLimits(prev => {
            const cur = prev[cls];
            return { ...prev, [cls]: { ...cur, [`unlimited_${type}`]: !cur[`unlimited_${type}`], [`max_${type}`]: !cur[`unlimited_${type}`] ? '' : cur[`max_${type}`] } };
        });
    }

    async function handleSave(className) {
        setSaving(true);
        setSaveSuccess(null);
        try {
            await updateRole(className, permissions[className] || []);
            const l = limits[className];
            await apiUpdateClassLimits(className, {
                max_stores: l.unlimited_stores ? -1 : Math.max(1, parseInt(l.max_stores) || 1),
                max_orders: l.unlimited_orders ? -1 : Math.max(1, parseInt(l.max_orders) || 1),
            });
            setSaveSuccess(className);
            setEditingClass(null);
            setTimeout(() => setSaveSuccess(null), 2000);
        } catch (e) {
            console.error('Save error:', e);
        }
        setSaving(false);
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-tertiary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem' }} />
                    <span style={{ fontSize: '0.875rem' }}>Memuat data...</span>
                </div>
            </div>
        );
    }

    const classes = ['platinum', 'gold', 'silver'];
    const inputStyle = {
        padding: '0.5rem 0.75rem', background: 'var(--bg-primary)',
        border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box',
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Manajemen Kelas
                </h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    Klik kelas untuk mengatur fitur dan limit
                </p>
            </div>

            {/* Edit Popup */}
            {editingClass && (() => {
                const cls = editingClass;
                const cfg = CLASS_CONFIG[cls];
                const classPerms = permissions[cls] || [];
                const l = limits[cls] || {};
                const classUsers = users.filter(u => u.class === cls);

                return (
                    <div onClick={() => setEditingClass(null)} style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <div onClick={e => e.stopPropagation()} className="glass-card" style={{
                            padding: 0, width: '90%', maxWidth: '560px', maxHeight: '85vh', overflow: 'auto',
                            animation: 'fadeInUp 0.3s ease both',
                        }}>
                            {/* Popup Header */}
                            <div style={{
                                padding: '1.25rem 1.5rem', background: cfg.bgColor,
                                borderBottom: `1px solid ${cfg.borderColor}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                position: 'sticky', top: 0, zIndex: 1,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)',
                                        background: cfg.gradient, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '1.25rem',
                                    }}>{cfg.icon}</div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Pengaturan {cfg.label}
                                        </h3>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                            {classUsers.length} pengguna
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setEditingClass(null)} style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-tertiary)', padding: '0.375rem',
                                }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Limits Section */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${cfg.borderColor}` }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                    Batas Penggunaan
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Max Toko</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input type="number" min="1"
                                                value={l.unlimited_stores ? '' : l.max_stores}
                                                onChange={e => updateLimit(cls, 'max_stores', e.target.value)}
                                                disabled={l.unlimited_stores}
                                                placeholder={l.unlimited_stores ? '∞ Unlimited' : '1'}
                                                style={{ ...inputStyle, opacity: l.unlimited_stores ? 0.4 : 1, flex: 1 }}
                                            />
                                            <button type="button" onClick={() => toggleUnlimited(cls, 'stores')} title="Unlimited" style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '2.5rem', height: '2.5rem', flexShrink: 0,
                                                background: l.unlimited_stores ? cfg.bgColor : 'var(--bg-primary)',
                                                border: `1px solid ${l.unlimited_stores ? cfg.borderColor : 'var(--border-medium)'}`,
                                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                color: l.unlimited_stores ? cfg.color : 'var(--text-tertiary)',
                                            }}>
                                                <Infinity size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Max Pesanan</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input type="number" min="1"
                                                value={l.unlimited_orders ? '' : l.max_orders}
                                                onChange={e => updateLimit(cls, 'max_orders', e.target.value)}
                                                disabled={l.unlimited_orders}
                                                placeholder={l.unlimited_orders ? '∞ Unlimited' : '1'}
                                                style={{ ...inputStyle, opacity: l.unlimited_orders ? 0.4 : 1, flex: 1 }}
                                            />
                                            <button type="button" onClick={() => toggleUnlimited(cls, 'orders')} title="Unlimited" style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '2.5rem', height: '2.5rem', flexShrink: 0,
                                                background: l.unlimited_orders ? cfg.bgColor : 'var(--bg-primary)',
                                                border: `1px solid ${l.unlimited_orders ? cfg.borderColor : 'var(--border-medium)'}`,
                                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                color: l.unlimited_orders ? cfg.color : 'var(--text-tertiary)',
                                            }}>
                                                <Infinity size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Permissions Section */}
                            <div style={{ padding: '1.25rem 1.5rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                    Fitur yang diizinkan
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                                    {ALL_USER_FEATURES.filter(f => f.path !== '/' && f.path !== '/upload').map(feature => {
                                        const active = classPerms.includes(feature.path);
                                        return (
                                            <button
                                                key={feature.path}
                                                onClick={() => togglePerm(cls, feature.path)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.625rem 0.75rem',
                                                    background: active ? cfg.bgColor : 'var(--bg-primary)',
                                                    border: `1px solid ${active ? cfg.borderColor : 'var(--border-subtle)'}`,
                                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                    color: active ? cfg.color : 'var(--text-tertiary)',
                                                    fontWeight: active ? 600 : 500, fontSize: '0.8125rem',
                                                    transition: 'all var(--transition-fast)',
                                                }}
                                            >
                                                <div style={{
                                                    width: '1.25rem', height: '1.25rem', borderRadius: '4px',
                                                    background: active ? cfg.gradient : 'transparent',
                                                    border: active ? 'none' : '2px solid var(--border-medium)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    {active && <Check size={12} color="#fff" strokeWidth={3} />}
                                                </div>
                                                {feature.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{
                                    marginTop: '0.75rem', padding: '0.5rem 0.75rem',
                                    background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.6875rem', color: 'var(--text-tertiary)',
                                }}>
                                    💡 Dashboard dan Upload File selalu tersedia untuk semua kelas.
                                </div>
                            </div>

                            {/* Popup Footer */}
                            <div style={{
                                padding: '1rem 1.5rem', borderTop: `1px solid ${cfg.borderColor}`,
                                display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
                                position: 'sticky', bottom: 0, background: 'var(--bg-glass)',
                            }}>
                                <button type="button" onClick={() => setEditingClass(null)} style={{
                                    padding: '0.625rem 1.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                                    borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                                }}>Batal</button>
                                <button onClick={() => handleSave(cls)} disabled={saving} style={{
                                    padding: '0.625rem 1.5rem', background: cfg.gradient, border: 'none',
                                    borderRadius: 'var(--radius-md)', color: 'white', fontSize: '0.8125rem', fontWeight: 600,
                                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                }}>
                                    <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Class Cards */}
            <div style={{ display: 'grid', gap: '1rem' }}>
                {classes.map(cls => {
                    const cfg = CLASS_CONFIG[cls];
                    const classUsers = users.filter(u => u.class === cls);
                    const classPerms = permissions[cls] || [];
                    const l = limits[cls] || {};
                    const storeLabel = l.unlimited_stores ? '∞' : (l.max_stores || '-');
                    const orderLabel = l.unlimited_orders ? '∞' : (l.max_orders ? Number(l.max_orders).toLocaleString() : '-');
                    const activeFeatures = ALL_USER_FEATURES.filter(f => f.path !== '/' && f.path !== '/upload' && classPerms.includes(f.path));

                    return (
                        <div
                            key={cls}
                            onClick={() => setEditingClass(cls)}
                            style={{
                                background: 'var(--bg-glass)', border: `1px solid ${cfg.borderColor}`,
                                borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem',
                                backdropFilter: 'blur(12px)', cursor: 'pointer',
                                transition: 'all var(--transition-fast)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = cfg.borderColor; e.currentTarget.style.transform = 'none'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)',
                                    background: cfg.gradient, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
                                }}>{cfg.icon}</div>
                                <div>
                                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                        {cfg.label}
                                        {saveSuccess === cls && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#00b894' }}>✓ Tersimpan</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Users size={12} /> {classUsers.length}</span>
                                        <span>🏪 {storeLabel} toko</span>
                                        <span>📦 {orderLabel} pesanan</span>
                                        <span>⚡ {activeFeatures.length + 2} fitur</span>
                                    </div>
                                </div>
                            </div>
                            <Settings2 size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AdminRoleManagement;
