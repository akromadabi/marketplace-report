import React, { useState } from 'react';
import { useAuth, ROLE_CONFIG } from '../../contexts/AuthContext';
import { Save, Check, Eye, EyeOff, UploadCloud } from 'lucide-react';
import { apiUpdateGlobalLogo } from '../../api';

function AdminSettings() {
    const { user, updateUser } = useAuth();
    const [form, setForm] = useState({ name: user?.name || '', password: '', confirmPassword: '' });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Global Logo State
    const [logoData, setLogoData] = useState('');
    const [logoPreview, setLogoPreview] = useState(`/api/logos/default_logo.png?v=${Date.now()}`);
    const [savingLogo, setSavingLogo] = useState(false);
    const [logoSuccess, setLogoSuccess] = useState(false);
    const [logoError, setLogoError] = useState('');

    async function handleSave() {
        setError('');
        setSuccess(false);

        if (!form.name.trim()) {
            setError('Nama tidak boleh kosong');
            return;
        }
        if (form.password && form.password !== form.confirmPassword) {
            setError('Password dan konfirmasi password tidak sama');
            return;
        }
        if (form.password && form.password.length < 4) {
            setError('Password minimal 4 karakter');
            return;
        }

        setSaving(true);
        try {
            const data = { name: form.name };
            if (form.password) data.password = form.password;
            await updateUser(user.id, data);
            setSuccess(true);
            setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    }

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                setLogoData(evt.target.result);
                setLogoPreview(evt.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveLogo = async () => {
        if (!logoData) {
            setLogoError('Silakan pilih gambar terlebih dahulu');
            return;
        }
        setSavingLogo(true);
        setLogoError('');
        setLogoSuccess(false);
        try {
            await apiUpdateGlobalLogo(logoData);
            setLogoSuccess(true);
            setLogoData('');
            setTimeout(() => setLogoSuccess(false), 3000);
            
            // Force update favicon
            let link = document.querySelector("link[rel~='icon']");
            if (link) link.href = `/api/logos/default_logo.png?v=${Date.now()}`;
        } catch (err) {
            setLogoError(err.message);
        }
        setSavingLogo(false);
    };

    const roleCfg = ROLE_CONFIG.admin;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Pengaturan
                </h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    Kelola akun admin Anda
                </p>
            </div>

            {/* Profile Card */}
            <div style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem', backdropFilter: 'blur(12px)',
                maxWidth: '560px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '3.5rem', height: '3.5rem', borderRadius: 'var(--radius-full)',
                        background: roleCfg.gradient, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem', color: '#fff',
                        boxShadow: `0 0 16px ${roleCfg.borderColor}`,
                    }}>
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name}</div>
                        <span className="badge" style={{
                            background: roleCfg.bgColor, color: roleCfg.color,
                            border: `1px solid ${roleCfg.borderColor}`,
                            fontSize: '0.625rem', padding: '0.125rem 0.5rem', marginTop: '0.25rem',
                        }}>{roleCfg.icon} Administrator</span>
                    </div>
                </div>

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
                    }}><Check size={14} /> Pengaturan berhasil disimpan!</div>
                )}

                <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                        Username
                    </label>
                    <input
                        type="text"
                        value={user?.username || ''}
                        disabled
                        style={{
                            width: '100%', padding: '0.625rem 0.75rem', background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                            color: 'var(--text-tertiary)', fontSize: '0.8125rem', outline: 'none',
                            boxSizing: 'border-box', opacity: 0.6,
                        }}
                    />
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                        Nama
                    </label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                        style={{
                            width: '100%', padding: '0.625rem 0.75rem', background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                        Password Baru (kosongkan jika tidak diubah)
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.password}
                            onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                            style={{
                                width: '100%', padding: '0.625rem 2.5rem 0.625rem 0.75rem', background: 'var(--bg-primary)',
                                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                            }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {form.password && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                            Konfirmasi Password
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.confirmPassword}
                            onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            style={{
                                width: '100%', padding: '0.625rem 0.75rem', background: 'var(--bg-primary)',
                                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                        justifyContent: 'center', padding: '0.75rem',
                        background: 'var(--gradient-primary)', color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600,
                        fontSize: '0.875rem', opacity: saving ? 0.6 : 1,
                    }}
                >
                    <Save size={16} />
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
            </div>

            {/* Global Settings Card */}
            <div style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem', backdropFilter: 'blur(12px)',
                maxWidth: '560px', marginTop: '1.5rem'
            }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        Pengaturan Website (Global)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                        Logo ini akan ditampilkan sebagai Favicon bawaan dan identitas utama aplikasi.
                    </p>
                </div>

                {logoError && (
                    <div style={{
                        background: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.2)',
                        borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '1rem',
                        color: '#e17055', fontSize: '0.8125rem',
                    }}>{logoError}</div>
                )}

                {logoSuccess && (
                    <div style={{
                        background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)',
                        borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '1rem',
                        color: '#00b894', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}><Check size={14} /> Logo global berhasil diperbarui!</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '5rem', height: '5rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-medium)'
                    }}>
                        <img 
                            src={logoPreview} 
                            alt="Global Logo" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.8125rem',
                            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                            <UploadCloud size={16} /> Pilih Gambar
                            <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                        </label>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                            Format yang disarankan: PNG, JPG, atau SVG (1:1 rasio).
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSaveLogo}
                    disabled={savingLogo || !logoData}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                        justifyContent: 'center', padding: '0.75rem',
                        background: 'var(--gradient-primary)', color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-md)', cursor: (!logoData || savingLogo) ? 'not-allowed' : 'pointer', fontWeight: 600,
                        fontSize: '0.875rem', opacity: (!logoData || savingLogo) ? 0.6 : 1,
                    }}
                >
                    <Save size={16} />
                    {savingLogo ? 'Menyimpan Logo...' : 'Simpan Logo'}
                </button>
            </div>
        </div>
    );
}

export default AdminSettings;
