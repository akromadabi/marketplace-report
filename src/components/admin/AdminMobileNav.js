import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_CONFIG } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    Users,
    Shield,
    Settings,
    Menu,
    X,
    LogOut,
} from 'lucide-react';

const adminMenuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Manajemen User', icon: Users },
    { path: '/admin/roles', label: 'Manajemen Kelas', icon: Shield },
    { path: '/admin/settings', label: 'Pengaturan', icon: Settings },
];

function AdminMobileNav({ currentPath }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const roleCfg = ROLE_CONFIG.admin;

    return (
        <>
            {/* Top bar */}
            <nav style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '3.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                zIndex: 70,
                display: window.innerWidth >= 768 ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                        width: '1.75rem',
                        height: '1.75rem',
                        background: roleCfg.gradient,
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        color: 'white',
                    }}>
                        A
                    </div>
                    <span className="gradient-text" style={{
                        fontWeight: 800,
                        fontSize: '0.9375rem',
                        letterSpacing: '-0.02em',
                    }}>
                        Admin Panel
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {user && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.5rem 0.25rem 0.25rem',
                            background: roleCfg.bgColor,
                            border: `1px solid ${roleCfg.borderColor}`,
                            borderRadius: 'var(--radius-full)',
                        }}>
                            <div style={{
                                width: '1.5rem',
                                height: '1.5rem',
                                borderRadius: 'var(--radius-full)',
                                background: roleCfg.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.625rem',
                                color: '#fff',
                            }}>
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                color: roleCfg.color,
                            }}>
                                Admin
                            </span>
                        </div>
                    )}

                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '2.25rem',
                            height: '2.25rem',
                            background: 'var(--bg-glass)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                        }}
                        type="button"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </nav>

            {/* Mobile menu dropdown */}
            {mobileMenuOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 75,
                        }}
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div style={{
                        position: 'fixed',
                        top: '3.5rem',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-subtle)',
                        zIndex: 76,
                        maxHeight: 'calc(100vh - 3.5rem)',
                        overflowY: 'auto',
                        padding: '0.5rem',
                    }}>
                        {adminMenuItems.map(({ path, label, icon: Icon }) => {
                            const isActive = currentPath === path;
                            return (
                                <button
                                    key={path}
                                    onClick={() => {
                                        navigate(path);
                                        setMobileMenuOpen(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: isActive ? 'rgba(108, 92, 231, 0.08)' : 'transparent',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        color: isActive ? '#6c5ce7' : 'var(--text-secondary)',
                                        fontSize: '0.875rem',
                                        fontWeight: isActive ? 600 : 500,
                                        textAlign: 'left',
                                    }}
                                    type="button"
                                >
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                    <span>{label}</span>
                                </button>
                            );
                        })}

                        {/* Logout button */}
                        <div style={{
                            borderTop: '1px solid var(--border-subtle)',
                            marginTop: '0.5rem',
                            paddingTop: '0.5rem',
                        }}>
                            <button
                                onClick={() => { logout(); setMobileMenuOpen(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    color: '#f87171',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    textAlign: 'left',
                                }}
                                type="button"
                            >
                                <LogOut size={18} />
                                <span>Keluar</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

export default AdminMobileNav;
