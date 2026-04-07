import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, CLASS_CONFIG } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { apiGetUsage } from '../api';
import {
    LayoutDashboard,
    Upload,
    PenLine,
    BarChart3,
    FileSpreadsheet,
    RotateCcw,
    PackageCheck,
    Calendar,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Store,
    Package,
    Receipt,
    ChevronDown,
    Tag,
} from 'lucide-react';

const menuGroups = [
    {
        label: null,
        items: [
            { path: '/', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/upload', label: 'Upload File', icon: Upload },
        ],
    },
    {
        label: 'Data',
        items: [
            { path: '/return', label: 'Retur', icon: RotateCcw },
            { path: '/pengembalian', label: 'Pengembalian', icon: PackageCheck },
        ],
    },
    {
        label: 'Analisis',
        items: [
            { path: '/input-modal', label: 'Input HPP', icon: PenLine },
            { path: '/kampanye', label: 'Kampanye', icon: Tag },
            { path: '/analisis', label: 'Produk Analisis', icon: BarChart3 },
            { path: '/rangkuman', label: 'Rekap Transaksi', icon: FileSpreadsheet },
            { path: '/olahan', label: 'Analisis Pesanan', icon: Calendar },
        ],
    },
    {
        label: 'Keuangan',
        items: [
            { path: '/aset', label: 'Aset', icon: Package },
            { path: '/operasional', label: 'Operasional', icon: Receipt },
        ],
    },
    {
        label: 'Toko',
        items: [
            { path: '/stores', label: 'Kelola Toko', icon: Store },
        ],
    },
];

function Sidebar({ currentPath, isOpen, onToggle }) {
    const { user, logout, hasPermission } = useAuth();
    const { stores, activeStore, setActiveStore } = useStore();
    const navigate = useNavigate();
    const sidebarRef = useRef(null);
    const [tooltip, setTooltip] = useState({ visible: false, text: "", top: 0, left: 0 });
    const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
    const [usage, setUsage] = useState(null);

    const classCfg = user ? (CLASS_CONFIG[user.class] || CLASS_CONFIG.silver) : CLASS_CONFIG.silver;

    // Fetch usage stats
    const fetchUsage = useCallback(async () => {
        if (!user || user.role === 'admin') return;
        try {
            const data = await apiGetUsage(user.id);
            setUsage(data);
        } catch { /* ignore */ }
    }, [user]);

    useEffect(() => { fetchUsage(); }, [fetchUsage]);

    function showTooltip(e, text) {
        if (isOpen) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            visible: true,
            text,
            top: rect.top + rect.height / 2 - 14,
            left: rect.right + 12,
        });
    }

    function hideTooltip() {
        setTooltip({ visible: false, text: "", top: 0, left: 0 });
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                if (isOpen && window.innerWidth < 768) {
                    onToggle(false);
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onToggle]);

    // Filter menu groups based on permissions
    const filteredMenuGroups = menuGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => hasPermission(item.path)),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && window.innerWidth < 768 && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 80,
                    }}
                    onClick={() => onToggle(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    height: '100vh',
                    width: isOpen ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)',
                    background: 'var(--bg-secondary)',
                    borderRight: '1px solid var(--border-subtle)',
                    zIndex: 90,
                    display: window.innerWidth < 768 ? (isOpen ? 'flex' : 'none') : 'flex',
                    flexDirection: 'column',
                    transition: 'width var(--transition-normal)',
                    overflow: 'hidden',
                }}
            >
                {/* Logo */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isOpen ? 'flex-start' : 'center',
                        padding: isOpen ? '1.25rem 1.25rem' : '1.25rem 0',
                        height: '4rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        flexShrink: 0,
                    }}
                >
                    {isOpen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div style={{
                                width: '2rem',
                                height: '2rem',
                                background: 'var(--gradient-primary)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.875rem',
                                color: 'white',
                                flexShrink: 0,
                            }}>
                                M
                            </div>
                            <span style={{
                                fontWeight: 800,
                                fontSize: '1rem',
                                letterSpacing: '-0.02em',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                            }}
                                className="gradient-text"
                            >
                                MarketReport
                            </span>
                        </div>
                    ) : (
                        <div style={{
                            width: '2rem',
                            height: '2rem',
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            color: 'white',
                        }}>
                            M
                        </div>
                    )}
                </div>

                {/* Menu */}
                <nav style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '0.75rem 0.5rem',
                }}>
                    {filteredMenuGroups.map((group, gi) => (
                        <div key={gi} style={{ marginBottom: '0.5rem' }}>
                            {group.label && isOpen && (
                                <div style={{
                                    padding: '0.5rem 0.75rem 0.25rem',
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    color: 'var(--text-tertiary)',
                                }}>
                                    {group.label}
                                </div>
                            )}
                            {!isOpen && gi > 0 && (
                                <div style={{
                                    height: '1px',
                                    background: 'var(--border-subtle)',
                                    margin: '0.5rem 0.75rem',
                                }} />
                            )}
                            {group.items.map(({ path, label, icon: Icon }) => {
                                const isActive = currentPath === path;
                                const isDisabled = false;
                                return (
                                    <a
                                        key={path}
                                        href={path}
                                        onClick={(e) => { e.preventDefault(); navigate(path); if (window.innerWidth < 768) onToggle(false); }}
                                        onMouseEnter={(e) => showTooltip(e, label)}
                                        onMouseLeave={hideTooltip}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            width: '100%',
                                            padding: isOpen ? '0.625rem 0.75rem' : '0.625rem',
                                            justifyContent: isOpen ? 'flex-start' : 'center',
                                            background: isActive
                                                ? 'rgba(108, 92, 231, 0.08)'
                                                : 'transparent',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            color: isActive
                                                    ? '#6c5ce7'
                                                    : 'var(--text-secondary)',
                                            transition: 'all var(--transition-fast)',
                                            marginBottom: '0.125rem',
                                            position: 'relative',
                                            textDecoration: 'none',
                                            fontSize: '0.8125rem',
                                            fontWeight: isActive ? 600 : 500,
                                        }}
                                        onMouseOver={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'var(--bg-glass-hover)';
                                                e.currentTarget.style.color = 'var(--text-primary)';
                                            }
                                        }}
                                        onMouseOut={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }
                                        }}
                                    >
                                        {isActive && (
                                            <div style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: '3px',
                                                height: '1.25rem',
                                                borderRadius: '0 4px 4px 0',
                                                background: 'var(--gradient-primary)',
                                            }} />
                                        )}
                                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                        {isOpen && (
                                            <span style={{
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                                {label}
                                            </span>
                                        )}
                                    </a>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Active Store Selector */}
                {isOpen && stores.length > 0 && (
                    <div style={{ padding: '0 0.75rem 0.5rem', flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    width: '100%', padding: '0.5rem 0.75rem',
                                    background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.15)',
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600,
                                    transition: 'all var(--transition-fast)',
                                }}
                                type="button"
                            >
                                <Store size={14} />
                                <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {activeStore ? activeStore.name : 'Pilih Toko'}
                                </span>
                                <ChevronDown size={12} style={{ transform: storeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                            {storeDropdownOpen && (
                                <div style={{
                                    position: 'absolute', bottom: '100%', left: 0, right: 0,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                                    marginBottom: '0.25rem', maxHeight: '200px', overflowY: 'auto', zIndex: 100,
                                }}>
                                    {stores.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setActiveStore(s); setStoreDropdownOpen(false); }}
                                            style={{
                                                display: 'block', width: '100%', padding: '0.5rem 0.75rem',
                                                background: activeStore && activeStore.id === s.id ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                                color: activeStore && activeStore.id === s.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                fontSize: '0.75rem', fontWeight: activeStore && activeStore.id === s.id ? 700 : 500,
                                                transition: 'all var(--transition-fast)',
                                            }}
                                            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-glass-hover)'; }}
                                            onMouseOut={e => { e.currentTarget.style.background = activeStore && activeStore.id === s.id ? 'rgba(6, 182, 212, 0.1)' : 'transparent'; }}
                                            type="button"
                                        >
                                            {s.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* User Profile + Logout + Toggle */}
                <div style={{
                    borderTop: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                }}>
                    {/* User Profile — click to go to /profile */}
                    {user && (
                        <div
                            onClick={() => { navigate('/profile'); if (window.innerWidth < 768) onToggle(false); }}
                            style={{
                                padding: isOpen ? '0.75rem 1rem' : '0.75rem 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                justifyContent: isOpen ? 'flex-start' : 'center',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-md)',
                                transition: 'background var(--transition-fast)',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-glass-hover)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            onMouseEnter={(e) => showTooltip(e, 'Profil Saya')}
                            onMouseLeave={hideTooltip}
                        >
                            <div
                                style={{
                                    width: '2.25rem',
                                    height: '2.25rem',
                                    borderRadius: 'var(--radius-full)',
                                    background: classCfg.gradient,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    color: '#fff',
                                    flexShrink: 0,
                                    boxShadow: `0 0 12px ${classCfg.borderColor}`,
                                }}
                                onMouseEnter={(e) => showTooltip(e, `${user.name} (${classCfg.label})`)}
                                onMouseLeave={hideTooltip}
                            >
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            {isOpen && (
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {user.name}
                                    </div>
                                    <span
                                        className="badge"
                                        style={{
                                            background: classCfg.bgColor,
                                            color: classCfg.color,
                                            border: `1px solid ${classCfg.borderColor}`,
                                            fontSize: '0.625rem',
                                            padding: '0.125rem 0.5rem',
                                            marginTop: '0.125rem',
                                        }}
                                    >
                                        {classCfg.icon} {classCfg.label}
                                    </span>
                                    {usage && user.limits && (
                                        <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                                            🏪 {usage.stores}/{user.limits.max_stores === -1 ? '∞' : user.limits.max_stores}
                                            {' · '}
                                            📦 {(usage.orders || 0).toLocaleString()}/{user.limits.max_orders === -1 ? '∞' : user.limits.max_orders.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Logout Button */}
                    <div style={{ padding: '0 0.5rem 0.25rem' }}>
                        <button
                            onClick={logout}
                            onMouseEnter={(e) => showTooltip(e, 'Keluar')}
                            onMouseLeave={hideTooltip}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                width: '100%',
                                padding: isOpen ? '0.625rem 0.75rem' : '0.625rem',
                                justifyContent: isOpen ? 'flex-start' : 'center',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                color: '#f87171',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                transition: 'all var(--transition-fast)',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                            type="button"
                        >
                            <LogOut size={18} />
                            {isOpen && <span>Keluar</span>}
                        </button>
                    </div>

                    {/* Toggle button */}
                    <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => onToggle(!isOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isOpen ? 'flex-start' : 'center',
                                gap: '0.75rem',
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                transition: 'all var(--transition-fast)',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--bg-glass-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                            type="button"
                        >
                            {isOpen ? (
                                <>
                                    <ChevronLeft size={18} />
                                    <span>Tutup Menu</span>
                                </>
                            ) : (
                                <ChevronRight size={18} />
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Tooltip */}
            <div
                className={`tooltip ${tooltip.visible ? 'show' : ''}`}
                style={{ top: tooltip.top + 'px', left: tooltip.left + 'px' }}
            >
                {tooltip.text}
            </div>
        </>
    );
}

export default Sidebar;