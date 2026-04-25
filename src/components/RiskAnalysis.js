import React, { useMemo, useState } from "react";
import { ShieldAlert, AlertTriangle, UserX, MapPin, XCircle, ChevronRight, X, TrendingUp, AlertCircle, BarChart2, Users, Copy, Check, Loader2 } from 'lucide-react';
import { useDataCache } from '../contexts/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import RangkumanTransaksi from './RangkumanTransaksi';

function extractRiskInfo(alamat) {
    if (!alamat) return { name: 'Unknown', city: 'UNKNOWN' };
    const parts = alamat.split(',');
    let name = (parts[0] || '').trim();

    if (name.replace(/[^0-9]/g, '').length > 6 && parts.length > 1) name = parts[1].trim();
    if (name.length > 25) name = name.substring(0, 25) + '...';

    let city = 'UNKNOWN';
    const cityMatch = alamat.match(/(KOTA|KAB\.|KABUPATEN)\s[A-Za-z\s-]+/i);
    if (cityMatch) {
        city = cityMatch[0].trim().toUpperCase();
    } else if (parts.length >= 4) {
        let potentialCity = parts[parts.length - 3].trim().toUpperCase();
        if (potentialCity.length > 3) city = potentialCity;
    }

    return { name, city };
}

export default function RiskAnalysis() {
    const { getComputed } = useDataCache();
    const [selectedUser, setSelectedUser] = useState(null);
    const [viewMode, setViewMode] = useState('city'); // 'city' or 'user'
    const [sortBy, setSortBy] = useState('fail'); // 'fail', 'percent', 'rugi'
    const [copiedId, setCopiedId] = useState(null);

    const effectiveTableData = getComputed('LATEST_RANGKUMAN');
    const isDataReady = !!effectiveTableData && effectiveTableData.length > 0;

    const { cityStats, userStats, totalRugi } = useMemo(() => {
        const cStats = {};
        const uStats = {};
        let tRugi = 0;

        if (!effectiveTableData || !isDataReady) return { cityStats: [], userStats: [], totalRugi: 0 };

        effectiveTableData.forEach(row => {
            const status = (row['STATUS ORDER'] || '').toLowerCase();
            const kerugianStr = (row['Kerugian'] || '').toString();

            let isReturn = status === 'return';
            let isGagalKirim = status === 'gagal kirim';
            let isCancel = ['canceled', 'cancelled', 'cancel'].includes(status);
            let isFail = isReturn || isGagalKirim || isCancel;
            let isSucc = status.includes('selesai') || status === 'completed' || status === 'terkirim';

            if (row['TERKIRIM'] === 'Terkirim') isSucc = true;

            let rugi = 0;
            if (kerugianStr.includes('Rp')) {
                rugi = parseFloat(kerugianStr.replace(/[^0-9]/g, '')) || 0;
                tRugi += rugi;
            }

            const orderId = row['ORDER ID'] || '-';
            const alamatText = row['ALAMAT'] || '';
            const { name, city } = extractRiskInfo(alamatText);

            if (!cStats[city]) cStats[city] = { city, total: 0, fail: 0, succ: 0, rugi: 0, users: new Set(), history: [] };
            if (!uStats[name]) uStats[name] = { name, city, total: 0, fail: 0, succ: 0, rugi: 0, history: [] };

            cStats[city].total++;
            uStats[name].total++;
            cStats[city].users.add(name);
            uStats[name].history.push({ 'ORDER ID': orderId, 'STATUS ORDER': row['STATUS ORDER'], 'Kerugian': kerugianStr, 'Pembeli': name });
            cStats[city].history.push({ 'ORDER ID': orderId, 'STATUS ORDER': row['STATUS ORDER'], 'Kerugian': kerugianStr, 'Pembeli': name });

            if (isFail) {
                cStats[city].fail++;
                cStats[city].rugi += rugi;
                uStats[name].fail++;
                uStats[name].rugi += rugi;
            } else if (isSucc) {
                cStats[city].succ++;
                uStats[name].succ++;
            }
        });

        const cArray = Object.values(cStats).map(c => ({
            ...c,
            failRate: c.total >= 3 ? (c.fail / c.total) * 100 : 0, // require minimum 3 orders to calculate valid rate
        })).filter(c => c.fail > 0);

        const uArray = Object.values(uStats).map(u => ({
            ...u,
            failRate: u.total >= 2 ? (u.fail / u.total) * 100 : 0,
        })).filter(u => u.fail > 0);

        return { cityStats: cArray, userStats: uArray, totalRugi: tRugi };
    }, [effectiveTableData, isDataReady]);

    const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

    if (!isDataReady) {
        return (
            <div style={{ padding: '8rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {/* HEADLESS PROXY: Render RangkumanTransaksi in the background without UI to trigger calculate & cache */}
                <span style={{ display: 'none' }}><RangkumanTransaksi isHidden={true} /></span>
                <Loader2 size={48} className="lucide-spin" style={{ color: '#7c3aed', margin: '0 auto 1rem', animation: 'spin 2s linear infinite' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Otomatisasi Komputasi...</h3>
                <p style={{ maxWidth: '500px', margin: '0 auto' }}>Sedang melakukan pra-komputasi laporan Harga Pokok Penjualan (HPP) dan Biaya Platform sesuai pengaturan simulasi terbaru. Mohon tunggu sejenak.</p>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Sort Data Dynamically
    const sortedCityStats = [...cityStats].sort((a, b) => sortBy === 'percent' ? b.failRate - a.failRate : (sortBy === 'rugi' ? b.rugi - a.rugi : b.fail - a.fail));
    const sortedUserStats = [...userStats].sort((a, b) => sortBy === 'percent' ? b.failRate - a.failRate : (sortBy === 'rugi' ? b.rugi - a.rugi : b.fail - a.fail));

    const topCity = sortedCityStats[0];
    const topUser = sortedUserStats[0];

    // AI Insight Engine
    let aiInsight = [];
    if (topCity && topCity.fail > 10 && topCity.failRate > 20) {
        aiInsight.push(`🚨 Wilayah ${topCity.city} memiliki tingkat retur yang mengkhawatirkan dengan ${topCity.fail} paket bermasalah (${topCity.failRate.toFixed(1)}%). Pertimbangkan meninjau ulang kurir di area ini.`);
    }
    if (topUser && topUser.fail >= 3) {
        aiInsight.push(`👀 Pembeli '${topUser.name}' dari ${topUser.city} murni merugikan dengan ${topUser.fail} kali penolakan senilai ${formatRupiah(topUser.rugi)}.`);
    }
    if (totalRugi > 500000) {
        aiInsight.push(`💸 Eksposur kerugian ongkir dari seluruh data mencapai ${formatRupiah(totalRugi)}.`);
    }
    if (aiInsight.length === 0) aiInsight.push(`✅ Saat ini data terlihat stabil. Lanjutkan pemantauan risiko pengiriman.`);

    const currentData = viewMode === 'city' ? sortedCityStats : sortedUserStats;
    const chartData = currentData.slice(0, 15).map(item => ({
        name: viewMode === 'city' ? item.city.replace(/KAB\.|KOTA|KABUPATEN/ig, '').trim() : item.name,
        Nilai: sortBy === 'percent' ? parseFloat(item.failRate.toFixed(1)) : (sortBy === 'rugi' ? item.rugi : item.fail),
        LabelNilai: sortBy === 'percent' ? `${item.failRate.toFixed(1)}%` : (sortBy === 'rugi' ? formatRupiah(item.rugi) : item.fail.toString()),
        Raw: item
    }));
    const maxNilai = Math.max(...chartData.map(d => d.Nilai), 1);

    const ModalTopUser = () => {
        if (!selectedUser) return null;
        return (
            <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-medium)', paddingBottom: '0.75rem' }}>
                        <div>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.125rem', fontWeight: 700 }}>Detail Riwayat</h3>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{selectedUser.name || selectedUser.city} {selectedUser.name ? `— ${selectedUser.city}` : ''}</p>
                        </div>
                        <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div className="card" style={{ flex: 1, padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Pesan</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedUser.total}</div>
                        </div>
                        <div className="card" style={{ flex: 1, padding: '0.75rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                            <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Gagal/Retur</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ef4444' }}>{selectedUser.fail}</div>
                        </div>
                        <div className="card" style={{ flex: 1, padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kerugian</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>{formatRupiah(selectedUser.rugi)}</div>
                        </div>
                    </div>
                    <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                                <th style={{ padding: '0.5rem 0' }}>Order ID (Klik untuk Salin)</th>
                                {selectedUser.city && !selectedUser.name && <th style={{ padding: '0.5rem 0' }}>Pembeli</th>}
                                <th style={{ padding: '0.5rem 0' }}>Status</th>
                                <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Kerugian</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedUser.history.map((h, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {h['ORDER ID']}
                                            <button
                                                title="Salin Order ID"
                                                onClick={() => {
                                                    const textToCopy = h['ORDER ID'];
                                                    if (navigator.clipboard && window.isSecureContext) {
                                                        navigator.clipboard.writeText(textToCopy);
                                                    } else {
                                                        const textArea = document.createElement("textarea");
                                                        textArea.value = textToCopy;
                                                        textArea.style.position = "fixed";
                                                        textArea.style.left = "-999999px";
                                                        textArea.style.top = "-999999px";
                                                        document.body.appendChild(textArea);
                                                        textArea.focus();
                                                        textArea.select();
                                                        try { document.execCommand('copy'); } catch (err) { }
                                                        textArea.remove();
                                                    }
                                                    setCopiedId(textToCopy);
                                                    setTimeout(() => setCopiedId(null), 2000);
                                                }}
                                                style={{ background: copiedId === h['ORDER ID'] ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-active)', color: copiedId === h['ORDER ID'] ? '#10b981' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                            >
                                                {copiedId === h['ORDER ID'] ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    {selectedUser.city && !selectedUser.name && <td style={{ padding: '0.5rem 0' }}>{h['Pembeli']}</td>}
                                    <td style={{ padding: '0.5rem 0', color: ['return', 'gagal kirim', 'canceled', 'cancelled'].includes((h['STATUS ORDER'] || '').toLowerCase()) ? '#ef4444' : '#10b981' }}>{h['STATUS ORDER']}</td>
                                    <td style={{ padding: '0.5rem 0', textAlign: 'right', color: h['Kerugian'] && h['Kerugian'].includes('Rp') ? '#f59e0b' : 'inherit' }}>{h['Kerugian'] || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    };

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '1rem' }}>
                <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldAlert size={26} style={{ color: '#ef4444' }} /> Wawasan Analisis Risiko
                </h2>
                <p>Mendeteksi anomali pengiriman, area bermasalah, dan pembeli fiktif.</p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <TrendingUp size={16} /> Sistem Insight Otomatis
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {aiInsight.map((ins, i) => (
                        <div key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', background: 'var(--bg-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b' }}>{ins}</div>
                    ))}
                </div>
            </div>

            {/* Controller Bar for Dynamic Sorting */}
            <div className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-active)', padding: '0.375rem', borderRadius: 'var(--radius-md)' }}>
                    <button style={{ padding: '0.5rem 1rem', background: viewMode === 'city' ? 'var(--bg-card)' : 'transparent', color: viewMode === 'city' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', boxShadow: viewMode === 'city' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }} onClick={() => setViewMode('city')}>
                        <MapPin size={16} /> Area / Wilayah
                    </button>
                    <button style={{ padding: '0.5rem 1rem', background: viewMode === 'user' ? 'var(--bg-card)' : 'transparent', color: viewMode === 'user' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', boxShadow: viewMode === 'user' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }} onClick={() => setViewMode('user')}>
                        <Users size={16} /> Pembeli Potensial
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Urutkan Berdasarkan:</span>
                    <select className="modern-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontWeight: 600 }}>
                        <option value="fail">Jumlah Gagal / Retur Terbanyak</option>
                        <option value="percent">Persentase Retur Tertinggi</option>
                        <option value="rugi">Eksposur Kerugian Terbesar</option>
                    </select>
                </div>
            </div>

            {/* Interactive Dynamic Layout: Horizontal Bar vs Table */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

                {/* Visual Chart - Top 15 Horizontal Bar */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart2 size={18} style={{ color: '#38bdf8' }} /> Top 15 {viewMode === 'city' ? 'Wilayah' : 'Pembeli'} ({sortBy === 'percent' ? 'Persentase' : (sortBy === 'rugi' ? 'Kerugian' : 'Volume')})
                    </h3>
                    <div style={{ flex: 1, minHeight: '400px' }}>
                        <ResponsiveContainer width="100%" height={chartData.length * 35 + 20}>
                            <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 60, left: 20, bottom: 0 }}>
                                <XAxis type="number" hide domain={[0, maxNilai * 1.1]} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'var(--bg-active)' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload.Raw;
                                            return (
                                                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{data.name || data.city}</div>
                                                    <div>Gagal: <span style={{ color: '#ef4444', fontWeight: 600 }}>{data.fail}</span> / Total: <span style={{ fontWeight: 600 }}>{data.total}</span></div>
                                                    <div>Persentase: <span style={{ fontWeight: 600, color: data.failRate > 20 ? '#ef4444' : 'inherit' }}>{data.failRate.toFixed(1)}%</span></div>
                                                    <div>Kerugian: <span style={{ fontWeight: 600, color: '#f59e0b' }}>{formatRupiah(data.rugi)}</span></div>
                                                    <div style={{ marginTop: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>Klik area bar untuk melihat detail pesanan</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="Nilai"
                                    fill={sortBy === 'percent' ? '#38bdf8' : (sortBy === 'rugi' ? '#f59e0b' : '#ef4444')}
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                    onClick={(data) => setSelectedUser(data.Raw)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <LabelList dataKey="LabelNilai" position="right" style={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data Table */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <XCircle size={18} style={{ color: '#ef4444' }} /> Rincian Data {viewMode === 'city' ? 'Wilayah' : 'Pembeli'}
                    </h3>
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Peringkat</th>
                                    <th>{viewMode === 'city' ? 'Wilayah' : 'Nama & Alamat'}</th>
                                    <th>Gagal / Sukses</th>
                                    <th>Persentase</th>
                                    <th>Kerugian</th>
                                    <th>Opsi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.slice(0, 30).map((row, i) => (
                                    <tr key={i} style={{ background: i < 3 ? (sortBy === 'percent' ? 'rgba(56, 189, 248, 0.05)' : 'rgba(239, 68, 68, 0.03)') : 'transparent' }}>
                                        <td style={{ fontWeight: 700, color: i < 3 ? (sortBy === 'percent' ? '#38bdf8' : '#ef4444') : 'var(--text-secondary)' }}>#{i + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{viewMode === 'city' ? row.city : row.name}</div>
                                            {viewMode === 'user' && <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{row.city}</div>}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem' }}>
                                            <span style={{ fontWeight: 600, color: '#ef4444' }}>{row.fail}</span> <span style={{ color: 'var(--text-tertiary)' }}>/</span> <span style={{ color: '#10b981' }}>{row.succ}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: row.failRate > 15 ? '#ef4444' : 'var(--text-primary)', padding: '0.25rem 0.5rem', background: row.failRate > 15 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-active)', borderRadius: 'var(--radius-sm)' }}>
                                                {row.failRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.8125rem' }}>{formatRupiah(row.rugi)}</td>
                                        <td>
                                            <button onClick={() => setSelectedUser(row)} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: 'none', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', fontWeight: 600 }}>
                                                Detail <ChevronRight size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ModalTopUser />
        </div>
    );
}
