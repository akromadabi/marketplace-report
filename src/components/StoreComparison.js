import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    CartesianGrid, ResponsiveContainer, ComposedChart, Area, Legend,
} from 'recharts';
import { GitCompare, Store, TrendingUp } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { apiGetOrders, apiGetPayments, apiGetReturns, apiGetModalValues } from '../api';

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899'];

const formatRupiah = (num) => {
    if (typeof num !== 'number' || isNaN(num)) return 'Rp0';
    return 'Rp' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

const tooltipStyle = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
    borderRadius: '0.75rem', boxShadow: 'var(--shadow-lg)', fontSize: '0.75rem',
};

const normalizeStatus = (status) => {
    if (!status) return '';
    const s = status.toString().trim().toLowerCase();
    const map = {
        'perlu dikirim': 'to ship', 'dikirim': 'shipped', 'dibatalkan': 'canceled',
        'selesai': 'completed', 'belum dibayar': 'unpaid', 'pengembalian': 'pengembalian',
        'return': 'return', 'canceled': 'canceled', 'cancelled': 'canceled',
        'shipped': 'shipped', 'completed': 'completed', 'to ship': 'to ship',
        'in transit': 'shipped', 'delivered': 'completed',
    };
    return map[s] || s;
};

const parseIndonesianDateTime = (dateTimeStr) => {
    if (typeof dateTimeStr !== 'string' || !dateTimeStr.trim()) return null;
    const [datePart, timePart = '00:00:00'] = dateTimeStr.trim().split(' ');
    const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);
    if ([hour, minute, second].some(isNaN)) return null;
    if (datePart.includes('-')) {
        const [year, month, day] = datePart.split('-').map(Number);
        if ([day, month, year].some(isNaN)) return null;
        return new Date(year, month - 1, day, hour, minute, second);
    }
    const [day, month, year] = datePart.split('/').map(Number);
    if ([day, month, year].some(isNaN)) return null;
    return new Date(year, month - 1, day, hour, minute, second);
};

function processStoreData(orders, payments, modalValues) {
    // Build payment map
    const payMap = new Map();
    payments.forEach(p => {
        const key = Object.keys(p).find(k => k.toLowerCase().includes('order/adjustment id'));
        const id = key ? p[key] : '';
        if (!id) return;
        if (!payMap.has(id)) payMap.set(id, []);
        payMap.get(id).push(p);
    });

    // Group orders
    const orderMap = new Map();
    orders.forEach(o => {
        const id = o['Order ID'] || '';
        if (!id) return;
        if (!orderMap.has(id)) orderMap.set(id, []);
        orderMap.get(id).push(o);
    });

    let totalOrders = 0, fixTerbeli = 0, cancelCount = 0, totalLaba = 0, totalPCS = 0;

    for (const [orderId, items] of orderMap.entries()) {
        const first = items[0];
        const dateObj = parseIndonesianDateTime(first['Created Time']);
        if (!dateObj) continue;
        totalOrders++;

        let statusOrder = normalizeStatus(first['Order Status']);
        let qty = 0, modal = 0;
        items.forEach(o => {
            const q = parseInt(String(o['Quantity'] || 0).replace(/\D/g, ''), 10) || 0;
            qty += q;
            const sku = (o['Seller SKU'] || '').toString().trim();
            const skuId = (o['SKU ID'] || '').toString().trim();
            const variation = (o['Variation'] || '').toString().trim();
            const fullKey = `${sku}||${skuId}||${variation}`;
            const mv = modalValues[fullKey] || modalValues[sku] || '0';
            modal += (parseInt(String(mv).replace(/[^0-9]/g, ''), 10) || 0) * q;
        });
        totalPCS += qty;

        if (statusOrder === 'completed') {
            fixTerbeli++;
            const pays = payMap.get(orderId) || [];
            let settlement = 0;
            pays.forEach(p => {
                const tsa = parseFloat(p['Total settlement amount']);
                if (!isNaN(tsa)) settlement += tsa;
            });
            totalLaba += settlement - modal;
        } else if (statusOrder === 'canceled') {
            cancelCount++;
        }
    }

    return { totalOrders, fixTerbeli, cancelCount, totalLaba, totalPCS };
}

function StoreComparison() {
    const { stores } = useStore();
    const [selectedIds, setSelectedIds] = useState([]);
    const [storeData, setStoreData] = useState({});
    const [loading, setLoading] = useState(false);

    const toggleStore = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        const fetchAll = async () => {
            const results = {};
            for (const storeId of selectedIds) {
                try {
                    const [orders, payments, modalRaw] = await Promise.all([
                        apiGetOrders(storeId),
                        apiGetPayments(storeId),
                        apiGetModalValues(storeId),
                    ]);
                    const summary = processStoreData(orders, payments, modalRaw);
                    results[storeId] = summary;
                } catch (err) {
                    results[storeId] = { totalOrders: 0, fixTerbeli: 0, cancelCount: 0, totalLaba: 0, totalPCS: 0 };
                }
            }
            setStoreData(results);
            setLoading(false);
        };
        fetchAll();
    }, [selectedIds]);

    const selectedStores = stores.filter(s => selectedIds.includes(s.id));

    const comparisonBarData = useMemo(() => {
        if (selectedStores.length === 0) return [];
        const metrics = [
            { key: 'totalOrders', label: 'Total Pesanan' },
            { key: 'fixTerbeli', label: 'Fix Terbeli' },
            { key: 'cancelCount', label: 'Cancel' },
            { key: 'totalPCS', label: 'Total PCS' },
        ];
        return metrics.map(m => {
            const row = { metric: m.label };
            selectedStores.forEach((s, i) => {
                row[s.name] = storeData[s.id]?.[m.key] || 0;
            });
            return row;
        });
    }, [selectedStores, storeData]);

    const labaBarData = useMemo(() => {
        return selectedStores.map((s, i) => ({
            name: s.name,
            laba: storeData[s.id]?.totalLaba || 0,
            fill: COLORS[i % COLORS.length],
        }));
    }, [selectedStores, storeData]);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <GitCompare size={24} color="var(--accent-primary)" />
                <div>
                    <h2 className="gradient-text" style={{ margin: 0 }}>Perbandingan Toko</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Bandingkan performa antar toko marketplace Anda</p>
                </div>
            </div>

            {/* Store Selection */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Pilih toko untuk dibandingkan:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {stores.map((s, i) => {
                        const isSelected = selectedIds.includes(s.id);
                        return (
                            <button
                                key={s.id}
                                onClick={() => toggleStore(s.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.5rem 1rem', border: isSelected ? '2px solid ' + COLORS[i % COLORS.length] : '1px solid var(--border-medium)',
                                    borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                    background: isSelected ? COLORS[i % COLORS.length] + '15' : 'var(--bg-secondary)',
                                    color: isSelected ? COLORS[i % COLORS.length] : 'var(--text-secondary)',
                                    fontSize: '0.8125rem', fontWeight: 600, transition: 'all var(--transition-fast)',
                                }}
                            >
                                <Store size={14} /> {s.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading && (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <div className="spinner" style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem' }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Memuat data perbandingan...</span>
                </div>
            )}

            {!loading && selectedStores.length >= 2 && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedStores.length}, 1fr)`, gap: '1rem', marginBottom: '1.5rem' }}>
                        {selectedStores.map((store, i) => {
                            const data = storeData[store.id] || {};
                            return (
                                <div key={store.id} className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: COLORS[i % COLORS.length] }} />
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: COLORS[i % COLORS.length], marginBottom: '1rem' }}>{store.name}</h3>
                                    <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Total Pesanan</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{data.totalOrders || 0}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Fix Terbeli</span>
                                            <span style={{ fontWeight: 700, color: '#10b981' }}>{data.fixTerbeli || 0}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Cancel</span>
                                            <span style={{ fontWeight: 700, color: '#ef4444' }}>{data.cancelCount || 0}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Total PCS</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{data.totalPCS || 0}</span>
                                        </div>
                                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Laba Bersih</span>
                                            <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.9375rem' }}>{formatRupiah(data.totalLaba || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
                        {/* Comparison Bar Chart */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Perbandingan Metrik</h3>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparisonBarData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                        <XAxis type="number" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} />
                                        <YAxis dataKey="metric" type="category" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} width={90} />
                                        <RechartsTooltip contentStyle={tooltipStyle} />
                                        {selectedStores.map((s, i) => (
                                            <Bar key={s.id} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} barSize={10} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Laba Comparison */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                                <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                Laba Bersih per Toko
                            </h3>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={labaBarData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                        <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }} axisLine={false} tickLine={false}
                                            tickFormatter={v => v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v} />
                                        <RechartsTooltip contentStyle={tooltipStyle} formatter={(v) => [formatRupiah(v), 'Laba Bersih']} />
                                        <Bar dataKey="laba" radius={[6, 6, 0, 0]} barSize={40}>
                                            {labaBarData.map((entry, idx) => (
                                                <Bar key={idx} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!loading && selectedStores.length < 2 && selectedStores.length > 0 && (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Pilih minimal 2 toko untuk membandingkan</p>
                </div>
            )}

            {!loading && selectedStores.length === 0 && (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <GitCompare size={48} color="var(--text-tertiary)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Pilih Toko</h3>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Klik tombol toko di atas untuk memulai perbandingan</p>
                </div>
            )}
        </div>
    );
}

export default StoreComparison;
