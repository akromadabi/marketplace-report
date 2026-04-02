import React, { useState, useEffect } from 'react';
import { useAuth, CLASS_CONFIG } from '../contexts/AuthContext';

function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError('Masukkan username dan password');
            return;
        }
        setIsLoading(true);
        setError('');
        // Simulate small delay for UX
        await new Promise((r) => setTimeout(r, 600));
        const result = await login(username.trim(), password);
        if (!result.success) {
            setError(result.error);
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Animated background orbs */}
            <div className="login-bg-orbs">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>

            <div className={`login-container ${mounted ? 'login-visible' : ''}`}>
                {/* Logo / Header */}
                <div className="login-header">
                    <div className="login-logo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#loginGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <defs>
                                <linearGradient id="loginGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#7c3aed" />
                                    <stop offset="100%" stopColor="#06b6d4" />
                                </linearGradient>
                            </defs>
                            <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                            <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
                            <path d="M12 3v6" />
                        </svg>
                    </div>
                    <h1 className="login-title">
                        <span className="gradient-text">Marketplace</span> Report
                    </h1>
                    <p className="login-subtitle">Masuk untuk mengakses dashboard analitik</p>
                </div>

                {/* Login Form Card */}
                <form className="login-card glass-card" onSubmit={handleSubmit}>
                    {/* Error message */}
                    {error && (
                        <div className="login-error">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Username */}
                    <div className="login-field">
                        <label htmlFor="login-username" className="login-label">Username</label>
                        <div className="login-input-wrapper">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-input-icon">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <input
                                id="login-username"
                                type="text"
                                className="form-input login-input"
                                placeholder="Masukkan username"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                                autoComplete="username"
                                autoFocus
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="login-field">
                        <label htmlFor="login-password" className="login-label">Password</label>
                        <div className="login-input-wrapper">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-input-icon">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                className="form-input login-input"
                                placeholder="Masukkan password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="login-toggle-pw"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className="btn-primary login-submit"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="login-spinner" />
                                Memproses...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                    <polyline points="10 17 15 12 10 7" />
                                    <line x1="15" y1="12" x2="3" y2="12" />
                                </svg>
                                Masuk
                            </>
                        )}
                    </button>
                </form>

                {/* Quick Login for Testing */}
                <div className="login-roles-info">
                    <p className="login-roles-title">⚡ Login Cepat (Testing)</p>
                    <div className="login-roles-grid">
                        {[
                            { user: 'admin', pass: 'admin123', label: 'Admin', icon: '👑', color: '#6c5ce7', bg: 'rgba(108,92,231,0.08)', border: 'rgba(108,92,231,0.25)' },
                            { user: 'platinum', pass: 'platinum', label: 'Platinum', icon: '💎', color: '#0984e3', bg: 'rgba(9,132,227,0.08)', border: 'rgba(9,132,227,0.25)' },
                            { user: 'gold', pass: 'gold', label: 'Gold', icon: '⭐', color: '#e67e22', bg: 'rgba(230,126,34,0.08)', border: 'rgba(230,126,34,0.25)' },
                            { user: 'silver', pass: 'silver', label: 'Silver', icon: '🥈', color: '#636e72', bg: 'rgba(99,110,114,0.08)', border: 'rgba(99,110,114,0.2)' },
                        ].map((acc) => (
                            <button
                                key={acc.user}
                                type="button"
                                className="login-role-chip"
                                disabled={isLoading}
                                onClick={() => {
                                    setUsername(acc.user);
                                    setPassword(acc.pass);
                                    setError('');
                                    setTimeout(async () => {
                                        setIsLoading(true);
                                        const result = await login(acc.user, acc.pass);
                                        if (!result.success) { setError(result.error); setIsLoading(false); }
                                    }, 100);
                                }}
                                style={{
                                    background: acc.bg,
                                    borderColor: acc.border,
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${acc.border}`; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                            >
                                <span className="login-role-icon">{acc.icon}</span>
                                <span style={{ color: acc.color, fontWeight: 600 }}>{acc.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
