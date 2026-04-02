import React, { useState } from 'react';
import { useAuth, CLASS_CONFIG } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { apiUpdateProfile } from '../api';
import { User, Save, Check, Eye, EyeOff, Shield, Store, Clock, Package } from 'lucide-react';

function UserProfile() {
    const { user, setUser } = useAuth();
    const { stores, activeStore } = useStore();
    const [form, setForm] = useState({
        name: user?.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const classCfg = user ? (CLASS_CONFIG[user.class] || CLASS_CONFIG.silver) : CLASS_CONFIG.silver;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    async function handleSave() {
        setError('');
        setSuccess(false);

        if (!form.name.trim()) { setError('Nama tidak boleh kosong'); return; }
        if (form.newPassword) {
            if (!form.currentPassword) { setError('Masukkan password saat ini untuk mengubah password'); return; }
            if (form.newPassword.length < 4) { setError('Password baru minimal 4 karakter'); return; }
            if (form.newPassword !== form.confirmPassword) { setError('Password baru dan konfirmasi tidak sama'); return; }
        }

        setSaving(true);
        try {
            const payload = { name: form.name.trim() };
            if (form.newPassword) {
                payload.currentPassword = form.currentPassword;
                payload.newPassword = form.newPassword;
            }
            const result = await apiUpdateProfile(user.id, payload);
            if (result.user && setUser) {
                setUser(prev => ({ ...prev, name: result.user.name }));
            }
            setSuccess(true);
            setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    }

    const inputStyle = {
        width: '100%', padding: isMobile ? '0.5rem 0.625rem' : '0.625rem 0.75rem', background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)', fontSize: isMobile ? '0.75rem' : '0.8125rem', outline: 'none', boxSizing: 'border-box',
        transition: 'border-color var(--transition-fast)',
    };

    const labelStyle = {
        display: 'block', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: 600,
        color: 'var(--text-secondary)', marginBottom: isMobile ? '0.25rem' : '0.375rem',
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                <User size={isMobile ? 18 : 24} color="var(--accent-primary)" />
                <div>
                    <h2 className="gradient-text" style={{ margin: 0, fontSize: isMobile ? '1.125rem' : undefined }}>Profil Saya</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '0.6875rem' : '0.875rem', margin: '0.125rem 0 0' }}>Kelola informasi akun Anda</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: isMobile ? '0.75rem' : '1.5rem', maxWidth: '900px' }}>

                {/* Profile Card */}
                <div className="glass-card" style={{ padding: isMobile ? '0.875rem' : '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.625rem' : '1rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                        <div style={{
                            width: isMobile ? '2.5rem' : '3.5rem', height: isMobile ? '2.5rem' : '3.5rem', borderRadius: 'var(--radius-full)',
                            background: classCfg.gradient, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 700, fontSize: isMobile ? '0.875rem' : '1.25rem', color: '#fff',
                            boxShadow: `0 0 16px ${classCfg.borderColor}`,
                        }}>
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: isMobile ? '0.875rem' : '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name}</div>
                            <span className="badge" style={{
                                background: classCfg.bgColor, color: classCfg.color,
                                border: `1px solid ${classCfg.borderColor}`,
                                fontSize: isMobile ? '0.5625rem' : '0.625rem', padding: '0.125rem 0.5rem', marginTop: '0.125rem',
                            }}>{classCfg.icon} {classCfg.label}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: isMobile ? '0.375rem' : '0.5rem', marginBottom: isMobile ? '0' : '1.25rem' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem',
                            padding: isMobile ? '0.4rem 0.625rem' : '0.625rem 0.75rem', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                        }}>
                            <Shield size={isMobile ? 12 : 14} color="var(--text-tertiary)" />
                            <div>
                                <div style={{ fontSize: isMobile ? '0.5625rem' : '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Username</div>
                                <div style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem',
                            padding: isMobile ? '0.4rem 0.625rem' : '0.625rem 0.75rem', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                        }}>
                            <Store size={isMobile ? 12 : 14} color="var(--text-tertiary)" />
                            <div>
                                <div style={{ fontSize: isMobile ? '0.5625rem' : '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Toko Aktif</div>
                                <div style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                    {activeStore ? activeStore.name : 'Belum dipilih'}
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem',
                            padding: isMobile ? '0.4rem 0.625rem' : '0.625rem 0.75rem', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                        }}>
                            <Package size={isMobile ? 12 : 14} color="var(--text-tertiary)" />
                            <div>
                                <div style={{ fontSize: isMobile ? '0.5625rem' : '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Jumlah Toko</div>
                                <div style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{stores.length} toko</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="glass-card" style={{ padding: isMobile ? '0.875rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: isMobile ? '0.75rem' : '1.25rem' }}>
                        Edit Profil
                    </h3>

                    {error && (
                        <div style={{
                            background: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.2)',
                            borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '1rem',
                            color: '#e17055', fontSize: '0.8125rem',
                        }}>{error}</div>
                    )}

                    {success && (
                        <div style={{
                            background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)',
                            borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '1rem',
                            color: '#00b894', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}><Check size={14} /> Profil berhasil diperbarui!</div>
                    )}

                    {/* Username (disabled) */}
                    <div style={{ marginBottom: isMobile ? '0.625rem' : '0.875rem' }}>
                        <label style={labelStyle}>Username</label>
                        <input type="text" value={user?.username || ''} disabled
                            style={{ ...inputStyle, opacity: 0.6, color: 'var(--text-tertiary)' }}
                        />
                    </div>

                    {/* Name */}
                    <div style={{ marginBottom: isMobile ? '0.625rem' : '0.875rem' }}>
                        <label style={labelStyle}>Nama Lengkap</label>
                        <input type="text" value={form.name}
                            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                            style={inputStyle}
                        />
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: isMobile ? '0.75rem 0' : '1.25rem 0' }} />
                    <h4 style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
                        Ubah Password
                    </h4>

                    {/* Current Password */}
                    <div style={{ marginBottom: isMobile ? '0.625rem' : '0.875rem' }}>
                        <label style={labelStyle}>Password Saat Ini</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPassword ? 'text' : 'password'} value={form.currentPassword}
                                onChange={(e) => setForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                placeholder="Wajib diisi untuk ubah password"
                                style={{ ...inputStyle, paddingRight: '2.5rem' }}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                                }}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div style={{ marginBottom: isMobile ? '0.625rem' : '0.875rem' }}>
                        <label style={labelStyle}>Password Baru</label>
                        <input type={showPassword ? 'text' : 'password'} value={form.newPassword}
                            onChange={(e) => setForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            placeholder="Kosongkan jika tidak diubah"
                            style={inputStyle}
                        />
                    </div>

                    {/* Confirm New Password */}
                    {form.newPassword && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>Konfirmasi Password Baru</label>
                            <input type={showPassword ? 'text' : 'password'} value={form.confirmPassword}
                                onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>
                    )}

                    <button onClick={handleSave} disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                            justifyContent: 'center', padding: isMobile ? '0.625rem' : '0.75rem',
                            background: 'var(--gradient-primary)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600,
                            fontSize: isMobile ? '0.8125rem' : '0.875rem', opacity: saving ? 0.6 : 1,
                            transition: 'opacity var(--transition-fast)',
                        }}
                    >
                        <Save size={16} />
                        {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UserProfile;
