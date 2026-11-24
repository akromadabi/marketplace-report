import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProcessedOrders, formatDateKey } from '../hooks/useProcessedOrders';
import { useDataCache } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import DashboardModernCards from './DashboardModernCards';
import {
    Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
    AreaChart, Area,
} from 'recharts';
import {
    ShoppingBag, CheckCircle, Wallet,
    TrendingUp, RotateCcw,
    ArrowUpRight, Package, Calendar, ChevronLeft, ChevronRight,
    HourglassIcon, Handshake, Truck, Landmark, Info, Search, CreditCard, Clock, Store,
    Filter, Check, X,
} from 'lucide-react';

function formatRupiah(number) {
    if (typeof number !== 'number' || isNaN(number)) return 'Rp0';
    const rounded = Math.round(number);
    if (rounded < 0) return 'Rp-' + (-rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatCompact(number) {
    if (typeof number !== 'number' || isNaN(number)) return '0';
    if (number >= 1000000000) return (number / 1000000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (number >= 1000000) return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'Jt';
    if (number >= 1000) return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return number.toLocaleString('id-ID');
}

const CHART_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

function groupPaymentMethod(raw) {
    const m = (raw || '').toString().trim().toLowerCase();
    if (!m) return 'Tidak Diketahui';
    if (m === 'bayar di tempat' || m === 'cash') return 'COD (Bayar di Tempat)';
    if (m === 'transfer bank') return 'Transfer Bank';
    if (m.includes('tiktok shop balance')) return 'TikTok Balance';
    if (m === 'qris') return 'QRIS';
    if (m.includes('kartu kredit') || m.includes('kartu debit')) return 'Kartu Kredit/Debit';
    if (m.includes('paylater') || m.includes('bri ceria') || m.includes('gopay later')) return 'PayLater';
    if (['dana', 'gopay', 'ovo', 'linkaja', 'saldo', 'jakone pay', 'jenius pay', 'klikbca'].some(w => m.includes(w))) return 'E-Wallet';
    return raw.toString().trim();
}

function formatPeriodLabel(dateKey, isMonthly) {
    if (!dateKey) return '';
    const p = dateKey.split('-');
    const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    if (isMonthly) {
        return `${ms[parseInt(p[1], 10) - 1] || p[1]} ${p[0]}`;
    }
    return `${parseInt(p[2], 10)} ${ms[parseInt(p[1], 10) - 1] || p[1]} ${p[0]}`;
}

function formatShortAxis(dateKey, isMonthly) {
    if (!dateKey) return '';
    const p = dateKey.split('-');
    const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    if (isMonthly) {
        return `${ms[parseInt(p[1], 10) - 1] || p[1]} '${(p[0] || '').slice(2)}`;
    }
    return `${p[2]}/${p[1]}`;
}

const CARD_SURFACE = {
    background: '#ffffff',
    borderRadius: '20px',
    border: '1px solid #eef0f6',
    boxShadow: '0 4px 20px -2px rgba(108, 92, 231, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
};

/* ════════════════════════════════════════════════════════════════════════
   MEMOIZED SUB-COMPONENT 1: BOTTOM ACTIVITY & TOP PRODUCTS TABLE
   (Isolated state so searching or switching tabs is 100% instant)
   ════════════════════════════════════════════════════════════════════════ */
const BottomActivitySection = React.memo(function BottomActivitySection({
    topProducts,
    recentTransactions,
    paymentMethodDist,
    affiliateDist,
    affiliasiNominal,
    isMobile,
}) {
    const [bottomTableTab, setBottomTableTab] = useState('products');
    const [tableSearch, setTableSearch] = useState('');

    const maxProdQty = topProducts[0]?.qty || 1;

    const filteredProducts = useMemo(() => {
        if (!tableSearch.trim()) return topProducts;
        const q = tableSearch.toLowerCase();
        return topProducts.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(q));
    }, [topProducts, tableSearch]);

    const filteredRecent = useMemo(() => {
        if (!tableSearch.trim()) return recentTransactions;
        const q = tableSearch.toLowerCase();
        return recentTransactions.filter(tx => `${tx.orderId} ${tx.productName} ${tx.province}`.toLowerCase().includes(q));
    }, [recentTransactions, tableSearch]);

    return (
        <div style={{ ...CARD_SURFACE, padding: isMobile ? '0.75rem 0.85rem' : '1.5rem' }}>
            {/* Header with Tabs & Search */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: isMobile ? '0.6rem' : '0.875rem',
                    marginBottom: isMobile ? '0.875rem' : '1.25rem',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '0.35rem' : '0.5rem',
                        overflowX: isMobile ? 'auto' : 'visible',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        whiteSpace: 'nowrap',
                        width: isMobile ? '100%' : 'auto',
                        paddingBottom: isMobile ? '2px' : 0,
                    }}
                >
                    {[
                        { id: 'products', label: isMobile ? 'Top Produk' : 'Produk Terlaris', badge: `Top ${topProducts.length}`, icon: Package },
                        { id: 'recent', label: isMobile ? 'Terbaru' : 'Transaksi Terbaru', badge: 'Live', icon: Clock },
                        { id: 'payment', label: isMobile ? 'Pembayaran' : 'Metode Pembayaran & Afiliasi', badge: `${paymentMethodDist.length} Metode`, icon: CreditCard },
                    ].map((tab) => {
                        const active = bottomTableTab === tab.id;
                        const TabIcon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setBottomTableTab(tab.id)}
                                style={{
                                    padding: isMobile ? '0.38rem 0.75rem' : '0.5rem 1.05rem',
                                    borderRadius: '9999px',
                                    border: active ? '1px solid #7c3aed' : '1px solid #e5e7f0',
                                    background: active ? '#7c3aed' : '#f8f9fc',
                                    color: active ? '#ffffff' : 'var(--text-secondary)',
                                    fontSize: isMobile ? '0.725rem' : '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    flexShrink: 0,
                                    boxShadow: active ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none',
                                    transition: 'background 0.15s ease, color 0.15s ease',
                                }}
                            >
                                <TabIcon size={isMobile ? 12 : 14} strokeWidth={2.2} />
                                <span>{tab.label}</span>
                                <span
                                    style={{
                                        fontSize: isMobile ? '0.625rem' : '0.675rem',
                                        padding: '1px 7px',
                                        borderRadius: '9999px',
                                        background: active ? 'rgba(255,255,255,0.22)' : '#e8eaf2',
                                        color: active ? '#ffffff' : 'var(--text-secondary)',
                                    }}
                                >
                                    {tab.badge}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {bottomTableTab !== 'payment' && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.45rem 0.95rem',
                            borderRadius: '9999px',
                            background: '#f8f9fc',
                            border: '1px solid #e5e7f0',
                            minWidth: isMobile ? '100%' : '260px',
                        }}
                    >
                        <Search size={14} color="var(--text-tertiary)" />
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder={bottomTableTab === 'products' ? 'Cari nama produk atau SKU...' : 'Cari Order ID, produk, provinsi...'}
                            style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: '0.78rem',
                                color: 'var(--text-primary)',
                                width: '100%',
                            }}
                        />
                    </div>
                )}
            </div>

            {/* TAB 1: TOP PRODUCTS TABLE (Full width product name, no big empty gap) */}
            {bottomTableTab === 'products' && (
                isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {filteredProducts.map((p, i) => {
                            const badgeColor = CHART_COLORS[i % CHART_COLORS.length];
                            return (
                                <div
                                    key={`${p.sku}-${i}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.65rem 0.65rem',
                                        background: '#f9fafd',
                                        borderRadius: '12px',
                                        border: '1px solid #eef0f6',
                                        gap: '0.5rem',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '8px',
                                                background: `${badgeColor}15`,
                                                color: badgeColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 800,
                                                fontSize: '0.75rem',
                                                flexShrink: 0,
                                            }}
                                        >
                                            #{i + 1}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                                title={p.name}
                                            >
                                                {p.name}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                <span style={{ background: '#eef0f6', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>{p.sku}</span>
                                                <span>·</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.qty.toLocaleString('id-ID')} PCS</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#10b981', lineHeight: 1.2 }}>
                                            +{formatCompact(Math.round(p.revenue))}
                                        </div>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                marginTop: '2px',
                                                fontSize: '0.6rem',
                                                fontWeight: 700,
                                                padding: '1px 6px',
                                                borderRadius: '9999px',
                                                background: i < 3 ? 'rgba(124, 58, 237, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                                color: i < 3 ? '#7c3aed' : '#10b981',
                                            }}
                                        >
                                            {i < 3 ? 'Top Seller' : 'Aktif'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8125rem', tableLayout: 'fixed' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fc' }}>
                                    <th style={{ width: '48%', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid #eef0f6', borderBottom: '1px solid #eef0f6', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                                        Aktivitas / Nama Produk
                                    </th>
                                    <th style={{ width: '13%', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid #eef0f6', borderBottom: '1px solid #eef0f6' }}>
                                        SKU
                                    </th>
                                    <th style={{ width: '15%', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid #eef0f6', borderBottom: '1px solid #eef0f6' }}>
                                        Unit Terjual
                                    </th>
                                    <th style={{ width: '14%', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid #eef0f6', borderBottom: '1px solid #eef0f6' }}>
                                        Estimasi Penerimaan Bersih
                                    </th>
                                    <th style={{ width: '10%', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid #eef0f6', borderBottom: '1px solid #eef0f6', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((p, i) => {
                                    const badgeColor = CHART_COLORS[i % CHART_COLORS.length];
                                    const sharePct = Math.min(100, Math.max(6, Math.round((p.qty / maxProdQty) * 100)));
                                    return (
                                        <tr key={`${p.sku}-${i}`}>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            width: 34,
                                                            height: 34,
                                                            borderRadius: '10px',
                                                            background: `${badgeColor}15`,
                                                            color: badgeColor,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 800,
                                                            fontSize: '0.78rem',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        #{i + 1}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: 'var(--text-primary)',
                                                            fontWeight: 600,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            width: '100%',
                                                        }}
                                                        title={p.name}
                                                    >
                                                        {p.name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '3px 9px',
                                                        borderRadius: '6px',
                                                        background: '#f4f5f9',
                                                        color: 'var(--text-secondary)',
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem',
                                                    }}
                                                >
                                                    {p.sku}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8' }}>
                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                    {p.qty.toLocaleString('id-ID')} PCS
                                                </div>
                                                <div style={{ width: '85%', height: 5, background: '#eef0f6', borderRadius: 9999, overflow: 'hidden' }}>
                                                    <div style={{ width: `${sharePct}%`, height: '100%', background: badgeColor, borderRadius: 9999 }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8', fontWeight: 800, color: '#10b981' }}>
                                                +{formatRupiah(Math.round(p.revenue))}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8', textAlign: 'right' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 10px',
                                                        borderRadius: '9999px',
                                                        background: i < 3 ? 'rgba(124, 58, 237, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                                        color: i < 3 ? '#7c3aed' : '#10b981',
                                                        fontSize: '0.725rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ✓ {i < 3 ? 'Top Seller' : 'Aktif'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* TAB 2: RECENT TRANSACTIONS TABLE */}
            {bottomTableTab === 'recent' && (
                isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {filteredRecent.map((tx) => {
                            const st = tx.status.toLowerCase();
                            const isSuccess = st === 'completed' || st === 'shipped';
                            const isCancel = st === 'canceled';
                            const pillColor = isSuccess ? '#10b981' : isCancel ? '#ef4444' : '#f59e0b';
                            const pillBg = isSuccess ? 'rgba(16,185,129,0.12)' : isCancel ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.14)';
                            return (
                                <div
                                    key={tx.orderId}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.65rem 0.65rem',
                                        background: '#f9fafd',
                                        borderRadius: '12px',
                                        border: '1px solid #eef0f6',
                                        gap: '0.5rem',
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>#{tx.orderId}</span>
                                            <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)' }}>· {tx.dateStr}</span>
                                        </div>
                                        <div style={{ fontSize: '0.735rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {tx.productName} ({tx.qty} PCS)
                                        </div>
                                        <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                            {tx.province}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '0.825rem', fontWeight: 800, color: isCancel ? 'var(--text-tertiary)' : '#10b981' }}>
                                            {tx.amount > 0 ? `+${formatCompact(tx.amount)}` : '-'}
                                        </div>
                                        <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 6px', borderRadius: '9999px', background: pillBg, color: pillColor, fontSize: '0.625rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                            ● {tx.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8125rem' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fc' }}>
                                    {['Pesanan & Produk', 'Waktu Transaksi', 'Wilayah', 'Total Nilai', 'Status'].map((h, idx) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: idx === 4 ? 'right' : 'left',
                                                fontWeight: 700,
                                                color: 'var(--text-tertiary)',
                                                fontSize: '0.725rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                                borderTop: '1px solid #eef0f6',
                                                borderBottom: '1px solid #eef0f6',
                                                borderTopLeftRadius: idx === 0 ? '10px' : 0,
                                                borderBottomLeftRadius: idx === 0 ? '10px' : 0,
                                                borderTopRightRadius: idx === 4 ? '10px' : 0,
                                                borderBottomRightRadius: idx === 4 ? '10px' : 0,
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecent.map((tx) => {
                                    const st = tx.status.toLowerCase();
                                    const isSuccess = st === 'completed' || st === 'shipped';
                                    const isCancel = st === 'canceled';
                                    const pillColor = isSuccess ? '#10b981' : isCancel ? '#ef4444' : '#f59e0b';
                                    const pillBg = isSuccess ? 'rgba(16,185,129,0.12)' : isCancel ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.14)';
                                    return (
                                        <tr key={tx.orderId}>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>#{tx.orderId}</div>
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-secondary)',
                                                        maxWidth: '480px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {tx.productName} ({tx.qty} PCS)
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                {tx.dateStr}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                {tx.province}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8', fontWeight: 800, color: isCancel ? 'var(--text-tertiary)' : '#10b981' }}>
                                                {tx.amount > 0 ? `+${formatRupiah(tx.amount)}` : '-'}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f2f3f8', textAlign: 'right' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 10px',
                                                        borderRadius: '9999px',
                                                        background: pillBg,
                                                        color: pillColor,
                                                        fontSize: '0.725rem',
                                                        fontWeight: 700,
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    ● {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* TAB 3: PAYMENT METHOD & AFFILIATE DISTRIBUTION */}
            {bottomTableTab === 'payment' && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '1.5rem',
                        paddingTop: '0.5rem',
                    }}
                >
                    <div style={{ background: '#f8f9fc', borderRadius: '16px', padding: '1.25rem', border: '1px solid #eef0f6' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                            Distribusi Metode Pembayaran
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {paymentMethodDist.map((pm) => (
                                <div key={pm.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pm.label}</span>
                                        <span style={{ fontWeight: 700, color: pm.color }}>
                                            {pm.value.toLocaleString('id-ID')} Order ({pm.pct}%)
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: 7, background: '#e5e7f0', borderRadius: 9999, overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.max(4, parseFloat(pm.pct))}%`, height: '100%', background: pm.color, borderRadius: 9999 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#f8f9fc', borderRadius: '16px', padding: '1.25rem', border: '1px solid #eef0f6' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                            Kontribusi Afiliasi vs Organik
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {affiliateDist.map((af) => (
                                <div key={af.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{af.label}</span>
                                        <span style={{ fontWeight: 700, color: af.color }}>
                                            {af.value.toLocaleString('id-ID')} Order ({af.pct}%)
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: 10, background: '#e5e7f0', borderRadius: 9999, overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.max(4, parseFloat(af.pct))}%`, height: '100%', background: af.color, borderRadius: 9999 }} />
                                    </div>
                                </div>
                            ))}

                            <div
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '12px',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Total Komisi Afiliasi Dibayarkan
                                </span>
                                <strong style={{ fontSize: '0.95rem', color: '#7c3aed', fontWeight: 800 }}>
                                    {formatRupiah(affiliasiNominal)}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

/* ════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
function Dashboard() {
    const { rangkumanData, rangkumanVersion, loading } = useProcessedOrders();
    const { getComputed, setComputed } = useDataCache();
    const { user } = useAuth();
    const { activeStore } = useStore();
    const navigate = useNavigate();

    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [activeDatePreset, setActiveDatePreset] = useState('all');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef(null);

    // Interactive view states
    const [activeKpiId, setActiveKpiId] = useState('laba');
    const [earningMode, setEarningMode] = useState('labaBersih'); // 'labaBersih' | 'labaKotor' | 'aset'
    const [breakdownMode, setBreakdownMode] = useState('status'); // 'status' | 'keuangan' | 'pencairan'
    const [cashFlowTab, setCashFlowTab] = useState('labaBersih'); // 'labaBersih' | 'labaKotor' | 'fixTerbeli' | 'sudahCair' | 'belumCair' | 'cancelRetur'
    const [granularityOverride, setGranularityOverride] = useState('auto');
    const [selectedBarIndex, setSelectedBarIndex] = useState(null);
    const [rightPanelTab, setRightPanelTab] = useState('operasional');

    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    useEffect(() => {
        function handleResize() {
            setWindowWidth(window.innerWidth);
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [mobileCardMenu, setMobileCardMenu] = useState(null); // null | 'earning' | 'breakdown' | 'cashflow'

    useEffect(() => {
        if (!mobileCardMenu) return;
        function handleOutside(e) {
            if (!e.target.closest('[data-mobile-card-menu]')) {
                setMobileCardMenu(null);
            }
        }
        document.addEventListener('pointerdown', handleOutside);
        return () => document.removeEventListener('pointerdown', handleOutside);
    }, [mobileCardMenu]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false);
        }
        if (showDatePicker) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDatePicker]);

    const processedData = useMemo(() => {
        const dashCacheKey = `dashboard_v6::${rangkumanVersion || rangkumanData.length}::${filterStartDate}::${filterEndDate}`;
        const cached = getComputed(dashCacheKey);
        if (cached && rangkumanData.length > 0) return cached;

        const sums = {
            pesananOrder: 0, pesananPCS: 0, cancelOrder: 0, cancelPCS: 0,
            fixTerbeliOrder: 0, fixTerbeliPCS: 0, terkirimOrder: 0, terkirimPCS: 0,
            akanDikirimOrder: 0, akanDikirimPCS: 0,
            sudahCairOrder: 0, sudahCairPCS: 0, belumCairOrder: 0, belumCairPCS: 0,
            labaKotor: 0, labaBersih: 0, totalModalValid: 0,
            pengembalianOrder: 0, returnOrder: 0,
            affiliasiNominal: 0, affiliasiCount: 0, codJumlah: 0,
            estimasiAsetDiJalan: 0,
        };
        const dailyMap = new Map();
        const monthlyMap = new Map();
        const productMap = new Map();
        const paymentMethodMap = new Map();
        let affiliateYes = 0, affiliateNo = 0;
        const recentList = [];

        rangkumanData.forEach(row => {
            const dateObj = row.waktuPesananDibuatObj;
            if (!dateObj) return;

            const dk = row._dateKey || formatDateKey(dateObj);
            if (filterStartDate && dk < filterStartDate) return;
            if (filterEndDate && dk > filterEndDate) return;

            const statusOrder = (row.statusOrder || '').toLowerCase();
            const totalQuantity = row.totalQuantity || 0;
            const totalSettlement = row.totalSettlementAmount || 0;
            const totalAffiliate = Math.abs(row.totalAffiliateCommission || 0);
            const totalModal = row.totalModal || 0;
            const paymentMethod = (row.metode || '').toLowerCase();

            sums.pesananOrder++;
            sums.pesananPCS += totalQuantity;

            if (statusOrder === 'canceled') { sums.cancelOrder++; sums.cancelPCS += totalQuantity; }
            if (['completed', 'shipped', 'to ship'].includes(statusOrder)) { sums.fixTerbeliOrder++; sums.fixTerbeliPCS += totalQuantity; }
            if (statusOrder === 'shipped') { sums.terkirimOrder++; sums.terkirimPCS += totalQuantity; }
            if (statusOrder === 'to ship') { sums.akanDikirimOrder++; sums.akanDikirimPCS += totalQuantity; }
            if (totalSettlement > 0) { sums.sudahCairOrder++; sums.sudahCairPCS += totalQuantity; }
            if (['completed', 'shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) { sums.belumCairOrder++; sums.belumCairPCS += totalQuantity; }

            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                sums.labaKotor += totalSettlement;
                sums.labaBersih += (totalSettlement - totalModal);
                sums.totalModalValid += totalModal;
            }

            if (statusOrder === 'pengembalian' || statusOrder === 'gagal kirim') sums.pengembalianOrder++;
            if (statusOrder === 'return') sums.returnOrder++;
            sums.affiliasiNominal += totalAffiliate;
            if ((row.totalAffiliateCommission || 0) !== 0) sums.affiliasiCount++;
            if (paymentMethod === 'bayar di tempat') sums.codJumlah++;

            if (['shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) {
                sums.estimasiAsetDiJalan += totalModal;
            }

            const methodGroup = groupPaymentMethod(row.metode);
            paymentMethodMap.set(methodGroup, (paymentMethodMap.get(methodGroup) || 0) + 1);

            const ketAff = (row.ketAffiliasi || 'Tidak').toString().trim();
            if (ketAff === 'YA' || ketAff === 'Affiliasi') affiliateYes++; else affiliateNo++;

            const mk = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!monthlyMap.has(mk)) monthlyMap.set(mk, {
                date: mk, labaKotor: 0, labaBersih: 0, pesanan: 0, pcs: 0,
                fixTerbeli: 0, cancel: 0, returnOrder: 0, pengembalian: 0, cancelRetur: 0,
                sudahCair: 0, sudahCairPCS: 0, belumCair: 0, belumCairPCS: 0,
            });
            const mo = monthlyMap.get(mk);
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                mo.labaKotor += totalSettlement;
                mo.labaBersih += (totalSettlement - totalModal);
            }
            mo.pesanan++;
            mo.pcs += totalQuantity;
            if (['completed', 'shipped', 'to ship'].includes(statusOrder)) mo.fixTerbeli += totalQuantity;
            if (statusOrder === 'canceled') { mo.cancel++; mo.cancelRetur++; }
            if (statusOrder === 'return') { mo.returnOrder++; mo.cancelRetur++; }
            if (statusOrder === 'pengembalian' || statusOrder === 'gagal kirim') { mo.pengembalian++; mo.cancelRetur++; }
            if (totalSettlement > 0) { mo.sudahCair++; mo.sudahCairPCS += totalQuantity; }
            if (['completed', 'shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) { mo.belumCair++; mo.belumCairPCS += totalQuantity; }

            if (!dailyMap.has(dk)) dailyMap.set(dk, {
                date: dk, labaKotor: 0, labaBersih: 0, pesanan: 0, pcs: 0,
                fixTerbeli: 0, cancel: 0, returnOrder: 0, pengembalian: 0, cancelRetur: 0,
                sudahCair: 0, sudahCairPCS: 0, belumCair: 0, belumCairPCS: 0,
            });
            const d = dailyMap.get(dk);
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                d.labaKotor += totalSettlement;
                d.labaBersih += (totalSettlement - totalModal);
            }
            d.pesanan++;
            d.pcs += totalQuantity;
            if (['completed', 'shipped', 'to ship'].includes(statusOrder)) d.fixTerbeli += totalQuantity;
            if (statusOrder === 'canceled') { d.cancel++; d.cancelRetur++; }
            if (statusOrder === 'return') { d.returnOrder++; d.cancelRetur++; }
            if (statusOrder === 'pengembalian' || statusOrder === 'gagal kirim') { d.pengembalian++; d.cancelRetur++; }
            if (totalSettlement > 0) { d.sudahCair++; d.sudahCairPCS += totalQuantity; }
            if (['completed', 'shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) { d.belumCair++; d.belumCairPCS += totalQuantity; }

            if (row.orders) {
                row.orders.forEach(o => {
                    const pName = (o['Product Name'] || '').toString().trim();
                    const sku = (o['Seller SKU'] || '').toString().trim();
                    if (!pName) return;
                    const qRaw = o['Quantity'];
                    const qty = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
                    const key = sku ? `${sku}::${pName}` : pName;
                    if (!productMap.has(key)) productMap.set(key, { name: pName, sku: sku || '-', qty: 0, revenue: 0, orders: 0 });
                    const p = productMap.get(key);
                    p.qty += isNaN(qty) ? 0 : qty;
                    p.orders += 1;
                    if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                        p.revenue += totalSettlement / row.orders.length;
                    }
                });
            }

            if (recentList.length < 30) {
                const firstProd = row.orders && row.orders[0] ? row.orders[0]['Product Name'] : 'Produk Marketplace';
                recentList.push({
                    orderId: row.orderId,
                    productName: firstProd,
                    dateStr: row.waktuPesananDibuat || dk,
                    timestamp: row._timestamp || 0,
                    province: row.province || row.regencyAndCity || 'Indonesia',
                    amount: totalSettlement > 0 ? totalSettlement : (row.totalCustomerPayment || 0),
                    qty: totalQuantity,
                    status: row.statusOrder || 'Proses',
                    metode: groupPaymentMethod(row.metode),
                });
            }
        });

        const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
        const recentTransactions = recentList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);

        const paymentMethodDist = Array.from(paymentMethodMap.entries())
            .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
            .sort((a, b) => b.value - a.value);
        const pmTotal = paymentMethodDist.reduce((s, x) => s + x.value, 0);
        paymentMethodDist.forEach(d => { d.total = pmTotal; d.name = d.label; d.pct = pmTotal > 0 ? ((d.value / pmTotal) * 100).toFixed(1) : '0'; });

        const affiliateDist = [];
        const affTotal = affiliateYes + affiliateNo;
        if (affiliateYes > 0) affiliateDist.push({ label: 'Order Afiliasi', name: 'Afiliasi', value: affiliateYes, color: '#7c3aed', total: affTotal, pct: ((affiliateYes / affTotal) * 100).toFixed(1) });
        if (affiliateNo > 0) affiliateDist.push({ label: 'Order Organik (Non-Afiliasi)', name: 'Non-Afiliasi', value: affiliateNo, color: '#06b6d4', total: affTotal, pct: ((affiliateNo / affTotal) * 100).toFixed(1) });

        const result = { sums, dailyData, monthlyData, topProducts, paymentMethodDist, affiliateDist, recentTransactions };
        if (rangkumanData.length > 0) {
            setComputed(dashCacheKey, result);
        }
        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangkumanData, rangkumanVersion, filterStartDate, filterEndDate]);

    const { sums, dailyData, monthlyData, topProducts, paymentMethodDist, affiliateDist, recentTransactions = [] } = processedData;

    const isMonthly = granularityOverride === 'monthly'
        ? true
        : granularityOverride === 'daily'
            ? false
            : (!filterStartDate && !filterEndDate);
    const chartData = isMonthly ? monthlyData : dailyData;

    const activeBarIdx = useMemo(() => {
        if (!chartData || chartData.length === 0) return -1;
        if (selectedBarIndex !== null && selectedBarIndex >= 0 && selectedBarIndex < chartData.length) {
            return selectedBarIndex;
        }
        let bestIdx = chartData.length - 1;
        let bestVal = -Infinity;
        chartData.forEach((d, idx) => {
            const v = Number(d[cashFlowTab] || 0);
            if (v > bestVal) {
                bestVal = v;
                bestIdx = idx;
            }
        });
        return bestIdx;
    }, [chartData, selectedBarIndex, cashFlowTab]);

    const activeBarPoint = activeBarIdx >= 0 && chartData[activeBarIdx] ? chartData[activeBarIdx] : null;

    const activeMonthKey = useMemo(() => {
        if (!filterStartDate || !filterEndDate) return null;
        if (filterStartDate.slice(0, 7) === filterEndDate.slice(0, 7)) {
            const [y, m] = filterStartDate.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            if (filterStartDate.endsWith('-01') && parseInt(filterEndDate.slice(8, 10), 10) === lastDay) {
                return filterStartDate.slice(0, 7);
            }
        }
        return null;
    }, [filterStartDate, filterEndDate]);

    const handleBarClick = useCallback((_, index) => {
        if (typeof index === 'number' && index >= 0) {
            setSelectedBarIndex(index);
        }
    }, []);

    const formatDateDisplay = () => {
        if (activeMonthKey) {
            const [y, m] = activeMonthKey.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            return `${months[parseInt(m, 10) - 1]} ${y}`;
        }
        if (!filterStartDate && !filterEndDate) return 'Semua Tanggal';
        const fmt = (d) => {
            if (!d) return '';
            const [y, m, day] = d.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            return `${parseInt(day, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
        };
        if (filterStartDate && filterEndDate) return `${fmt(filterStartDate)} — ${fmt(filterEndDate)}`;
        if (filterStartDate) return `Dari ${fmt(filterStartDate)}`;
        return `Sampai ${fmt(filterEndDate)}`;
    };

    const applyDatePreset = (preset) => {
        setSelectedBarIndex(null);
        setActiveDatePreset(preset);
        if (preset === 'all') {
            setFilterStartDate('');
            setFilterEndDate('');
            return;
        }
        let latestTime = Date.now();
        if (rangkumanData.length > 0) {
            let maxT = 0;
            for (let i = 0; i < rangkumanData.length; i++) {
                if (rangkumanData[i]._timestamp > maxT) maxT = rangkumanData[i]._timestamp;
            }
            if (maxT > 0) latestTime = maxT;
        }
        const refDate = new Date(latestTime);
        const toKey = (d) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

        if (preset === 'thisMonth') {
            const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
            const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
            setFilterStartDate(toKey(start));
            setFilterEndDate(toKey(end));
        } else if (preset === 'last30') {
            const start = new Date(refDate);
            start.setDate(start.getDate() - 29);
            setFilterStartDate(toKey(start));
            setFilterEndDate(toKey(refDate));
        } else if (preset === 'last90') {
            const start = new Date(refDate);
            start.setDate(start.getDate() - 89);
            setFilterStartDate(toKey(start));
            setFilterEndDate(toKey(refDate));
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width: '2.25rem', height: '2.25rem', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 0.875rem' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Memuat analitik dashboard...</span>
            </div>
        );
    }

    if (rangkumanData.length === 0) {
        return (
            <div>
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '20px', border: '1px solid #eef0f6', marginBottom: '1.5rem' }}>
                    <Package size={56} strokeWidth={1.5} style={{ margin: '0 auto 1rem', color: '#7c3aed' }} />
                    <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Belum Ada Data Transaksi</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '26rem', margin: '0 auto 1.25rem', fontSize: '0.875rem' }}>
                        Upload file laporan Excel pesanan dan penghasilan terlebih dahulu untuk mengaktifkan dashboard interaktif.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/upload')}
                        style={{
                            padding: '0.65rem 1.4rem',
                            borderRadius: '9999px',
                            background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 6px 20px rgba(124, 58, 237, 0.25)',
                        }}
                    >
                        Upload File Sekarang →
                    </button>
                </div>
                <DashboardModernCards rangkumanData={rangkumanData} />
            </div>
        );
    }

    const isMobile = windowWidth < 768;

    const profitMarginPct = sums.labaKotor > 0 ? ((sums.labaBersih / sums.labaKotor) * 100).toFixed(1) : '0.0';
    const orderSuccessPct = sums.pesananOrder > 0 ? ((sums.fixTerbeliOrder / sums.pesananOrder) * 100).toFixed(1) : '0.0';
    const settlementRatePct = sums.fixTerbeliOrder > 0 ? ((sums.sudahCairOrder / sums.fixTerbeliOrder) * 100).toFixed(1) : '0.0';

    const earningHeroConfig = {
        labaBersih: {
            title: 'Profit (Penerimaan Bersih - HPP)',
            value: formatRupiah(sums.labaBersih),
            badge: `+${profitMarginPct}% Profit`,
            badgeColor: '#10b981',
            badgeBg: 'rgba(16, 185, 129, 0.12)',
            subText: `Penerimaan Bersih: ${formatRupiah(sums.labaKotor)}`,
            dataKey: 'labaBersih',
            stroke: '#7c3aed',
            fillId: 'heroGradPurple',
        },
        labaKotor: {
            title: 'Total Penerimaan Bersih',
            value: formatRupiah(sums.labaKotor),
            badge: `${sums.sudahCairOrder.toLocaleString('id-ID')} Order Dana Diterima`,
            badgeColor: '#06b6d4',
            badgeBg: 'rgba(6, 182, 212, 0.12)',
            subText: `Profit: ${formatRupiah(sums.labaBersih)}`,
            dataKey: 'labaKotor',
            stroke: '#06b6d4',
            fillId: 'heroGradCyan',
        },
        aset: {
            title: 'Profit + Nilai Barang Dalam Pengiriman',
            value: formatRupiah(sums.labaBersih + sums.estimasiAsetDiJalan),
            badge: `Nilai Barang Dikirim: ${formatCompact(sums.estimasiAsetDiJalan)}`,
            badgeColor: '#f59e0b',
            badgeBg: 'rgba(245, 158, 11, 0.14)',
            subText: `${sums.belumCairOrder.toLocaleString('id-ID')} pesanan masih piutang marketplace`,
            dataKey: 'labaBersih',
            stroke: '#10b981',
            fillId: 'heroGradEmerald',
        },
    }[earningMode];

    const peakEarningPoint = (() => {
        if (!chartData || chartData.length === 0) return null;
        let maxP = chartData[chartData.length - 1];
        chartData.forEach(d => {
            if ((d[earningHeroConfig.dataKey] || 0) > (maxP[earningHeroConfig.dataKey] || 0)) {
                maxP = d;
            }
        });
        return maxP;
    })();

    const breakdownConfig = (() => {
        if (breakdownMode === 'keuangan') {
            const modalVal = Math.max(0, sums.totalModalValid);
            const labaVal = Math.max(0, sums.labaBersih);
            const affVal = Math.max(0, sums.affiliasiNominal);
            const total = modalVal + labaVal + affVal || 1;
            return {
                heroValue: formatRupiah(sums.labaKotor),
                heroSub: `${sums.sudahCairOrder.toLocaleString('id-ID')} Transaksi Dana Diterima`,
                badgeText: `${profitMarginPct}% Profit`,
                badgePositive: true,
                segments: [
                    { label: 'HPP', amount: formatCompact(modalVal), fullAmount: formatRupiah(modalVal), pct: Math.max(6, Math.round((modalVal / total) * 100)), rawPct: ((modalVal / total) * 100).toFixed(1), color: '#7c3aed' },
                    { label: 'Profit', amount: formatCompact(labaVal), fullAmount: formatRupiah(labaVal), pct: Math.max(6, Math.round((labaVal / total) * 100)), rawPct: ((labaVal / total) * 100).toFixed(1), color: '#10b981' },
                    { label: 'Komisi Afiliasi', amount: formatCompact(affVal), fullAmount: formatRupiah(affVal), pct: Math.max(6, Math.round((affVal / total) * 100)), rawPct: ((affVal / total) * 100).toFixed(1), color: '#06b6d4' },
                ],
            };
        }
        if (breakdownMode === 'pencairan') {
            const cair = sums.sudahCairOrder;
            const belum = sums.belumCairOrder;
            const cancelRet = sums.cancelOrder + sums.returnOrder + sums.pengembalianOrder;
            const total = cair + belum + cancelRet || 1;
            return {
                heroValue: `${sums.sudahCairOrder.toLocaleString('id-ID')} Order`,
                heroSub: `${sums.sudahCairPCS.toLocaleString('id-ID')} PCS Dana Diterima`,
                badgeText: `${settlementRatePct}% Dana Diterima`,
                badgePositive: true,
                segments: [
                    { label: 'Dana Diterima', amount: `${cair.toLocaleString('id-ID')} Order`, fullAmount: `${sums.sudahCairPCS.toLocaleString('id-ID')} PCS`, pct: Math.max(6, Math.round((cair / total) * 100)), rawPct: ((cair / total) * 100).toFixed(1), color: '#10b981' },
                    { label: 'Piutang Marketplace', amount: `${belum.toLocaleString('id-ID')} Order`, fullAmount: formatRupiah(sums.estimasiAsetDiJalan), pct: Math.max(6, Math.round((belum / total) * 100)), rawPct: ((belum / total) * 100).toFixed(1), color: '#f59e0b' },
                    { label: 'Batal & Retur', amount: `${cancelRet.toLocaleString('id-ID')} Order`, fullAmount: 'Tanpa Penerimaan Dana', pct: Math.max(6, Math.round((cancelRet / total) * 100)), rawPct: ((cancelRet / total) * 100).toFixed(1), color: '#ef4444' },
                ],
            };
        }
        const terjual = sums.fixTerbeliOrder;
        const cancel = sums.cancelOrder;
        const returGagal = sums.returnOrder + sums.pengembalianOrder;
        const total = terjual + cancel + returGagal || 1;
        return {
            heroValue: `${sums.pesananOrder.toLocaleString('id-ID')} Pesanan`,
            heroSub: `Total Volume: ${sums.pesananPCS.toLocaleString('id-ID')} PCS`,
            badgeText: `${orderSuccessPct}% Pesanan Valid`,
            badgePositive: parseFloat(orderSuccessPct) >= 70,
            segments: [
                { label: 'Pesanan Valid', amount: `${terjual.toLocaleString('id-ID')} Order`, fullAmount: `${sums.fixTerbeliPCS.toLocaleString('id-ID')} PCS`, pct: Math.max(8, Math.round((terjual / total) * 100)), rawPct: ((terjual / total) * 100).toFixed(1), color: '#10b981' },
                { label: 'Dibatalkan', amount: `${cancel.toLocaleString('id-ID')} Order`, fullAmount: `${sums.cancelPCS.toLocaleString('id-ID')} PCS`, pct: Math.max(6, Math.round((cancel / total) * 100)), rawPct: ((cancel / total) * 100).toFixed(1), color: '#ef4444' },
                { label: 'Retur & Pengembalian', amount: `${returGagal.toLocaleString('id-ID')} Order`, fullAmount: `Retur: ${sums.returnOrder} · Gagal: ${sums.pengembalianOrder}`, pct: Math.max(6, Math.round((returGagal / total) * 100)), rawPct: ((returGagal / total) * 100).toFixed(1), color: '#7c3aed' },
            ],
        };
    })();

    const cashFlowTabsConfig = {
        labaBersih: {
            label: 'Profit',
            heroTotal: formatRupiah(sums.labaBersih),
            heroSub: `Profit +${profitMarginPct}%`,
            color: '#7c3aed',
            isCurrency: true,
            unit: '',
        },
        labaKotor: {
            label: 'Penerimaan Bersih',
            heroTotal: formatRupiah(sums.labaKotor),
            heroSub: 'Net Settlement',
            color: '#06b6d4',
            isCurrency: true,
            unit: '',
        },
        fixTerbeli: {
            label: 'Volume Terjual',
            heroTotal: `${sums.fixTerbeliPCS.toLocaleString('id-ID')} PCS`,
            heroSub: `${sums.fixTerbeliOrder.toLocaleString('id-ID')} Order`,
            color: '#10b981',
            isCurrency: false,
            unit: ' PCS',
        },
        sudahCair: {
            label: 'Order Dana Diterima',
            heroTotal: `${sums.sudahCairOrder.toLocaleString('id-ID')} Pesanan`,
            heroSub: `${sums.sudahCairPCS.toLocaleString('id-ID')} PCS`,
            color: '#f59e0b',
            isCurrency: false,
            unit: ' Order',
        },
        belumCair: {
            label: 'Order Piutang Marketplace',
            heroTotal: `${sums.belumCairOrder.toLocaleString('id-ID')} Pesanan`,
            heroSub: `${sums.belumCairPCS.toLocaleString('id-ID')} PCS`,
            color: '#2563eb',
            isCurrency: false,
            unit: ' Order',
        },
        cancelRetur: {
            label: 'Batal & Retur',
            heroTotal: `${(sums.cancelOrder + sums.returnOrder + sums.pengembalianOrder).toLocaleString('id-ID')} Order`,
            heroSub: `${(sums.cancelPCS + sums.pengembalianPCS).toLocaleString('id-ID')} PCS`,
            color: '#ef4444',
            isCurrency: false,
            unit: ' Order',
        },
    };
    const activeCashFlowCfg = cashFlowTabsConfig[cashFlowTab];

    const rightPanelItems = (() => {
        if (rightPanelTab === 'pembayaran') {
            return paymentMethodDist.slice(0, 4).map((pm, idx) => ({
                id: pm.label,
                title: pm.label,
                subtitle: `Kontribusi ${pm.pct}% dari total transaksi`,
                amount: `${pm.value.toLocaleString('id-ID')} Order`,
                badge: idx === 0 ? 'Dominan' : `${pm.pct}%`,
                badgeColor: pm.color,
                icon: CreditCard,
                color: pm.color,
            }));
        }
        if (rightPanelTab === 'keuangan') {
            return [
                {
                    id: 'omzet',
                    title: 'Total Penerimaan Bersih',
                    subtitle: `${sums.sudahCairOrder.toLocaleString('id-ID')} pesanan dananya sudah diterima`,
                    amount: formatRupiah(sums.labaKotor),
                    badge: 'Net Settlement',
                    badgeColor: '#10b981',
                    icon: ArrowUpRight,
                    color: '#10b981',
                },
                {
                    id: 'laba',
                    title: 'Profit',
                    subtitle: `Rasio ${profitMarginPct}% dari penerimaan bersih, setelah HPP`,
                    amount: formatRupiah(sums.labaBersih),
                    badge: `+${profitMarginPct}%`,
                    badgeColor: '#7c3aed',
                    icon: TrendingUp,
                    color: '#7c3aed',
                },
                {
                    id: 'aset',
                    title: 'Nilai Barang Dalam Pengiriman',
                    subtitle: `${sums.belumCairOrder.toLocaleString('id-ID')} pesanan belum diterima dananya (piutang marketplace)`,
                    amount: formatRupiah(sums.estimasiAsetDiJalan),
                    badge: 'Dalam Proses',
                    badgeColor: '#f59e0b',
                    icon: Landmark,
                    color: '#f59e0b',
                },
                {
                    id: 'affiliasi',
                    title: 'Komisi Afiliasi',
                    subtitle: `Terlibat pada ${sums.affiliasiCount.toLocaleString('id-ID')} pesanan afiliasi`,
                    amount: formatRupiah(sums.affiliasiNominal),
                    badge: 'Afiliasi',
                    badgeColor: '#06b6d4',
                    icon: Handshake,
                    color: '#06b6d4',
                },
            ];
        }
        return [
            {
                id: 'sudah-cair',
                title: 'Pesanan Dana Diterima',
                subtitle: `${sums.sudahCairPCS.toLocaleString('id-ID')} PCS selesai & dana masuk`,
                amount: `${sums.sudahCairOrder.toLocaleString('id-ID')} Order`,
                badge: `${settlementRatePct}% Dana Diterima`,
                badgeColor: '#10b981',
                icon: Wallet,
                color: '#10b981',
            },
            {
                id: 'belum-cair',
                title: 'Piutang Marketplace',
                subtitle: `Nilai Barang (HPP): ${formatRupiah(sums.estimasiAsetDiJalan)}`,
                amount: `${sums.belumCairOrder.toLocaleString('id-ID')} Order`,
                badge: `${sums.belumCairPCS.toLocaleString('id-ID')} PCS`,
                badgeColor: '#f59e0b',
                icon: HourglassIcon,
                color: '#f59e0b',
            },
            {
                id: 'pengiriman',
                title: 'Status Pengiriman Aktif',
                subtitle: `Dalam Pengiriman: ${sums.terkirimOrder.toLocaleString('id-ID')} · Perlu Dikirim: ${sums.akanDikirimOrder.toLocaleString('id-ID')}`,
                amount: `${(sums.terkirimOrder + sums.akanDikirimOrder).toLocaleString('id-ID')} Paket`,
                badge: 'Logistik',
                badgeColor: '#06b6d4',
                icon: Truck,
                color: '#06b6d4',
            },
            {
                id: 'retur-cancel',
                title: 'Retur & Gagal Kirim',
                subtitle: `Retur: ${sums.returnOrder.toLocaleString('id-ID')} · Pengembalian: ${sums.pengembalianOrder.toLocaleString('id-ID')}`,
                amount: `${(sums.returnOrder + sums.pengembalianOrder).toLocaleString('id-ID')} Paket`,
                badge: `Batal: ${sums.cancelOrder.toLocaleString('id-ID')}`,
                badgeColor: '#ef4444',
                icon: RotateCcw,
                color: '#ef4444',
            },
        ];
    })();

    const cardSurface = {
        ...CARD_SURFACE,
        padding: isMobile ? '0.75rem 0.85rem' : '1.5rem',
    };

    const datePresets = [
        { id: 'all', label: 'Semua' },
        { id: 'last30', label: '30 Hari' },
        { id: 'last90', label: '3 Bulan' },
        { id: 'thisMonth', label: isMobile ? 'Bulan Ini' : 'Bulan Terakhir' },
    ];

    return (
        <div style={{ paddingBottom: isMobile ? '5.5rem' : '2rem', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* ════════════════════════════════════════════════════════════════
                1. FINLO-STYLE INTERACTIVE TOP HEADER BAR
                ════════════════════════════════════════════════════════════════ */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '0' : '0.75rem',
                    marginBottom: isMobile ? '0.55rem' : '1.35rem',
                    background: isMobile ? 'transparent' : '#ffffff',
                    padding: isMobile ? '0 0.15rem 0.25rem' : '1rem 1.5rem',
                    borderRadius: isMobile ? '0' : '20px',
                    border: isMobile ? 'none' : '1px solid #eef0f6',
                    boxShadow: isMobile ? 'none' : '0 2px 12px rgba(0, 0, 0, 0.025)',
                }}
            >
                {isMobile ? (
                    /* ── Sleek Mobile Segmented Filter Bar ── */
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: '0.5rem',
                        }}
                        ref={datePickerRef}
                    >
                        {/* Cohesive Segmented Capsule Track */}
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: '#ffffff',
                                padding: '3px',
                                borderRadius: '9999px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                        >
                            {/* Tab 1: Semua */}
                            <button
                                type="button"
                                onClick={() => {
                                    applyDatePreset('all');
                                    setFilterStartDate('');
                                    setFilterEndDate('');
                                }}
                                style={{
                                    padding: '0.35rem 0.85rem',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: (!filterStartDate && !filterEndDate) ? 700 : 500,
                                    cursor: 'pointer',
                                    background: (!filterStartDate && !filterEndDate) ? '#7c3aed' : 'transparent',
                                    color: (!filterStartDate && !filterEndDate) ? '#ffffff' : '#64748b',
                                    boxShadow: (!filterStartDate && !filterEndDate) ? '0 2px 6px rgba(124, 58, 237, 0.28)' : 'none',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.18s ease',
                                }}
                            >
                                Semua
                            </button>

                            {/* Tab 2: Kustom */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                    style={{
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '9999px',
                                        border: 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: (filterStartDate || filterEndDate) ? 700 : 500,
                                        cursor: 'pointer',
                                        background: (filterStartDate || filterEndDate) ? '#7c3aed' : 'transparent',
                                        color: (filterStartDate || filterEndDate) ? '#ffffff' : '#64748b',
                                        boxShadow: (filterStartDate || filterEndDate) ? '0 2px 6px rgba(124, 58, 237, 0.28)' : 'none',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'all 0.18s ease',
                                    }}
                                >
                                    <Calendar
                                        size={13}
                                        style={{ flexShrink: 0 }}
                                        color={(filterStartDate || filterEndDate) ? '#ffffff' : '#64748b'}
                                    />
                                    <span>
                                        {(filterStartDate && filterEndDate)
                                            ? `${filterStartDate.slice(5).replace('-', '/')} - ${filterEndDate.slice(5).replace('-', '/')}`
                                            : 'Kustom'}
                                    </span>
                                    {(filterStartDate || filterEndDate) && (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFilterStartDate('');
                                                setFilterEndDate('');
                                                setActiveDatePreset('all');
                                            }}
                                            title="Reset tanggal"
                                            style={{ marginLeft: 2, display: 'inline-flex', color: '#ffffff', flexShrink: 0 }}
                                        >
                                            <X size={12} />
                                        </span>
                                    )}
                                </button>

                                {showDatePicker && (
                                    <>
                                        <div
                                            onClick={() => setShowDatePicker(false)}
                                            style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(15, 23, 42, 0.45)',
                                                zIndex: 9998,
                                                backdropFilter: 'blur(2px)',
                                            }}
                                        />
                                        <div
                                            style={{
                                                position: 'fixed',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: 9999,
                                                maxWidth: 'calc(100vw - 20px)',
                                                maxHeight: '90vh',
                                                overflowY: 'auto',
                                            }}
                                        >
                                            <DateRangePicker
                                                startDate={filterStartDate}
                                                endDate={filterEndDate}
                                                onChange={({ startDate, endDate }) => {
                                                    setFilterStartDate(startDate);
                                                    setFilterEndDate(endDate);
                                                    setActiveDatePreset(!startDate && !endDate ? 'all' : 'custom');
                                                    setSelectedBarIndex(null);
                                                }}
                                                onClose={() => setShowDatePicker(false)}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Order Count Live Badge on the Right */}
                        <div
                            style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: '#475569',
                                background: '#ffffff',
                                padding: '0.38rem 0.75rem',
                                borderRadius: '9999px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                flexShrink: 0,
                            }}
                        >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span>{sums.pesananOrder.toLocaleString('id-ID')} pesanan</span>
                        </div>
                    </div>
                ) : (
                    /* ── Desktop Greeting Banner ── */
                    <>
                        {/* Upper Row: Avatar + Greeting + Calendar Button */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.65rem',
                                width: '100%',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', minWidth: 0 }}>
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifySelf: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        fontSize: '1.125rem',
                                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.22)',
                                        flexShrink: 0,
                                    }}
                                >
                                    {(user?.name || activeStore?.name || 'M')[0].toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            Halo, {user?.name || activeStore?.name || 'Partner'}
                                        </h2>
                                        {activeStore && (
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    padding: '3px 10px',
                                                    borderRadius: '9999px',
                                                    background: 'rgba(124, 58, 237, 0.1)',
                                                    color: '#7c3aed',
                                                    border: '1px solid rgba(124, 58, 237, 0.2)',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Store size={12} strokeWidth={2.2} />
                                                {activeStore.name}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: '0.05rem 0 0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        Ringkasan performa interaktif · <strong style={{ color: 'var(--text-primary)' }}>{sums.pesananOrder.toLocaleString('id-ID')}</strong> pesanan tercatat
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        background: '#f4f5f9',
                                        padding: '3px',
                                        borderRadius: '9999px',
                                        border: '1px solid #e5e7f0',
                                    }}
                                >
                                    {datePresets.map((p) => {
                                        const isPresetActive = (!filterStartDate && !filterEndDate)
                                            ? p.id === 'all'
                                            : activeDatePreset === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => applyDatePreset(p.id)}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '9999px',
                                                    border: 'none',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    background: isPresetActive ? '#ffffff' : 'transparent',
                                                    color: isPresetActive ? '#7c3aed' : 'var(--text-secondary)',
                                                    boxShadow: isPresetActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                                    transition: 'background 0.15s ease, color 0.15s ease',
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div style={{ position: 'relative' }} ref={datePickerRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.45rem',
                                            padding: '0.55rem 1.1rem',
                                            background: filterStartDate || filterEndDate ? 'rgba(124, 58, 237, 0.08)' : '#ffffff',
                                            border: filterStartDate || filterEndDate ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid #e2e5ef',
                                            borderRadius: '9999px',
                                            cursor: 'pointer',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            color: filterStartDate || filterEndDate ? '#7c3aed' : 'var(--text-primary)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <Calendar size={15} color="#7c3aed" />
                                        <span>{formatDateDisplay()}</span>
                                    </button>
                                    {showDatePicker && (
                                        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 120 }}>
                                            <DateRangePicker
                                                startDate={filterStartDate}
                                                endDate={filterEndDate}
                                                onChange={({ startDate, endDate }) => {
                                                    setFilterStartDate(startDate);
                                                    setFilterEndDate(endDate);
                                                    setActiveDatePreset(!startDate && !endDate ? 'all' : 'custom');
                                                    setSelectedBarIndex(null);
                                                }}
                                                onClose={() => setShowDatePicker(false)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                2. REFINED 4 PRIMARY KPI CARDS (Compact 2x2 on Mobile, Balanced Height)
                ════════════════════════════════════════════════════════════════ */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                    gap: isMobile ? '0.5rem' : '1.125rem',
                    marginBottom: isMobile ? '0.75rem' : '1.35rem',
                }}
            >
                {[
                    {
                        id: 'pesanan',
                        label: 'Total Pesanan',
                        value: formatCompact(sums.pesananOrder),
                        leftSub: isMobile ? `${(sums.pesananPCS / 1000).toFixed(1)}k Pcs` : `${sums.pesananPCS.toLocaleString('id-ID')} PCS`,
                        badge: isMobile ? `${formatCompact(sums.codJumlah)} COD` : `${sums.codJumlah.toLocaleString('id-ID')} COD`,
                        icon: ShoppingBag,
                        color: '#7c3aed',
                        gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                        onClick: () => {
                            setActiveKpiId('pesanan');
                            setBreakdownMode('status');
                            setCashFlowTab('fixTerbeli');
                            setSelectedBarIndex(null);
                        },
                    },
                    {
                        id: 'terjual',
                        label: 'Pesanan Valid',
                        value: formatCompact(sums.fixTerbeliOrder),
                        leftSub: isMobile ? `${(sums.fixTerbeliPCS / 1000).toFixed(1)}k Pcs` : `${sums.fixTerbeliPCS.toLocaleString('id-ID')} PCS`,
                        badge: `${orderSuccessPct}% Sukses`,
                        icon: CheckCircle,
                        color: '#10b981',
                        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
                        onClick: () => {
                            setActiveKpiId('terjual');
                            setBreakdownMode('status');
                            setCashFlowTab('fixTerbeli');
                            setSelectedBarIndex(null);
                        },
                    },
                    {
                        id: 'laba',
                        label: 'Profit',
                        value: formatRupiah(sums.labaBersih),
                        leftSub: isMobile ? `Bersih: ${formatCompact(sums.labaKotor)}` : `Penerimaan Bersih: ${formatCompact(sums.labaKotor)}`,
                        badge: isMobile ? `+${profitMarginPct}%` : `+${profitMarginPct}% Profit`,
                        icon: Wallet,
                        color: '#f59e0b',
                        gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                        onClick: () => {
                            setActiveKpiId('laba');
                            setEarningMode('labaBersih');
                            setCashFlowTab('labaBersih');
                            setSelectedBarIndex(null);
                        },
                    },
                    {
                        id: 'aset',
                        label: isMobile ? 'Nilai Barang Dikirim' : 'Profit + Nilai Barang Dikirim',
                        value: formatRupiah(sums.labaBersih + sums.estimasiAsetDiJalan),
                        leftSub: isMobile ? `Kirim: ${formatCompact(sums.estimasiAsetDiJalan)}` : `Nilai Barang Dikirim: ${formatCompact(sums.estimasiAsetDiJalan)}`,
                        badge: isMobile ? `${sums.belumCairOrder} Proses` : `${sums.belumCairOrder.toLocaleString('id-ID')} Proses`,
                        icon: Landmark,
                        color: '#06b6d4',
                        gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
                        onClick: () => {
                            setActiveKpiId('aset');
                            setEarningMode('aset');
                            setBreakdownMode('pencairan');
                            setCashFlowTab('belumCair');
                            setSelectedBarIndex(null);
                        },
                    },
                ].map((card) => {
                    const Icon = card.icon;
                    const isFocused = activeKpiId === card.id;
                    return (
                        <button
                            key={card.id}
                            type="button"
                            onClick={card.onClick}
                            style={{
                                textAlign: 'left',
                                background: '#ffffff',
                                borderRadius: isMobile ? '14px' : '20px',
                                padding: isMobile ? '0.65rem 0.72rem' : '1.25rem 1.35rem',
                                border: isFocused ? `1.5px solid ${card.color}` : '1px solid #eef0f6',
                                boxShadow: isFocused
                                    ? `0 8px 24px -4px ${card.color}22`
                                    : '0 4px 18px -2px rgba(108, 92, 231, 0.04), 0 2px 6px rgba(0, 0, 0, 0.02)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                                outline: 'none',
                                minWidth: 0,
                            }}
                        >
                            {/* Top Row: Label on left + Soft Icon Box on right */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', width: '100%', marginBottom: isMobile ? '0.35rem' : '0.5rem' }}>
                                <span style={{ fontSize: isMobile ? '0.625rem' : '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {card.label}
                                </span>
                                <div
                                    style={{
                                        width: isMobile ? 26 : 38,
                                        height: isMobile ? 26 : 38,
                                        borderRadius: isMobile ? '8px' : '11px',
                                        background: card.gradient,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: `0 4px 10px ${card.color}30`,
                                    }}
                                >
                                    <Icon size={isMobile ? 13 : 18} color="#ffffff" strokeWidth={2.2} />
                                </div>
                            </div>

                            {/* Middle Row: Crisp Big Number */}
                            <div
                                style={{
                                    fontSize: isMobile ? 'clamp(0.88rem, 3.6vw, 1.05rem)' : '1.5rem',
                                    fontWeight: 800,
                                    color: 'var(--text-primary)',
                                    letterSpacing: '-0.025em',
                                    lineHeight: 1.15,
                                    marginBottom: isMobile ? '0.45rem' : '0.75rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {card.value}
                            </div>

                            {/* Bottom Footer Row: Clean Divider + Left Subtext & Right Pill Badge */}
                            <div
                                style={{
                                    width: '100%',
                                    paddingTop: isMobile ? '0.4rem' : '0.6rem',
                                    borderTop: '1px solid #f2f3f8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.3rem',
                                }}
                            >
                                <span style={{ fontSize: isMobile ? '0.65rem' : '0.735rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {card.leftSub}
                                </span>
                                <span
                                    style={{
                                        fontSize: isMobile ? '0.625rem' : '0.6875rem',
                                        fontWeight: 700,
                                        padding: isMobile ? '1px 6px' : '2px 8px',
                                        borderRadius: '9999px',
                                        background: `${card.color}14`,
                                        color: card.color,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    {card.badge}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                3. ROW 1: FINLO DUAL HERO OVERVIEW CARDS
                ════════════════════════════════════════════════════════════════ */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(380px, 1fr))',
                    gap: isMobile ? '0.75rem' : '1.25rem',
                    marginBottom: isMobile ? '0.75rem' : '1.35rem',
                }}
            >
                {/* LEFT CARD: EARNING OVERVIEW */}
                <div style={{ ...cardSurface, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: isMobile ? '0.875rem' : '0.975rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    Earning Overview
                                </span>
                                <Info size={13} color="var(--text-tertiary)" title="Ringkasan tren penerimaan bersih dan profit toko Anda" />
                            </div>

                            {isMobile ? (
                                <div style={{ position: 'relative' }} data-mobile-card-menu="earning">
                                    <button
                                        type="button"
                                        title="Pilih Mode Earning"
                                        onClick={() => setMobileCardMenu(mobileCardMenu === 'earning' ? null : 'earning')}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: earningMode !== 'labaBersih' ? 'rgba(124, 58, 237, 0.12)' : '#f4f5f9',
                                            border: earningMode !== 'labaBersih' ? '1px solid #7c3aed' : '1px solid #e5e7f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: earningMode !== 'labaBersih' ? '#7c3aed' : 'var(--text-secondary)',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <Filter size={13} />
                                    </button>
                                    {mobileCardMenu === 'earning' && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '120%',
                                                right: 0,
                                                width: '185px',
                                                background: '#ffffff',
                                                borderRadius: '12px',
                                                padding: '0.4rem',
                                                boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                                                border: '1px solid #e5e7f0',
                                                zIndex: 100,
                                            }}
                                        >
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.2rem 0.5rem', textTransform: 'uppercase' }}>
                                                Mode Tampilan
                                            </div>
                                            {[
                                                { id: 'labaBersih', label: 'Profit' },
                                                { id: 'labaKotor', label: 'Penerimaan Bersih' },
                                                { id: 'aset', label: 'Profit + Nilai Barang Dikirim' },
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => { setEarningMode(tab.id); setMobileCardMenu(null); }}
                                                    style={{
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.45rem 0.55rem',
                                                        background: earningMode === tab.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                                        border: 'none',
                                                        color: earningMode === tab.id ? '#7c3aed' : 'var(--text-primary)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <span>{tab.label}</span>
                                                    {earningMode === tab.id && <Check size={14} color="#7c3aed" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        background: '#f4f5f9',
                                        padding: '2px',
                                        borderRadius: '9999px',
                                        border: '1px solid #e5e7f0',
                                    }}
                                >
                                    {[
                                        { id: 'labaBersih', label: 'Profit' },
                                        { id: 'labaKotor', label: 'Penerimaan Bersih' },
                                        { id: 'aset', label: 'Profit + Nilai Barang Dikirim' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setEarningMode(tab.id)}
                                            style={{
                                                padding: '4px 11px',
                                                borderRadius: '9999px',
                                                border: 'none',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                background: earningMode === tab.id ? '#ffffff' : 'transparent',
                                                color: earningMode === tab.id ? '#7c3aed' : 'var(--text-secondary)',
                                                boxShadow: earningMode === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'background 0.15s ease, color 0.15s ease',
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: isMobile ? '1.35rem' : '2.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                                {earningHeroConfig.value}
                            </span>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: isMobile ? '2px 8px' : '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: isMobile ? '0.68rem' : '0.735rem',
                                    fontWeight: 700,
                                    background: earningHeroConfig.badgeBg,
                                    color: earningHeroConfig.badgeColor,
                                }}
                            >
                                {earningHeroConfig.badge} ↑
                            </span>
                        </div>
                        <p style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', margin: isMobile ? '0 0 0.5rem' : '0 0 0.75rem', fontWeight: 500 }}>
                            {earningHeroConfig.subText}
                        </p>
                    </div>

                    <div>
                        {peakEarningPoint && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: isMobile ? '0.35rem 0.65rem' : '4px 12px',
                                    borderRadius: '8px',
                                    background: '#f8f9fc',
                                    border: '1px solid #eef0f6',
                                    marginBottom: isMobile ? '0.55rem' : '0.35rem',
                                    fontSize: isMobile ? '0.72rem' : '0.735rem',
                                }}
                            >
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Puncak Tren ({formatPeriodLabel(peakEarningPoint.date, isMonthly)})
                                </span>
                                <strong style={{ color: earningHeroConfig.stroke, fontWeight: 800 }}>
                                    {formatRupiah(peakEarningPoint[earningHeroConfig.dataKey])}
                                </strong>
                            </div>
                        )}

                        <div style={{ height: isMobile ? 130 : 145, marginLeft: isMobile ? '-0.25rem' : '-0.5rem', marginRight: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="heroGradPurple" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.26} />
                                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="heroGradCyan" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.26} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="heroGradEmerald" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.26} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f7" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500 }}
                                        tickFormatter={(v) => formatShortAxis(v, isMonthly)}
                                        axisLine={false}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--text-tertiary)', fontSize: 9, fontWeight: 500 }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={isMobile ? 36 : 50}
                                        tickFormatter={(v) =>
                                            v >= 1000000000
                                                ? (v / 1000000000).toFixed(1) + 'M'
                                                : v >= 1000000
                                                    ? (v / 1000000).toFixed(0) + 'Jt'
                                                    : v >= 1000
                                                        ? (v / 1000).toFixed(0) + 'K'
                                                        : v > 0
                                                            ? v.toString()
                                                            : '0'
                                        }
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            background: '#ffffff',
                                            border: '1px solid #e5e7f0',
                                            borderRadius: '10px',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                                            fontSize: '0.78rem',
                                        }}
                                        formatter={(v) => [formatRupiah(v), earningHeroConfig.title]}
                                        labelFormatter={(l) => formatPeriodLabel(l, isMonthly)}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey={earningHeroConfig.dataKey}
                                        stroke={earningHeroConfig.stroke}
                                        strokeWidth={2.5}
                                        fill={`url(#${earningHeroConfig.fillId})`}
                                        dot={false}
                                        isAnimationActive={false}
                                        activeDot={{ r: 5, fill: earningHeroConfig.stroke, stroke: '#ffffff', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* RIGHT CARD: KOMPOSISI & BREAKDOWN */}
                <div style={{ ...cardSurface, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: isMobile ? '0.875rem' : '0.975rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    Komposisi & Breakdown
                                </span>
                                <Info size={13} color="var(--text-tertiary)" title="Proporsi status pesanan, penerimaan dana, dan alokasi HPP" />
                            </div>

                            {isMobile ? (
                                <div style={{ position: 'relative' }} data-mobile-card-menu="breakdown">
                                    <button
                                        type="button"
                                        title="Pilih Proporsi Breakdown"
                                        onClick={() => setMobileCardMenu(mobileCardMenu === 'breakdown' ? null : 'breakdown')}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: breakdownMode !== 'status' ? 'rgba(124, 58, 237, 0.12)' : '#f4f5f9',
                                            border: breakdownMode !== 'status' ? '1px solid #7c3aed' : '1px solid #e5e7f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: breakdownMode !== 'status' ? '#7c3aed' : 'var(--text-secondary)',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <Filter size={13} />
                                    </button>
                                    {mobileCardMenu === 'breakdown' && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '120%',
                                                right: 0,
                                                width: '185px',
                                                background: '#ffffff',
                                                borderRadius: '12px',
                                                padding: '0.4rem',
                                                boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                                                border: '1px solid #e5e7f0',
                                                zIndex: 100,
                                            }}
                                        >
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.2rem 0.5rem', textTransform: 'uppercase' }}>
                                                Mode Proporsi
                                            </div>
                                            {[
                                                { id: 'status', label: 'Status Pesanan' },
                                                { id: 'keuangan', label: 'HPP & Profit' },
                                                { id: 'pencairan', label: 'Penerimaan Dana' },
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => { setBreakdownMode(tab.id); setMobileCardMenu(null); }}
                                                    style={{
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.45rem 0.55rem',
                                                        background: breakdownMode === tab.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                                        border: 'none',
                                                        color: breakdownMode === tab.id ? '#7c3aed' : 'var(--text-primary)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <span>{tab.label}</span>
                                                    {breakdownMode === tab.id && <Check size={14} color="#7c3aed" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        background: '#f4f5f9',
                                        padding: '2px',
                                        borderRadius: '9999px',
                                        border: '1px solid #e5e7f0',
                                    }}
                                >
                                    {[
                                        { id: 'status', label: 'Status' },
                                        { id: 'keuangan', label: 'HPP & Profit' },
                                        { id: 'pencairan', label: 'Penerimaan Dana' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setBreakdownMode(tab.id)}
                                            style={{
                                                padding: '4px 11px',
                                                borderRadius: '9999px',
                                                border: 'none',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                background: breakdownMode === tab.id ? '#ffffff' : 'transparent',
                                                color: breakdownMode === tab.id ? '#7c3aed' : 'var(--text-secondary)',
                                                boxShadow: breakdownMode === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'background 0.15s ease, color 0.15s ease',
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: isMobile ? '1.35rem' : '2.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                                {breakdownConfig.heroValue}
                            </span>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: isMobile ? '2px 8px' : '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: isMobile ? '0.68rem' : '0.735rem',
                                    fontWeight: 700,
                                    background: breakdownConfig.badgePositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.14)',
                                    color: breakdownConfig.badgePositive ? '#10b981' : '#f59e0b',
                                }}
                            >
                                {breakdownConfig.badgeText}
                            </span>
                        </div>
                        <p style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', margin: isMobile ? '0 0 0.65rem' : '0 0 1.15rem', fontWeight: 500 }}>
                            {breakdownConfig.heroSub}
                        </p>
                    </div>

                    <div>
                        <div style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: isMobile ? '0.45rem' : '0.7rem' }}>
                            Rincian Proporsi
                        </div>

                        {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.65rem' }}>
                                {breakdownConfig.segments.map((seg) => (
                                    <div
                                        key={seg.label}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.4rem 0.65rem',
                                            borderRadius: '8px',
                                            background: '#f8fafc',
                                            border: '1px solid #edf2f7',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                {seg.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                            <strong style={{ fontSize: '0.775rem', fontWeight: 800, color: '#0f172a' }}>
                                                {seg.amount}
                                            </strong>
                                            <span
                                                style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    color: seg.color,
                                                    background: `${seg.color}15`,
                                                    padding: '1px 6px',
                                                    borderRadius: '6px',
                                                    minWidth: '38px',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {seg.rawPct}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '0.5rem',
                                    marginBottom: '0.85rem',
                                }}
                            >
                                {breakdownConfig.segments.map((seg) => (
                                    <div key={seg.label} style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.15rem' }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {seg.label}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', paddingLeft: '0.9rem' }}>
                                            {seg.amount} <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>({seg.rawPct}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div
                            style={{
                                display: 'flex',
                                width: '100%',
                                height: isMobile ? '14px' : '36px',
                                borderRadius: isMobile ? '7px' : '10px',
                                overflow: 'hidden',
                                gap: '2px',
                                background: '#f1f2f8',
                                padding: '2px',
                            }}
                        >
                            {breakdownConfig.segments.map((seg) => (
                                <div
                                    key={seg.label}
                                    title={`${seg.label}: ${seg.fullAmount} (${seg.rawPct}%)`}
                                    style={{
                                        width: `${seg.pct}%`,
                                        height: '100%',
                                        background: seg.color,
                                        borderRadius: isMobile ? '5px' : '7px',
                                        transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {!isMobile && seg.pct >= 14 ? `${seg.rawPct}%` : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                4. ROW 2: FINLO BENTO GRID (2/3 Cash Flow Interactive Chart + 1/3 Status Operasional)
                ════════════════════════════════════════════════════════════════ */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.85fr) minmax(320px, 1fr)',
                    gap: isMobile ? '0.75rem' : '1.25rem',
                    marginBottom: isMobile ? '0.75rem' : '1.5rem',
                    alignItems: 'stretch',
                }}
            >
                {/* LEFT 2/3: CASH FLOW & PERFORMANCE INTERACTIVE BAR CHART */}
                <div style={{ ...cardSurface, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <h3 style={{ fontSize: isMobile ? '0.925rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                    Arus Kas & Tren Performa
                                </h3>
                                <Info size={13} color="var(--text-tertiary)" title="Klik batang grafik untuk menginspeksi rincian bulan/tanggal tertentu" />
                            </div>

                            {isMobile ? (
                                <div style={{ position: 'relative' }} data-mobile-card-menu="cashflow">
                                    <button
                                        type="button"
                                        title="Pilih Periode Grafik"
                                        onClick={() => setMobileCardMenu(mobileCardMenu === 'cashflow' ? null : 'cashflow')}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: !isMonthly ? 'rgba(124, 58, 237, 0.12)' : '#f4f5f9',
                                            border: !isMonthly ? '1px solid #7c3aed' : '1px solid #e5e7f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: !isMonthly ? '#7c3aed' : 'var(--text-secondary)',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <Filter size={13} />
                                    </button>
                                    {mobileCardMenu === 'cashflow' && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '120%',
                                                right: 0,
                                                width: '175px',
                                                background: '#ffffff',
                                                borderRadius: '12px',
                                                padding: '0.4rem',
                                                boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                                                border: '1px solid #e5e7f0',
                                                zIndex: 100,
                                            }}
                                        >
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.2rem 0.5rem', textTransform: 'uppercase' }}>
                                                Periode Grafik
                                            </div>
                                            {[
                                                { id: 'monthly', label: 'Tampilan Bulanan' },
                                                { id: 'daily', label: 'Tampilan Harian' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setGranularityOverride(opt.id);
                                                        setSelectedBarIndex(null);
                                                        setMobileCardMenu(null);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.45rem 0.55rem',
                                                        background: ((opt.id === 'monthly' && isMonthly) || (opt.id === 'daily' && !isMonthly)) ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                                        border: 'none',
                                                        color: ((opt.id === 'monthly' && isMonthly) || (opt.id === 'daily' && !isMonthly)) ? '#7c3aed' : 'var(--text-primary)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <span>{opt.label}</span>
                                                    {((opt.id === 'monthly' && isMonthly) || (opt.id === 'daily' && !isMonthly)) && <Check size={14} color="#7c3aed" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        background: '#f4f5f9',
                                        padding: '2px',
                                        borderRadius: '9999px',
                                        border: '1px solid #e5e7f0',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => { setGranularityOverride('monthly'); setSelectedBarIndex(null); }}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '9999px',
                                            border: 'none',
                                            fontSize: '0.725rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: isMonthly ? '#ffffff' : 'transparent',
                                            color: isMonthly ? '#7c3aed' : 'var(--text-secondary)',
                                            boxShadow: isMonthly ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        }}
                                    >
                                        Bulanan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setGranularityOverride('daily'); setSelectedBarIndex(null); }}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '9999px',
                                            border: 'none',
                                            fontSize: '0.725rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: !isMonthly ? '#ffffff' : 'transparent',
                                            color: !isMonthly ? '#7c3aed' : 'var(--text-secondary)',
                                            boxShadow: !isMonthly ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        }}
                                    >
                                        Harian
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', marginBottom: isMobile ? '0.4rem' : '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: isMobile ? '1.45rem' : '2.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                                    {activeCashFlowCfg.heroTotal}
                                </div>
                                {activeCashFlowCfg.heroSub && (
                                    <span style={{ fontSize: isMobile ? '0.75rem' : '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        ({activeCashFlowCfg.heroSub})
                                    </span>
                                )}
                            </div>
                        </div>

                        {activeBarPoint && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: isMobile ? '0.35rem 0.65rem' : '0.4rem 0.85rem',
                                    borderRadius: '8px',
                                    background: '#f8f9fc',
                                    border: `1px solid ${activeCashFlowCfg.color}35`,
                                    marginBottom: isMobile ? '0.55rem' : '0.75rem',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeCashFlowCfg.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        {formatPeriodLabel(activeBarPoint.date, isMonthly)}
                                    </span>
                                </div>
                                <strong style={{ fontSize: '0.8rem', color: activeCashFlowCfg.color, fontWeight: 800 }}>
                                    {activeCashFlowCfg.isCurrency
                                        ? formatRupiah(activeBarPoint[cashFlowTab])
                                        : cashFlowTab === 'sudahCair'
                                            ? `${(activeBarPoint.sudahCair || 0).toLocaleString('id-ID')} Order (${(activeBarPoint.sudahCairPCS || 0).toLocaleString('id-ID')} PCS)`
                                            : cashFlowTab === 'belumCair'
                                                ? `${(activeBarPoint.belumCair || 0).toLocaleString('id-ID')} Order (${(activeBarPoint.belumCairPCS || 0).toLocaleString('id-ID')} PCS)`
                                                : `${(activeBarPoint[cashFlowTab] || 0).toLocaleString('id-ID')}${activeCashFlowCfg.unit}`}
                                </strong>
                            </div>
                        )}

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: isMobile ? '0.35rem' : '0.45rem',
                                overflowX: isMobile ? 'auto' : 'visible',
                                WebkitOverflowScrolling: 'touch',
                                scrollbarWidth: 'none',
                                whiteSpace: 'nowrap',
                                paddingBottom: isMobile ? '3px' : 0,
                                marginBottom: isMobile ? '0.75rem' : '1.15rem',
                            }}
                        >
                            {Object.entries(cashFlowTabsConfig).map(([key, cfg]) => {
                                const isActive = cashFlowTab === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => { setCashFlowTab(key); setSelectedBarIndex(null); }}
                                        style={{
                                            padding: isMobile ? '0.32rem 0.65rem' : '0.42rem 0.95rem',
                                            borderRadius: '9999px',
                                            border: isActive ? `1px solid ${cfg.color}` : '1px solid #e5e7f0',
                                            fontSize: isMobile ? '0.7rem' : '0.76rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: isActive ? cfg.color : '#f8f9fc',
                                            color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                            boxShadow: isActive ? `0 4px 12px ${cfg.color}35` : 'none',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            transition: 'background 0.15s ease, color 0.15s ease',
                                        }}
                                    >
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Interactive Rounded Bar Chart (Single clean click handler & instant highlight) */}
                    <div style={{ height: isMobile ? 150 : 245, marginLeft: isMobile ? 0 : '-0.5rem', marginRight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                barSize={isMobile ? (isMonthly ? 18 : 8) : (isMonthly ? 34 : 14)}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f7" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: 'var(--text-secondary)', fontSize: isMobile ? 9 : 11, fontWeight: 600 }}
                                    tickFormatter={(v) => formatShortAxis(v, isMonthly)}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={isMobile ? 'preserveStartEnd' : undefined}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={isMobile ? 36 : 54}
                                    tickFormatter={(v) =>
                                        v >= 1000000000
                                            ? (v / 1000000000).toFixed(1) + 'M'
                                            : v >= 1000000
                                                ? (v / 1000000).toFixed(0) + 'Jt'
                                                : v >= 1000
                                                    ? (v / 1000).toFixed(0) + 'K'
                                                    : v
                                    }
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(124, 58, 237, 0.04)' }}
                                    contentStyle={{
                                        background: '#ffffff',
                                        border: '1px solid #e5e7f0',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                        fontSize: '0.8rem',
                                    }}
                                    formatter={(v, name, item) => {
                                        if (activeCashFlowCfg.isCurrency) return [formatRupiah(v), activeCashFlowCfg.label];
                                        const p = item && item.payload;
                                        if (cashFlowTab === 'sudahCair' && p) {
                                            return [`${Number(v).toLocaleString('id-ID')} Order (${(p.sudahCairPCS || 0).toLocaleString('id-ID')} PCS)`, activeCashFlowCfg.label];
                                        }
                                        if (cashFlowTab === 'belumCair' && p) {
                                            return [`${Number(v).toLocaleString('id-ID')} Order (${(p.belumCairPCS || 0).toLocaleString('id-ID')} PCS)`, activeCashFlowCfg.label];
                                        }
                                        return [`${Number(v).toLocaleString('id-ID')}${activeCashFlowCfg.unit}`, activeCashFlowCfg.label];
                                    }}
                                    labelFormatter={(l) => formatPeriodLabel(l, isMonthly)}
                                />
                                <Bar
                                    dataKey={cashFlowTab}
                                    radius={[8, 8, 8, 8]}
                                    cursor="pointer"
                                    isAnimationActive={false}
                                    onClick={handleBarClick}
                                >
                                    {chartData.map((_, idx) => (
                                        <Cell
                                            key={`bar-${idx}`}
                                            fill={idx === activeBarIdx ? activeCashFlowCfg.color : '#e8ebf5'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {activeBarPoint && (
                        <div
                            style={{
                                marginTop: isMobile ? '0.55rem' : '0.75rem',
                                padding: isMobile ? '0.55rem 0.65rem' : '0.75rem 1rem',
                                borderRadius: '12px',
                                background: '#f8f9fc',
                                border: '1px solid #edf2f7',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                                <span style={{ fontSize: isMobile ? '0.725rem' : '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                                    Rincian Periode {formatPeriodLabel(activeBarPoint.date, isMonthly)}
                                </span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', background: '#ffffff', padding: '1px 7px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                    {isMonthly ? 'Bulanan' : 'Harian'}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))',
                                    gap: isMobile ? '0.35rem 0.45rem' : '0.5rem 1rem',
                                }}
                            >
                                {[
                                    { label: 'Penerimaan', val: formatCompact(activeBarPoint.labaKotor), color: '#06b6d4' },
                                    { label: 'Profit', val: formatCompact(activeBarPoint.labaBersih), color: '#7c3aed' },
                                    { label: 'Terjual', val: `${activeBarPoint.fixTerbeli.toLocaleString('id-ID')} PCS`, color: '#10b981' },
                                    { label: 'Dana Masuk', val: `${activeBarPoint.sudahCair.toLocaleString('id-ID')} Order`, color: '#f59e0b' },
                                    { label: 'Piutang', val: `${activeBarPoint.belumCair.toLocaleString('id-ID')} Order`, color: '#2563eb' },
                                    { label: 'Batal/Retur', val: `${activeBarPoint.cancelRetur.toLocaleString('id-ID')} Order`, color: '#ef4444' },
                                ].map(item => (
                                    <div
                                        key={item.label}
                                        style={{
                                            padding: isMobile ? '0.35rem 0.55rem' : '0.4rem 0.65rem',
                                            borderRadius: '8px',
                                            background: '#ffffff',
                                            border: '1px solid #eef2f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.3rem',
                                        }}
                                    >
                                        <span style={{ fontSize: isMobile ? '0.66rem' : '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                            {item.label}
                                        </span>
                                        <strong style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: item.color, fontWeight: 800 }}>
                                            {item.val}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT 1/3: STATUS & INSIGHT UTAMA */}
                <div style={{ ...cardSurface, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '0.55rem' : '0.9rem' }}>
                            <h3 style={{ fontSize: isMobile ? '0.875rem' : '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                Status & Insight Utama
                            </h3>
                            {isMobile ? (
                                <div style={{ position: 'relative' }} data-mobile-card-menu="insight">
                                    <button
                                        type="button"
                                        title="Pilih Tipe Insight"
                                        onClick={() => setMobileCardMenu(mobileCardMenu === 'insight' ? null : 'insight')}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: rightPanelTab !== 'operasional' ? 'rgba(124, 58, 237, 0.12)' : '#f4f5f9',
                                            border: rightPanelTab !== 'operasional' ? '1px solid #7c3aed' : '1px solid #e5e7f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: rightPanelTab !== 'operasional' ? '#7c3aed' : 'var(--text-secondary)',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <Filter size={13} />
                                    </button>
                                    {mobileCardMenu === 'insight' && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '120%',
                                                right: 0,
                                                width: '185px',
                                                background: '#ffffff',
                                                borderRadius: '12px',
                                                padding: '0.4rem',
                                                boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                                                border: '1px solid #e5e7f0',
                                                zIndex: 100,
                                            }}
                                        >
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.2rem 0.5rem', textTransform: 'uppercase' }}>
                                                Tipe Insight
                                            </div>
                                            {[
                                                { id: 'operasional', label: 'Status Operasional' },
                                                { id: 'pembayaran', label: 'Metode Pembayaran' },
                                                { id: 'keuangan', label: 'Arus Keuangan' },
                                            ].map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => { setRightPanelTab(t.id); setMobileCardMenu(null); }}
                                                    style={{
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.45rem 0.55rem',
                                                        background: rightPanelTab === t.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                                        border: 'none',
                                                        color: rightPanelTab === t.id ? '#7c3aed' : 'var(--text-primary)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <span>{t.label}</span>
                                                    {rightPanelTab === t.id && <Check size={14} color="#7c3aed" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        background: '#f4f5f9',
                                        padding: '2px',
                                        borderRadius: '9999px',
                                        border: '1px solid #e5e7f0',
                                    }}
                                >
                                    {[
                                        { id: 'operasional', label: 'Status' },
                                        { id: 'pembayaran', label: 'Metode' },
                                        { id: 'keuangan', label: 'Keuangan' },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setRightPanelTab(t.id)}
                                            style={{
                                                padding: '3px 9px',
                                                borderRadius: '9999px',
                                                border: 'none',
                                                fontSize: '0.685rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                background: rightPanelTab === t.id ? '#ffffff' : 'transparent',
                                                color: rightPanelTab === t.id ? '#7c3aed' : 'var(--text-secondary)',
                                                boxShadow: rightPanelTab === t.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                            }}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.38rem' : '0.7rem' }}>
                            {rightPanelItems.map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => navigate('/rangkuman')}
                                        style={{
                                            padding: isMobile ? '0.5rem 0.65rem' : '0.85rem 1rem',
                                            borderRadius: isMobile ? '10px' : '16px',
                                            background: '#f9fafd',
                                            border: '1px solid #eef0f6',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.45rem',
                                            transition: 'border-color 0.15s ease, background 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#ffffff';
                                            e.currentTarget.style.borderColor = `${item.color}55`;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f9fafd';
                                            e.currentTarget.style.borderColor = '#eef0f6';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.45rem' : '0.7rem', minWidth: 0, flex: 1 }}>
                                            <div
                                                style={{
                                                    width: isMobile ? 26 : 36,
                                                    height: isMobile ? 26 : 36,
                                                    borderRadius: isMobile ? '6px' : '10px',
                                                    background: `${item.color}15`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <ItemIcon size={isMobile ? 13 : 17} color={item.color} strokeWidth={2.2} />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: isMobile ? '0.75rem' : '0.835rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.title}
                                                </div>
                                                <div style={{ fontSize: isMobile ? '0.64rem' : '0.715rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.subtitle}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: isMobile ? '0.78rem' : '0.925rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                                {item.amount}
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: isMobile ? '0.58rem' : '0.675rem',
                                                    fontWeight: 700,
                                                    padding: isMobile ? '1px 5px' : '3px 9px',
                                                    borderRadius: '9999px',
                                                    background: `${item.badgeColor}15`,
                                                    color: item.badgeColor,
                                                    display: 'inline-block',
                                                    marginTop: '1px',
                                                }}
                                            >
                                                {item.badge}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/rangkuman')}
                        style={{
                            marginTop: isMobile ? '0.65rem' : '0.9rem',
                            width: '100%',
                            padding: isMobile ? '0.55rem' : '0.68rem',
                            borderRadius: isMobile ? '10px' : '12px',
                            background: '#f4f5f9',
                            border: '1px solid #e5e7f0',
                            color: 'var(--text-primary)',
                            fontSize: isMobile ? '0.75rem' : '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#7c3aed';
                            e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f4f5f9';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                    >
                        Lihat Semua Rekap Transaksi →
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                5. ROW 3: SALES BY CATEGORY & REVENUE BY PROVINCE CARDS
                   (Synced with date filter & O(1) click switching)
                ════════════════════════════════════════════════════════════════ */}
            <DashboardModernCards
                rangkumanData={rangkumanData}
                filterStartDate={filterStartDate}
                filterEndDate={filterEndDate}
                isMobile={isMobile}
            />

            {/* ════════════════════════════════════════════════════════════════
                6. ROW 4: MEMOIZED RECENT TRANSACTION & TOP PRODUCTS TABLE
                ════════════════════════════════════════════════════════════════ */}
            <BottomActivitySection
                topProducts={topProducts}
                recentTransactions={recentTransactions}
                paymentMethodDist={paymentMethodDist}
                affiliateDist={affiliateDist}
                affiliasiNominal={sums.affiliasiNominal}
                isMobile={isMobile}
            />
        </div>
    );
}

// ─── DateRangePicker ─────────────────────────────────────────
function DateRangePicker({ startDate, endDate, onChange, onClose }) {
    const toLocalDateStr = (d) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const [selectingStart, setSelectingStart] = useState(true);
    const [calendarMonth, setCalendarMonth] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
    const [internalStartDate, setInternalStartDate] = useState(startDate ? new Date(startDate) : null);
    const [internalEndDate, setInternalEndDate] = useState(endDate ? new Date(endDate) : null);
    const [selectedMonth, setSelectedMonth] = useState('');

    function updateInputValue() {
        if (internalStartDate && internalEndDate) onChange({ startDate: toLocalDateStr(internalStartDate), endDate: toLocalDateStr(internalEndDate) });
        else if (internalStartDate) onChange({ startDate: toLocalDateStr(internalStartDate), endDate: '' });
        else onChange({ startDate: '', endDate: '' });
    }
    function onDateClick(date) {
        if (selectingStart) { setInternalStartDate(date); setInternalEndDate(null); setSelectingStart(false); }
        else {
            if (date < internalStartDate) { setInternalEndDate(internalStartDate); setInternalStartDate(date); }
            else setInternalEndDate(date);
            setSelectingStart(true); updateInputValue();
        }
    }
    function generateCalendarDays(monthDate) {
        const y = monthDate.getFullYear(), m = monthDate.getMonth();
        const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
        const days = [];
        for (let i = 0; i < first.getDay(); i++) days.push(null);
        for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
        return days;
    }
    const isInRange = (d) => { if (!internalStartDate) return false; if (!internalEndDate) return d.getTime() === internalStartDate.getTime(); return d >= internalStartDate && d <= internalEndDate; };
    const isStart = (d) => internalStartDate && d.getTime() === internalStartDate.getTime();
    const isEnd = (d) => internalEndDate && d.getTime() === internalEndDate.getTime();
    const prev = () => setCalendarMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
    const next = () => setCalendarMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));
    const fmtMY = (d) => { const ms = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; return `${ms[d.getMonth()]} ${d.getFullYear()}`; };
    const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const days = generateCalendarDays(calendarMonth);
    const clear = () => { setInternalStartDate(null); setInternalEndDate(null); setSelectingStart(true); onChange({ startDate: '', endDate: '' }); setSelectedMonth(''); };
    const apply = () => { updateInputValue(); if (onClose) onClose(); };
    const last7 = () => { const t = new Date(), s = new Date(); s.setDate(t.getDate() - 6); setInternalStartDate(s); setInternalEndDate(t); setSelectingStart(true); setSelectedMonth(''); onChange({ startDate: toLocalDateStr(s), endDate: toLocalDateStr(t) }); };
    const thisMonth = () => { const t = new Date(), s = new Date(t.getFullYear(), t.getMonth(), 1), e = new Date(t.getFullYear(), t.getMonth() + 1, 0); setInternalStartDate(s); setInternalEndDate(e); setSelectingStart(true); setSelectedMonth(`${t.getFullYear()}-${(t.getMonth() + 1).toString().padStart(2, '0')}`); onChange({ startDate: toLocalDateStr(s), endDate: toLocalDateStr(e) }); };
    const handleMonthChange = (ev) => { const v = ev.target.value; setSelectedMonth(v); if (!v) { clear(); return; } const [y, m] = v.split('-').map(Number); const s = new Date(y, m - 1, 1), e = new Date(y, m, 0); setInternalStartDate(s); setInternalEndDate(e); setSelectingStart(true); onChange({ startDate: toLocalDateStr(s), endDate: toLocalDateStr(e) }); setCalendarMonth(new Date(y, m - 1, 1)); };
    const monthOptions = useMemo(() => { const o = [], t = new Date(); for (let i = 0; i < 12; i++) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); o.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`); } return o; }, []);
    const fmtMO = (s) => { if (!s) return ''; const [y, m] = s.split('-'); const ms = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; return `${ms[parseInt(m, 10) - 1]} ${y}`; };
    const qBtn = { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0', transition: 'color var(--transition-fast)' };

    return (
        <div style={{ width: '20rem', borderRadius: '16px', border: '1px solid #e5e7f0', background: '#ffffff', padding: '1rem', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={last7} style={qBtn}>7 Hari Terakhir</button>
                <div style={{ height: '1rem', borderLeft: '1px solid var(--border-subtle)' }} />
                <button type="button" onClick={thisMonth} style={qBtn}>Bulan Ini</button>
                <div style={{ height: '1rem', borderLeft: '1px solid var(--border-subtle)' }} />
                <select value={selectedMonth} onChange={handleMonthChange} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, border: 'none', outline: 'none', cursor: 'pointer' }}>
                    <option value="">Pilih Bulan</option>
                    {monthOptions.map(m => <option key={m} value={m}>{fmtMO(m)}</option>)}
                </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <button type="button" onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: '0.25rem' }}><ChevronLeft size={18} /></button>
                <div style={{ fontWeight: 700, color: '#7c3aed', userSelect: 'none' }}>{fmtMY(calendarMonth)}</div>
                <button type="button" onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: '0.25rem' }}><ChevronRight size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.125rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#7c3aed', marginBottom: '0.25rem', userSelect: 'none' }}>
                {weekdays.map(w => <div key={w}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.125rem' }}>
                {days.map((d, i) => {
                    if (!d) return <div key={'e' + i} style={{ height: '2rem' }} />;
                    const sel = isInRange(d), st = isStart(d), en = isEnd(d);
                    const t = new Date(), isToday = d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
                    let bg = 'transparent', c = 'var(--text-primary)', fw = 400, br = '50%';
                    if (sel) { if (st && en) { bg = '#7c3aed'; c = '#fff'; fw = 700; } else if (st) { bg = '#7c3aed'; c = '#fff'; fw = 700; br = '50% 0 0 50%'; } else if (en) { bg = '#7c3aed'; c = '#fff'; fw = 700; br = '0 50% 50% 0'; } else { bg = 'rgba(124,58,237,0.18)'; c = '#7c3aed'; } } else if (isToday) { c = '#7c3aed'; fw = 700; }
                    return (<button key={d.toISOString()} type="button" onClick={() => onDateClick(d)} style={{ height: '2rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', cursor: 'pointer', border: isToday && !sel ? '1px solid #7c3aed' : 'none', background: bg, color: c, fontWeight: fw, borderRadius: br, userSelect: 'none' }}>{d.getDate()}</button>);
                })}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={clear} className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem' }}>Bersihkan</button>
                <button type="button" onClick={apply} className="btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem' }}>Terapkan</button>
            </div>
        </div>
    );
}

export default Dashboard;
