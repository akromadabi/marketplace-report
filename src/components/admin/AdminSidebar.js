import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_CONFIG } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    Users,
    Shield,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

const adminMenuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Manajemen User', icon: Users },
    { path: '/admin/roles', label: 'Manajemen Kelas', icon: Shield },
    { path: '/admin/settings', label: 'Pengaturan', icon: Settings },
];

function AdminSidebar({ currentPath, isOpen, onToggle }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const sidebarRef = useRef(null);
    const [tooltip, setTooltip] = useState({ visible: false, text: '', top: 0, left: 0 });

    const roleCfg = ROLE_CONFIG.admin;

    function showTooltip(e, text) {
        if (isOpen) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ visible: true, text, top: rect.top + rect.height / 2 - 14, left: rect.right + 12 });
    }
    function hideTooltip() {
        setTooltip({ visible: false, text: '', top: 0, left: 0 });
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                if (isOpen && window.innerWidth < 768) onToggle(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onToggle]);

    return (
        <>
            {isOpen && window.innerWidth < 768 && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 80 }}
                    onClick={() => onToggle(false)}
                />
            )}
            <aside
                ref={sidebarRef}
                style={{
                    position: 'fixed', top: 0, left: 0, height: '100vh',
                    width: isOpen ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)',
                    background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)',
                    zIndex: 90,
                    display: window.innerWidth < 768 ? (isOpen ? 'flex' : 'none') : 'flex',
                    flexDirection: 'column', transition: 'width var(--transition-normal)', overflow: 'hidden',
                }}
            >
                {/* Logo */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center',
                    padding: isOpen ? '1.25rem' : '1.25rem 0', height: '4rem',
                    borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
                }}>
                    {isOpen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div style={{
                                width: '2rem', height: '2rem', background: roleCfg.gradient,
                                borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', color: 'white', flexShrink: 0,
                            }}>A</div>
                            <span style={{
                                fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em',
                                whiteSpace: 'nowrap', overflow: 'hidden',
                            }} className="gradient-text">Admin Panel</span>
                        </div>
                    ) : (
                        <div style={{
                            width: '2rem', height: '2rem', background: roleCfg.gradient,
                            borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', color: 'white',
                        }}>A</div>
                    )}
                </div>

                {/* Menu */}
                <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem 0.5rem' }}>
                    {adminMenuItems.map(({ path, label, icon: Icon }) => {
                        const isActive = currentPath === path;
                        return (
                            <button
                                key={path}
                                onClick={() => { navigate(path); if (window.innerWidth < 768) onToggle(false); }}
                                onMouseEnter={(e) => showTooltip(e, label)}
                                onMouseLeave={hideTooltip}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                                    padding: isOpen ? '0.625rem 0.75rem' : '0.625rem',
                                    justifyContent: isOpen ? 'flex-start' : 'center',
                                    background: isActive ? 'rgba(108, 92, 231, 0.08)' : 'transparent',
                                    border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    color: isActive ? '#6c5ce7' : 'var(--text-secondary)',
                                    transition: 'all var(--transition-fast)', marginBottom: '0.125rem',
                                    position: 'relative', textDecoration: 'none', fontSize: '0.8125rem',
                                    fontWeight: isActive ? 600 : 500,
                                }}
                                onMouseOver={(e) => {
                                    if (!isActive) { e.currentTarget.style.background = 'var(--bg-glass-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }
                                }}
                                onMouseOut={(e) => {
                                    if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }
                                }}
                                type="button"
                            >
                                {isActive && (
                                    <div style={{
                                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                                        width: '3px', height: '1.25rem', borderRadius: '0 4px 4px 0',
                                        background: 'var(--gradient-primary)',
                                    }} />
                                )}
                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                {isOpen && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* User Profile + Logout + Toggle */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    {user && (
                        <div style={{
                            padding: isOpen ? '0.75rem 1rem' : '0.75rem 0',
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            justifyContent: isOpen ? 'flex-start' : 'center',
                        }}>
                            <div
                                style={{
                                    width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-full)',
                                    background: roleCfg.gradient, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: '#fff',
                                    flexShrink: 0, boxShadow: `0 0 12px ${roleCfg.borderColor}`,
                                }}
                                onMouseEnter={(e) => showTooltip(e, `${user.name} (Admin)`)}
                                onMouseLeave={hideTooltip}
                            >
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            {isOpen && (
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>{user.name}</div>
                                    <span className="badge" style={{
                                        background: roleCfg.bgColor, color: roleCfg.color,
                                        border: `1px solid ${roleCfg.borderColor}`, fontSize: '0.625rem',
                                        padding: '0.125rem 0.5rem', marginTop: '0.125rem',
                                    }}>{roleCfg.icon} {roleCfg.label}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ padding: '0 0.5rem 0.25rem' }}>
                        <button
                            onClick={logout}
                            onMouseEnter={(e) => showTooltip(e, 'Keluar')}
                            onMouseLeave={hideTooltip}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                                padding: isOpen ? '0.625rem 0.75rem' : '0.625rem',
                                justifyContent: isOpen ? 'flex-start' : 'center',
                                background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)',
                                cursor: 'pointer', color: '#f87171', fontSize: '0.8125rem', fontWeight: 500,
                                transition: 'all var(--transition-fast)',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            type="button"
                        >
                            <LogOut size={18} />
                            {isOpen && <span>Keluar</span>}
                        </button>
                    </div>

                    <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => onToggle(!isOpen)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center',
                                gap: '0.75rem', width: '100%', padding: '0.625rem 0.75rem',
                                background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)',
                                cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8125rem',
                                fontWeight: 500, transition: 'all var(--transition-fast)',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-glass-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            type="button"
                        >
                            {isOpen ? (<><ChevronLeft size={18} /><span>Tutup Menu</span></>) : (<ChevronRight size={18} />)}
                        </button>
                    </div>
                </div>
            </aside>

            <div className={`tooltip ${tooltip.visible ? 'show' : ''}`} style={{ top: tooltip.top + 'px', left: tooltip.left + 'px' }}>
                {tooltip.text}
            </div>
        </>
    );
}

export default AdminSidebar;
