import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, CLASS_CONFIG } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import {
    LayoutDashboard,
    Upload,
    BarChart3,
    FileSpreadsheet,
    PenLine,
    RotateCcw,
    PackageCheck,
    Calendar,
    Store,
    GitCompare,
    Grid3x3,
    X,
    ChevronDown,
    User,
    LogOut,
} from 'lucide-react';

// ─── Bottom bar tabs ──────────────────────────────────────────────
const bottomTabs = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/upload', label: 'Upload', icon: Upload },
    { key: 'menu', label: 'Menu', icon: Grid3x3, isMenu: true },
    { path: '/rangkuman', label: 'Rekap', icon: FileSpreadsheet },
    { path: '/analisis', label: 'Analisis', icon: BarChart3 },
];

// ─── Menu items shown in the dropup ──────────────────────────────
const dropupMenuItems = [
    { path: '/input-modal', label: 'Input HPP', icon: PenLine },
    { path: '/olahan', label: 'Analisis Pesanan', icon: Calendar },
    { path: '/return', label: 'Retur', icon: RotateCcw },
    { path: '/pengembalian', label: 'Pengembalian', icon: PackageCheck },
    { path: '/stores', label: 'Kelola Toko', icon: Store },
    { path: '/compare', label: 'Perbandingan', icon: GitCompare },
];

function MobileNav({ currentPath }) {
    const { user, hasPermission, logout } = useAuth();
    const { stores, activeStore, setActiveStore } = useStore();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const storeRef = useRef(null);
    const profileRef = useRef(null);

    const classCfg = user ? (CLASS_CONFIG[user.class] || CLASS_CONFIG.silver) : CLASS_CONFIG.silver;

    // Filter dropup items by permission
    const filteredDropup = dropupMenuItems.filter(item => hasPermission(item.path));

    // Close store dropdown when clicking outside
    useEffect(() => {
        function handleClick(e) {
            if (storeRef.current && !storeRef.current.contains(e.target)) {
                setStoreDropdownOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Close menu when navigating
    const handleNav = (path) => {
        navigate(path);
        setMenuOpen(false);
    };

    // Check if current path matches any dropup item (show menu as active)
    const isDropupActive = dropupMenuItems.some(item => currentPath === item.path);

    // Only show on mobile
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return null;

    return (
        <>
            {/* ═══════════ TOP HEADER BAR ═══════════ */}
            <header style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '3.25rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                zIndex: 70,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 0.875rem',
            }}>
                {/* Left: Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '1.625rem',
                        height: '1.625rem',
                        background: 'var(--gradient-primary)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.6875rem',
                        color: 'white',
                    }}>M</div>
                    <span className="gradient-text" style={{
                        fontWeight: 800,
                        fontSize: '0.875rem',
                        letterSpacing: '-0.02em',
                    }}>MarketReport</span>
                </div>

                {/* Center: Store Selector */}
                {stores.length > 0 && (
                    <div ref={storeRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.3rem 0.625rem',
                                background: 'rgba(6, 182, 212, 0.06)',
                                border: '1px solid rgba(6, 182, 212, 0.15)',
                                borderRadius: 'var(--radius-full)',
                                cursor: 'pointer',
                                color: 'var(--accent-primary)',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                maxWidth: '130px',
                            }}
                            type="button"
                        >
                            <Store size={12} />
                            <span style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {activeStore ? activeStore.name : 'Pilih Toko'}
                            </span>
                            <ChevronDown size={10} style={{
                                transform: storeDropdownOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                                flexShrink: 0,
                            }} />
                        </button>

                        {/* Store dropdown */}
                        {storeDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                marginTop: '0.375rem',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-lg)',
                                minWidth: '160px',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                zIndex: 100,
                            }}>
                                {stores.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => { setActiveStore(s); setStoreDropdownOpen(false); }}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '0.5rem 0.75rem',
                                            background: activeStore && activeStore.id === s.id ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            color: activeStore && activeStore.id === s.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            fontWeight: activeStore && activeStore.id === s.id ? 700 : 500,
                                        }}
                                        type="button"
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Right: Profile */}
                {user && (
                    <div ref={profileRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                            type="button"
                        >
                            <div style={{
                                width: '1.75rem',
                                height: '1.75rem',
                                borderRadius: 'var(--radius-full)',
                                background: classCfg.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.625rem',
                                color: '#fff',
                                boxShadow: `0 0 8px ${classCfg.borderColor}`,
                            }}>
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        </button>

                        {/* Profile dropdown */}
                        {profileOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '0.5rem',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-lg)',
                                minWidth: '140px',
                                zIndex: 100,
                                overflow: 'hidden',
                            }}>
                                <button
                                    onClick={() => { setProfileOpen(false); handleNav('/profile'); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        width: '100%', padding: '0.625rem 0.875rem',
                                        background: 'transparent', border: 'none',
                                        cursor: 'pointer', color: 'var(--text-primary)',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        textAlign: 'left',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    type="button"
                                >
                                    <User size={14} color="var(--accent-primary)" />
                                    Profil
                                </button>
                                <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                                <button
                                    onClick={() => { setProfileOpen(false); logout(); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        width: '100%', padding: '0.625rem 0.875rem',
                                        background: 'transparent', border: 'none',
                                        cursor: 'pointer', color: '#f87171',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        textAlign: 'left',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    type="button"
                                >
                                    <LogOut size={14} />
                                    Keluar Akun
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* ═══════════ DROPUP OVERLAY ═══════════ */}
            {menuOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 95,
                        animation: 'mobileOverlayIn 0.2s ease-out',
                    }}
                    onClick={() => setMenuOpen(false)}
                />
            )}

            {/* ═══════════ DROPUP MENU ═══════════ */}
            <div style={{
                position: 'fixed',
                bottom: menuOpen ? '4.5rem' : '-100%',
                left: '0.75rem',
                right: '0.75rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
                zIndex: 96,
                padding: '0.75rem',
                transition: 'bottom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: menuOpen ? 1 : 0,
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.375rem',
                }}>
                    {filteredDropup.map(({ path, label, icon: Icon }) => {
                        const isActive = currentPath === path;
                        return (
                            <button
                                key={path}
                                onClick={() => handleNav(path)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.375rem',
                                    padding: '0.75rem 0.5rem',
                                    background: isActive ? 'rgba(108, 92, 231, 0.08)' : 'var(--bg-glass)',
                                    border: isActive ? '1px solid rgba(108, 92, 231, 0.2)' : '1px solid transparent',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    color: isActive ? '#6c5ce7' : 'var(--text-secondary)',
                                    fontSize: '0.6875rem',
                                    fontWeight: isActive ? 600 : 500,
                                    transition: 'all 0.15s',
                                }}
                                type="button"
                            >
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════ BOTTOM TAB BAR ═══════════ */}
            <nav style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '4rem',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-subtle)',
                zIndex: 97,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}>
                {bottomTabs.map((tab) => {
                    if (tab.isMenu) {
                        // Center "Menu" button — raised & prominent
                        return (
                            <button
                                key="menu"
                                onClick={() => setMenuOpen(!menuOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '3.25rem',
                                    height: '3.25rem',
                                    background: menuOpen
                                        ? 'var(--text-primary)'
                                        : isDropupActive
                                            ? 'var(--gradient-primary)'
                                            : 'var(--gradient-primary)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-full)',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    boxShadow: '0 4px 16px rgba(108, 92, 231, 0.35)',
                                    transform: 'translateY(-0.5rem)',
                                    transition: 'all 0.2s',
                                }}
                                type="button"
                            >
                                {menuOpen ? <X size={22} /> : <Grid3x3 size={22} />}
                            </button>
                        );
                    }

                    const isActive = currentPath === tab.path;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.path}
                            onClick={() => handleNav(tab.path)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.25rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: isActive ? '#6c5ce7' : 'var(--text-tertiary)',
                                fontSize: '0.625rem',
                                fontWeight: isActive ? 700 : 500,
                                padding: '0.25rem 0.75rem',
                                transition: 'color 0.15s',
                                position: 'relative',
                            }}
                            type="button"
                        >
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                            <span>{tab.label}</span>
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-0.25rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '1.25rem',
                                    height: '2.5px',
                                    borderRadius: '2px',
                                    background: 'var(--gradient-primary)',
                                }} />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ═══════════ ANIMATIONS ═══════════ */}
            <style>{`
                @keyframes mobileOverlayIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
}

export default MobileNav;