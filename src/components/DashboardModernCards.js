import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Filter, Info, Check, Layers, MapPin } from 'lucide-react';

function formatRupiah(number) {
    if (typeof number !== 'number' || isNaN(number)) return 'Rp0';
    const rounded = Math.round(number);
    if (rounded < 0) return 'Rp-' + (-rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatCompactRupiah(number) {
    if (typeof number !== 'number' || isNaN(number)) return 'Rp0';
    if (number >= 1000000000) return 'Rp' + (number / 1000000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (number >= 1000000) return 'Rp' + (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'Jt';
    if (number >= 1000) return 'Rp' + (number / 1000).toFixed(0) + 'K';
    return formatRupiah(number);
}

const BRAND_PALETTE = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

function detectProductCategory(title = '', sku = '') {
    const s = (sku || '').toString().trim().toLowerCase();
    const t = (title || '').toString().trim().toLowerCase();

    if (s === 'hw premium' || t.includes('premium') || t.includes('cutbray') || t.includes('knit')) {
        return 'Highwaist Premium & Knit';
    }
    if (s === 'rok-audi' || s === 'mermaid' || t.includes('rok') || t.includes('skirt') || t.includes('mermaid') || t.includes('audy')) {
        return 'Rok & Maxi Skirt';
    }
    if (s.includes('stelan') || s.includes('setelan') || t.includes('setelan') || t.includes('one set') || t.includes('salur') || t.includes('belt') || t.includes('sabuk')) {
        return 'Setelan & Aksesoris';
    }
    if (s === 'lp' || s.includes('oro') || s.includes('strip') || t.includes('oro pants') || t.includes('celana strip') || t.includes('celana kuliah')) {
        return 'Loose & Work Pants';
    }
    if (s === 'hw' || t.includes('shakila') || t.includes('kulot') || t.includes('celana')) {
        return 'Kulot Highwaist Basic';
    }
    return 'Koleksi Lainnya';
}

const DashboardModernCards = React.memo(function DashboardModernCards({
    rangkumanData = [],
    filterStartDate = '',
    filterEndDate = '',
    isMobile = false,
}) {
    const [metricMode, setMetricMode] = useState('omzet'); // 'omzet' | 'qty'
    // Meaningful business filters instead of theme switcher
    const [categoryGroupBy, setCategoryGroupBy] = useState('category'); // 'category' | 'sku'
    const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'affiliate' | 'organic' | 'cod'
    const [regionLevel, setRegionLevel] = useState('province'); // 'province' | 'city'
    const [regionLimit, setRegionLimit] = useState(3); // 3 | 5
    const [openMenu, setOpenMenu] = useState(null); // null | 'catFilter' | 'regionFilter' | 'info'
    const containerRef = useRef(null);

    useEffect(() => {
        if (!openMenu) return;
        function handleOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpenMenu(null);
            }
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [openMenu]);

    // Aggregate raw data based on active date range & business filters
    const rawAggregated = useMemo(() => {
        if (!rangkumanData || rangkumanData.length === 0) return null;

        let totalOmzet = 0;
        let totalQty = 0;
        const groupMap = new Map();
        const locationMap = new Map();

        for (let i = 0; i < rangkumanData.length; i++) {
            const row = rangkumanData[i];
            const dateObj = row.waktuPesananDibuatObj;
            if (!dateObj) continue;

            const dk = row._dateKey;
            if (filterStartDate && dk < filterStartDate) continue;
            if (filterEndDate && dk > filterEndDate) continue;

            const status = (row.statusOrder || '').toLowerCase();
            if (status === 'canceled' || status === 'return' || status === 'pengembalian' || status === 'gagal kirim') {
                continue;
            }

            // Channel filter
            if (channelFilter !== 'all') {
                const isAff = row.ketAffiliasi === 'YA' || row.ketAffiliasi === 'Affiliasi';
                const isCod = (row.metode || '').toLowerCase() === 'bayar di tempat';
                if (channelFilter === 'affiliate' && !isAff) continue;
                if (channelFilter === 'organic' && isAff) continue;
                if (channelFilter === 'cod' && !isCod) continue;
            }

            const settlement = row.totalSettlementAmount || 0;
            const qty = row.totalQuantity || 1;
            if (settlement <= 0 && qty <= 0) continue;

            totalOmzet += settlement;
            totalQty += qty;

            // Location aggregation (Province or City/Regency)
            const rawLoc = regionLevel === 'city'
                ? (row.regencyAndCity || row.province || '').trim()
                : (row.province || '').trim();
            const loc = rawLoc && rawLoc !== 'TIDAK DIKETAHUI' ? rawLoc : 'Lainnya';
            let pObj = locationMap.get(loc);
            if (!pObj) {
                pObj = { name: loc, omzet: 0, orders: 0, pcs: 0 };
                locationMap.set(loc, pObj);
            }
            pObj.omzet += settlement;
            pObj.orders += 1;
            pObj.pcs += qty;

            // Product Category or SKU aggregation
            const lineItems = row.orders;
            if (lineItems && lineItems.length > 0) {
                const portionOmzet = settlement / lineItems.length;
                for (let j = 0; j < lineItems.length; j++) {
                    const item = lineItems[j];
                    const skuRaw = (item['Seller SKU'] || '').toString().trim();
                    const groupName = categoryGroupBy === 'sku'
                        ? (skuRaw || 'Tanpa SKU')
                        : detectProductCategory(item['Product Name'], skuRaw);
                    const qRaw = item['Quantity'];
                    const itemQty = typeof qRaw === 'number' ? qRaw : (parseInt(String(qRaw || '1').replace(/\D/g, ''), 10) || 1);
                    let cObj = groupMap.get(groupName);
                    if (!cObj) {
                        cObj = { name: groupName, omzet: 0, pcs: 0, orders: 0 };
                        groupMap.set(groupName, cObj);
                    }
                    cObj.omzet += portionOmzet;
                    cObj.pcs += itemQty;
                    cObj.orders += 1;
                }
            } else {
                const skuRaw = (row.sellerSku || '').toString().trim();
                const groupName = categoryGroupBy === 'sku'
                    ? (skuRaw || 'Tanpa SKU')
                    : detectProductCategory(row.productName, skuRaw);
                let cObj = groupMap.get(groupName);
                if (!cObj) {
                    cObj = { name: groupName, omzet: 0, pcs: 0, orders: 0 };
                    groupMap.set(groupName, cObj);
                }
                cObj.omzet += settlement;
                cObj.pcs += qty;
                cObj.orders += 1;
            }
        }

        if (totalOmzet <= 0 && totalQty <= 0) return null;

        return {
            totalOmzet: Math.round(totalOmzet),
            totalQty,
            categoryList: Array.from(groupMap.values()),
            locationList: Array.from(locationMap.values()).filter(p => p.name !== 'Lainnya'),
        };
    }, [rangkumanData, filterStartDate, filterEndDate, categoryGroupBy, channelFilter, regionLevel]);

    const viewData = useMemo(() => {
        if (!rawAggregated) return null;
        const sourceCats = rawAggregated.categoryList;
        const sourceLocs = rawAggregated.locationList;

        const totalMetric = metricMode === 'omzet' ? rawAggregated.totalOmzet : rawAggregated.totalQty;

        const sortedCats = [...sourceCats].sort((a, b) =>
            metricMode === 'omzet' ? b.omzet - a.omzet : b.pcs - a.pcs
        );

        const top3 = sortedCats.slice(0, 3);
        const rest = sortedCats.slice(3);
        const chartSlices = top3.map((c, idx) => {
            const val = metricMode === 'omzet' ? Math.round(c.omzet) : c.pcs;
            const pct = totalMetric > 0 ? ((val / totalMetric) * 100).toFixed(1) + '%' : '0%';
            return {
                name: c.name,
                value: val,
                percentage: pct,
                color: BRAND_PALETTE[idx],
            };
        });

        if (rest.length > 0) {
            const restVal = rest.reduce((acc, c) => acc + (metricMode === 'omzet' ? Math.round(c.omzet) : c.pcs), 0);
            if (restVal > 0) {
                const pct = totalMetric > 0 ? ((restVal / totalMetric) * 100).toFixed(1) + '%' : '0%';
                chartSlices.push({
                    name: rest.length === 1 ? rest[0].name : 'Lainnya',
                    value: restVal,
                    percentage: pct,
                    color: BRAND_PALETTE[3],
                });
            }
        }

        const sortedLocs = [...sourceLocs]
            .sort((a, b) => (metricMode === 'omzet' ? b.omzet - a.omzet : b.orders - a.orders))
            .slice(0, regionLimit);

        const maxLocVal = sortedLocs[0]
            ? (metricMode === 'omzet' ? sortedLocs[0].omzet : sortedLocs[0].orders)
            : 1;
        const barScaleMax = maxLocVal * 1.15;

        const regions = sortedLocs.map((p, idx) => {
            const val = metricMode === 'omzet' ? p.omzet : p.orders;
            const progress = Math.min(92, Math.max(16, Math.round((val / barScaleMax) * 100)));
            const sharePct = totalMetric > 0 && metricMode === 'omzet'
                ? ((p.omzet / totalMetric) * 100).toFixed(1) + '%'
                : null;
            return {
                id: p.name,
                rank: idx + 1,
                name: p.name,
                amountDisplay: metricMode === 'omzet'
                    ? formatCompactRupiah(p.omzet)
                    : `${p.orders.toLocaleString('id-ID')} Order`,
                subDisplay: metricMode === 'omzet'
                    ? `${p.orders.toLocaleString('id-ID')} Order · ${p.pcs.toLocaleString('id-ID')} PCS${sharePct ? ` (${sharePct})` : ''}`
                    : `Penerimaan Bersih: ${formatCompactRupiah(p.omzet)} · ${p.pcs.toLocaleString('id-ID')} PCS`,
                progressPct: progress,
                color: BRAND_PALETTE[idx % BRAND_PALETTE.length],
            };
        });

        const centerTotalDisplay = metricMode === 'omzet'
            ? formatCompactRupiah(totalMetric)
            : `${totalMetric.toLocaleString('id-ID')} PCS`;

        return {
            chartSlices,
            displayCategories: chartSlices.slice(0, 3),
            regions,
            centerTotalDisplay,
        };
    }, [rawAggregated, metricMode, regionLimit]);

    const channelLabels = {
        all: 'Semua Pesanan Valid',
        affiliate: 'Khusus Afiliasi',
        organic: 'Khusus Organik',
        cod: 'Khusus COD',
    };

    const hasActiveCatFilter = categoryGroupBy !== 'category' || channelFilter !== 'all';
    const hasActiveRegionFilter = regionLevel !== 'province' || regionLimit !== 3;

    if (!rawAggregated || !viewData) {
        return null;
    }

    const cardSurface = {
        background: '#ffffff',
        borderRadius: isMobile ? '16px' : '20px',
        padding: isMobile ? '0.75rem 0.85rem' : '1.5rem 1.6rem',
        boxShadow: '0 4px 20px -2px rgba(108, 92, 231, 0.05), 0 2px 6px rgba(0,0,0,0.02)',
        border: '1px solid #eef0f6',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
    };

    return (
        <div
            ref={containerRef}
            style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: isMobile ? '0.75rem' : '1.25rem',
                marginBottom: isMobile ? '0.75rem' : '1.5rem',
            }}
        >
            {/* ════════════════════════════════════════════════════════════
                CARD 1: PENJUALAN PER KATEGORI / SKU
                ════════════════════════════════════════════════════════════ */}
            <div style={cardSurface}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: isMobile ? '0.75rem' : '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.65rem', minWidth: 0 }}>
                        <div
                            style={{
                                width: isMobile ? 28 : 34,
                                height: isMobile ? 28 : 34,
                                borderRadius: isMobile ? 8 : 10,
                                background: 'rgba(124, 58, 237, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Layers size={isMobile ? 14 : 16} color="#7c3aed" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ fontSize: isMobile ? '0.9rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Penjualan per {categoryGroupBy === 'sku' ? 'Kode SKU' : 'Kategori'}
                            </h3>
                            <p style={{ fontSize: isMobile ? '0.66rem' : '0.725rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {channelLabels[channelFilter]} · {metricMode === 'omzet' ? 'Penerimaan bersih' : 'Unit terjual'}
                            </p>
                        </div>
                    </div>

                    {/* Right Controls: Omzet/PCS Toggle + Data Filter Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.35rem' : '0.45rem', position: 'relative', flexShrink: 0 }}>
                        <div
                            style={{
                                display: 'flex',
                                background: '#f4f5f9',
                                borderRadius: '9999px',
                                padding: '2px',
                                border: '1px solid #e5e7f0',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setMetricMode('omzet')}
                                style={{
                                    padding: isMobile ? '3px 8px' : '4px 11px',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    fontSize: isMobile ? '0.65rem' : '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: metricMode === 'omzet' ? '#7c3aed' : 'transparent',
                                    color: metricMode === 'omzet' ? '#ffffff' : 'var(--text-secondary)',
                                    transition: 'background 0.15s ease, color 0.15s ease',
                                }}
                            >
                                {isMobile ? 'Bersih' : 'Penerimaan Bersih'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMetricMode('qty')}
                                style={{
                                    padding: isMobile ? '3px 8px' : '4px 11px',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    fontSize: isMobile ? '0.65rem' : '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: metricMode === 'qty' ? '#7c3aed' : 'transparent',
                                    color: metricMode === 'qty' ? '#ffffff' : 'var(--text-secondary)',
                                    transition: 'background 0.15s ease, color 0.15s ease',
                                }}
                            >
                                PCS
                            </button>
                        </div>

                        <button
                            type="button"
                            title="Filter Pengelompokan & Sumber Pesanan"
                            onClick={() => setOpenMenu(openMenu === 'catFilter' ? null : 'catFilter')}
                            style={{
                                width: isMobile ? 28 : 32,
                                height: isMobile ? 28 : 32,
                                borderRadius: '50%',
                                background: hasActiveCatFilter ? 'rgba(124, 58, 237, 0.12)' : '#f4f5f9',
                                border: hasActiveCatFilter ? '1px solid #7c3aed' : '1px solid #e5e7f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: hasActiveCatFilter ? '#7c3aed' : 'var(--text-secondary)',
                            }}
                        >
                            <Filter size={isMobile ? 12 : 14} />
                        </button>

                        {openMenu === 'catFilter' && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '115%',
                                    right: 0,
                                    width: '220px',
                                    background: '#ffffff',
                                    borderRadius: '14px',
                                    padding: '0.55rem',
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                                    border: '1px solid #e5e7f0',
                                    zIndex: 100,
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <div style={{ fontSize: '0.675rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                                    Kelompokkan Berdasarkan
                                </div>
                                {[
                                    { id: 'category', label: 'Kategori Lini Produk' },
                                    { id: 'sku', label: 'Kode SKU Produk' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => { setCategoryGroupBy(opt.id); setOpenMenu(null); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.45rem 0.6rem',
                                            background: categoryGroupBy === opt.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                            border: 'none',
                                            color: categoryGroupBy === opt.id ? '#7c3aed' : 'var(--text-primary)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {categoryGroupBy === opt.id && <Check size={14} color="#7c3aed" />}
                                    </button>
                                ))}

                                <div style={{ height: 1, background: '#eef0f6', margin: '0.4rem 0' }} />

                                <div style={{ fontSize: '0.675rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                                    Filter Tipe Pesanan
                                </div>
                                {[
                                    { id: 'all', label: 'Semua Pesanan Valid' },
                                    { id: 'affiliate', label: 'Khusus Order Afiliasi' },
                                    { id: 'organic', label: 'Khusus Order Organik' },
                                    { id: 'cod', label: 'Khusus Pembayaran COD' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => { setChannelFilter(opt.id); setOpenMenu(null); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.45rem 0.6rem',
                                            background: channelFilter === opt.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                            border: 'none',
                                            color: channelFilter === opt.id ? '#7c3aed' : 'var(--text-primary)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {channelFilter === opt.id && <Check size={14} color="#7c3aed" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Body: Donut Chart + 3 Balanced Category Rows */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: isMobile ? '0.75rem' : '1.5rem',
                        flexDirection: isMobile ? 'column' : 'row',
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: isMobile ? 120 : 164,
                            height: isMobile ? 120 : 164,
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <svg
                            width={isMobile ? 120 : 164}
                            height={isMobile ? 120 : 164}
                            viewBox={isMobile ? '0 0 120 120' : '0 0 164 164'}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        >
                            <circle
                                cx={isMobile ? 60 : 82}
                                cy={isMobile ? 60 : 82}
                                r={isMobile ? 55 : 77}
                                fill="none"
                                stroke="rgba(124, 58, 237, 0.22)"
                                strokeWidth="1.4"
                                strokeDasharray="4 4"
                            />
                        </svg>

                        <ResponsiveContainer width={isMobile ? 110 : 150} height={isMobile ? 110 : 150}>
                            <PieChart>
                                <RechartsTooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload || !payload.length) return null;
                                        const item = payload[0].payload;
                                        return (
                                            <div
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid #e5e7f0',
                                                    borderRadius: '10px',
                                                    padding: '7px 11px',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-primary)',
                                                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                    {metricMode === 'omzet'
                                                        ? formatRupiah(item.value)
                                                        : `${item.value.toLocaleString('id-ID')} PCS`}{' '}
                                                    ({item.percentage})
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Pie
                                    data={viewData.chartSlices}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={isMobile ? 32 : 47}
                                    outerRadius={isMobile ? 48 : 67}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={-270}
                                    isAnimationActive={false}
                                >
                                    {viewData.chartSlices.map((entry, index) => (
                                        <Cell key={`donut-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                width: isMobile ? '68px' : '88px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: isMobile ? '0.58rem' : '0.65rem',
                                    color: 'var(--text-tertiary)',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Total
                            </div>
                            <div
                                style={{
                                    fontSize: isMobile ? '0.75rem' : '0.85rem',
                                    color: 'var(--text-primary)',
                                    fontWeight: 800,
                                    marginTop: '1px',
                                    lineHeight: 1.15,
                                }}
                            >
                                {viewData.centerTotalDisplay}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            flex: isMobile ? 'none' : '1 1 200px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: isMobile ? '0.4rem' : '0.8rem',
                            minWidth: 0,
                            width: '100%',
                        }}
                    >
                        {viewData.displayCategories.map((item, idx) => (
                            <div
                                key={item.name}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingBottom: idx < viewData.displayCategories.length - 1 ? (isMobile ? '0.5rem' : '0.8rem') : 0,
                                    borderBottom:
                                        idx < viewData.displayCategories.length - 1
                                            ? '1px solid #f0f1f7'
                                            : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.65rem', minWidth: 0 }}>
                                    <div
                                        style={{
                                            width: '4px',
                                            height: isMobile ? '24px' : '28px',
                                            borderRadius: '4px',
                                            background: item.color,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                                color: 'var(--text-secondary)',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {item.name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: isMobile ? '0.875rem' : '0.975rem',
                                                color: 'var(--text-primary)',
                                                fontWeight: 800,
                                                letterSpacing: '-0.01em',
                                                marginTop: '1px',
                                            }}
                                        >
                                            {metricMode === 'omzet'
                                                ? formatCompactRupiah(item.value)
                                                : `${item.value.toLocaleString('id-ID')} PCS`}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        background: `${item.color}14`,
                                        borderRadius: '9999px',
                                        padding: isMobile ? '2px 8px' : '4px 11px',
                                        fontSize: isMobile ? '0.675rem' : '0.725rem',
                                        fontWeight: 700,
                                        color: item.color,
                                        flexShrink: 0,
                                        marginLeft: '0.5rem',
                                    }}
                                >
                                    {item.percentage}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                CARD 2: PENDAPATAN PER WILAYAH (Unified with Main Website Theme)
                ════════════════════════════════════════════════════════════ */}
            <div style={cardSurface}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: isMobile ? '0.75rem' : '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.65rem', minWidth: 0 }}>
                        <div
                            style={{
                                width: isMobile ? 28 : 34,
                                height: isMobile ? 28 : 34,
                                borderRadius: isMobile ? 8 : 10,
                                background: 'rgba(6, 182, 212, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <MapPin size={isMobile ? 14 : 16} color="#06b6d4" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <h3 style={{ fontSize: isMobile ? '0.9rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Pendapatan per {regionLevel === 'city' ? 'Kota' : 'Wilayah'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setOpenMenu(openMenu === 'info' ? null : 'info')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: 'var(--text-tertiary)',
                                    }}
                                >
                                    <Info size={13} />
                                </button>
                            </div>
                            <p style={{ fontSize: isMobile ? '0.66rem' : '0.725rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Top {regionLimit} {regionLevel === 'city' ? 'kota/kab' : 'provinsi'} kontributor tertinggi
                            </p>
                        </div>
                    </div>

                    {/* Right Filter Button */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                            type="button"
                            title="Filter Tingkat Wilayah & Jumlah Baris"
                            onClick={() => setOpenMenu(openMenu === 'regionFilter' ? null : 'regionFilter')}
                            style={{
                                width: isMobile ? 28 : 32,
                                height: isMobile ? 28 : 32,
                                borderRadius: '50%',
                                background: hasActiveRegionFilter ? 'rgba(6, 182, 212, 0.12)' : '#f4f5f9',
                                border: hasActiveRegionFilter ? '1px solid #06b6d4' : '1px solid #e5e7f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: hasActiveRegionFilter ? '#06b6d4' : 'var(--text-secondary)',
                            }}
                        >
                            <Filter size={isMobile ? 12 : 14} />
                        </button>

                        {openMenu === 'info' && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '115%',
                                    right: 0,
                                    width: '230px',
                                    background: '#ffffff',
                                    borderRadius: '12px',
                                    padding: '0.65rem 0.8rem',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid #e5e7f0',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 100,
                                }}
                            >
                                Dihitung otomatis dari alamat pengiriman pembeli pada pesanan valid sesuai rentang tanggal aktif.
                            </div>
                        )}

                        {openMenu === 'regionFilter' && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '115%',
                                    right: 0,
                                    width: '215px',
                                    background: '#ffffff',
                                    borderRadius: '14px',
                                    padding: '0.55rem',
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                                    border: '1px solid #e5e7f0',
                                    zIndex: 100,
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <div style={{ fontSize: '0.675rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                                    Tingkat Wilayah
                                </div>
                                {[
                                    { id: 'province', label: 'Per Provinsi' },
                                    { id: 'city', label: 'Per Kota / Kabupaten' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => { setRegionLevel(opt.id); setOpenMenu(null); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.45rem 0.6rem',
                                            background: regionLevel === opt.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                            border: 'none',
                                            color: regionLevel === opt.id ? '#7c3aed' : 'var(--text-primary)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {regionLevel === opt.id && <Check size={14} color="#7c3aed" />}
                                    </button>
                                ))}

                                <div style={{ height: 1, background: '#eef0f6', margin: '0.4rem 0' }} />

                                <div style={{ fontSize: '0.675rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.25rem 0.6rem', textTransform: 'uppercase' }}>
                                    Jumlah Ditampilkan
                                </div>
                                {[
                                    { id: 3, label: 'Top 3 Wilayah' },
                                    { id: 5, label: 'Top 5 Wilayah' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => { setRegionLimit(opt.id); setOpenMenu(null); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.45rem 0.6rem',
                                            background: regionLimit === opt.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                            border: 'none',
                                            color: regionLimit === opt.id ? '#7c3aed' : 'var(--text-primary)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {regionLimit === opt.id && <Check size={14} color="#7c3aed" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Body: Clean Cohesive Region Progress Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.65rem' : '0.95rem', justifyContent: 'center', flex: 1 }}>
                    {viewData.regions.map((item) => (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.25rem' : '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.65rem' }}>
                                    <div
                                        style={{
                                            width: isMobile ? 24 : 28,
                                            height: isMobile ? 24 : 28,
                                            borderRadius: isMobile ? '6px' : '8px',
                                            background: `${item.color}14`,
                                            color: item.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: isMobile ? '0.7rem' : '0.75rem',
                                            fontWeight: 800,
                                            flexShrink: 0,
                                        }}
                                    >
                                        #{item.rank}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: isMobile ? '0.78rem' : '0.85rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                            {item.name}
                                        </div>
                                        <div style={{ fontSize: isMobile ? '0.66rem' : '0.715rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '1px' }}>
                                            {item.subDisplay}
                                        </div>
                                    </div>
                                </div>
                                <span style={{ fontSize: isMobile ? '0.825rem' : '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {item.amountDisplay}
                                </span>
                            </div>

                            <div
                                style={{
                                    width: '100%',
                                    height: isMobile ? '5px' : '7px',
                                    background: '#f1f2f8',
                                    borderRadius: '9999px',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${item.progressPct}%`,
                                        height: '100%',
                                        background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
                                        borderRadius: '9999px',
                                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default DashboardModernCards;
