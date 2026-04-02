import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useProcessedOrders, formatDateKey } from '../hooks/useProcessedOrders';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
    ComposedChart, Area, Legend,
} from 'recharts';
import {
    ShoppingBag, XCircle, CheckCircle, Wallet,
    TrendingUp, RotateCcw, Banknote,
    ArrowUpRight, Package, Calendar, ChevronLeft, ChevronRight,
    HourglassIcon, Handshake, Truck, Clock, Landmark,
} from 'lucide-react';

function formatRupiah(number) {
    if (typeof number !== 'number' || isNaN(number)) return 'Rp0';
    return 'Rp' + number.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}
function formatCompact(number) {
    if (typeof number !== 'number' || isNaN(number)) return '0';
    if (number >= 1000000) return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (number >= 1000) return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return number.toLocaleString('id-ID');
}

const CHART_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

// Group raw payment method into categories
function groupPaymentMethod(raw) {
    const m = (raw || '').toString().trim().toLowerCase();
    if (!m) return 'Tidak Diketahui';
    if (m === 'bayar di tempat' || m === 'cash') return 'COD';
    if (m === 'transfer bank') return 'Transfer Bank';
    if (m.includes('tiktok shop balance')) return 'TikTok Balance';
    if (m === 'qris') return 'QRIS';
    if (m.includes('kartu kredit') || m.includes('kartu debit')) return 'Kartu Kredit/Debit';
    if (m.includes('paylater') || m.includes('bri ceria')) return 'PayLater';
    if (['dana', 'gopay', 'ovo', 'linkaja', 'saldo', 'jakone pay', 'jenius pay', 'klikbca'].some(w => m.includes(w))) return 'E-Wallet';
    if (m.includes('gopay later')) return 'PayLater';
    return raw.toString().trim();
}

// Custom tooltip for pie charts showing value + percentage
function PieTooltipContent({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const entry = payload[0];
    const total = entry.payload && entry.payload.total ? entry.payload.total : 0;
    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
    return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            <div style={{ fontWeight: 600 }}>{entry.name}</div>
            <div>{entry.value.toLocaleString('id-ID')} ({pct}%)</div>
        </div>
    );
}

function Dashboard() {
    const { rangkumanData, loading } = useProcessedOrders();

    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false);
        }
        if (showDatePicker) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDatePicker]);

    // Filter rangkumanData by date range, then aggregate for dashboard
    const processedData = useMemo(() => {
        const sums = {
            pesananOrder: 0, pesananPCS: 0, cancelOrder: 0, cancelPCS: 0,
            fixTerbeliOrder: 0, fixTerbeliPCS: 0, terkirimOrder: 0, terkirimPCS: 0,
            akanDikirimOrder: 0, akanDikirimPCS: 0,
            sudahCairOrder: 0, sudahCairPCS: 0, belumCairOrder: 0, belumCairPCS: 0,
            labaKotor: 0, labaBersih: 0, pengembalianOrder: 0, returnOrder: 0,
            affiliasiNominal: 0, affiliasiCount: 0, codJumlah: 0,
            estimasiAsetDiJalan: 0,
        };
        const dailyMap = new Map();
        const monthlyMap = new Map();
        const productMap = new Map();
        const paymentMethodMap = new Map();
        let affiliateYes = 0, affiliateNo = 0;

        rangkumanData.forEach(row => {
            const dateObj = row.waktuPesananDibuat;
            if (!dateObj) return;

            // Date filter
            const dk = formatDateKey(dateObj);
            if (filterStartDate && dk < filterStartDate) return;
            if (filterEndDate && dk > filterEndDate) return;

            const statusOrder = row.statusOrder.toLowerCase();
            const totalQuantity = row.totalQuantity || 0;
            const totalSettlement = row.totalSettlementAmount || 0;
            const totalAffiliate = row.totalAffiliateCommission || 0;
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

            // Omzet: hanya order valid (bukan cancel/return/pengembalian) dan sudah cair
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                sums.labaKotor += totalSettlement;
            }

            // Laba Bersih = settlement - modal, excluding cancel/return/pengembalian, only sudah cair
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                sums.labaBersih += (totalSettlement - totalModal);
            }

            if (statusOrder === 'pengembalian') sums.pengembalianOrder++;
            if (statusOrder === 'return') sums.returnOrder++;
            sums.affiliasiNominal += totalAffiliate;
            if (totalAffiliate > 0) sums.affiliasiCount++;
            if (paymentMethod === 'bayar di tempat') sums.codJumlah++;

            // Estimasi aset di jalan: modal for orders still in transit (shipped/to ship) with no settlement
            if (['shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) {
                sums.estimasiAsetDiJalan += totalModal;
            }

            // Payment method aggregation (grouped)
            const methodGroup = groupPaymentMethod(row.metode);
            paymentMethodMap.set(methodGroup, (paymentMethodMap.get(methodGroup) || 0) + 1);

            // Affiliate aggregation — use ketAffiliasi from rangkumanData
            const ketAff = (row.ketAffiliasi || 'Tidak').toString().trim();
            if (ketAff === 'YA' || ketAff === 'Affiliasi') affiliateYes++; else affiliateNo++;

            // Monthly aggregation
            const mk = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!monthlyMap.has(mk)) monthlyMap.set(mk, {
                date: mk, labaKotor: 0, labaBersih: 0, pesanan: 0, pcs: 0,
                fixTerbeli: 0, cancel: 0, returnOrder: 0, pengembalian: 0,
                sudahCair: 0, belumCair: 0,
            });
            const mo = monthlyMap.get(mk);
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                mo.labaKotor += totalSettlement;
            }
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                mo.labaBersih += (totalSettlement - totalModal);
            }
            mo.pesanan++;
            mo.pcs += totalQuantity;
            if (['completed', 'shipped', 'to ship'].includes(statusOrder)) mo.fixTerbeli += totalQuantity;
            if (statusOrder === 'canceled') mo.cancel++;
            if (statusOrder === 'return') mo.returnOrder++;
            if (statusOrder === 'pengembalian') mo.pengembalian++;
            if (totalSettlement > 0) mo.sudahCair++;
            if (['completed', 'shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) mo.belumCair++;

            // Daily aggregation
            if (!dailyMap.has(dk)) dailyMap.set(dk, {
                date: dk, labaKotor: 0, labaBersih: 0, pesanan: 0, pcs: 0,
                fixTerbeli: 0, cancel: 0, returnOrder: 0, pengembalian: 0,
                sudahCair: 0, belumCair: 0,
            });
            const d = dailyMap.get(dk);
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                d.labaKotor += totalSettlement;
            }
            if (!['canceled', 'return', 'pengembalian'].includes(statusOrder) && totalSettlement > 0) {
                d.labaBersih += (totalSettlement - totalModal);
            }
            d.pesanan++;
            d.pcs += totalQuantity;
            if (['completed', 'shipped', 'to ship'].includes(statusOrder)) d.fixTerbeli += totalQuantity;
            if (statusOrder === 'canceled') d.cancel++;
            if (statusOrder === 'return') d.returnOrder++;
            if (statusOrder === 'pengembalian') d.pengembalian++;
            if (totalSettlement > 0) d.sudahCair++;
            if (['completed', 'shipped', 'to ship'].includes(statusOrder) && totalSettlement <= 0) d.belumCair++;

            // Product aggregation
            if (row.orders) {
                row.orders.forEach(o => {
                    const pName = (o['Product Name'] || '').toString().trim();
                    if (!pName) return;
                    const qRaw = o['Quantity'];
                    const qty = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
                    if (!productMap.has(pName)) productMap.set(pName, { name: pName, qty: 0, revenue: 0 });
                    const p = productMap.get(pName);
                    p.qty += isNaN(qty) ? 0 : qty;
                    p.revenue += totalSettlement / row.orders.length;
                });
            }
        });

        const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

        const paymentMethodDist = Array.from(paymentMethodMap.entries())
            .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
            .sort((a, b) => b.value - a.value);
        const pmTotal = paymentMethodDist.reduce((s, x) => s + x.value, 0);
        paymentMethodDist.forEach(d => { d.total = pmTotal; d.name = d.label; });

        const affiliateDist = [];
        const affTotal = affiliateYes + affiliateNo;
        if (affiliateYes > 0) affiliateDist.push({ label: 'Affiliasi', name: 'Affiliasi', value: affiliateYes, color: '#a78bfa', total: affTotal });
        if (affiliateNo > 0) affiliateDist.push({ label: 'Non-Affiliasi', name: 'Non-Affiliasi', value: affiliateNo, color: '#64748b', total: affTotal });

        return { sums, dailyData, monthlyData, topProducts, paymentMethodDist, affiliateDist };
    }, [rangkumanData, filterStartDate, filterEndDate]);

    const { sums, dailyData, monthlyData, topProducts, paymentMethodDist, affiliateDist } = processedData;

    // Use monthly grouping when no date filter is active
    const isMonthly = !filterStartDate && !filterEndDate;
    const chartData = isMonthly ? monthlyData : dailyData;
    const periodLabel = isMonthly ? 'Bulanan' : 'Harian';

    const statusDistribution = useMemo(() => {
        const data = [];
        const total = sums.fixTerbeliOrder + sums.cancelOrder + sums.pengembalianOrder + sums.returnOrder;
        const items = [
            { value: sums.fixTerbeliOrder, label: 'Terjual', color: CHART_COLORS[2] },
            { value: sums.cancelOrder, label: 'Cancel', color: CHART_COLORS[4] },
            { value: sums.pengembalianOrder, label: 'Pengembalian', color: CHART_COLORS[5] },
            { value: sums.returnOrder, label: 'Retur', color: CHART_COLORS[0] },
        ];
        items.forEach(it => { if (it.value > 0) data.push({ ...it, name: it.label, total, pct: total > 0 ? ((it.value / total) * 100).toFixed(1) : '0' }); });
        return data;
    }, [sums]);

    const formatDateDisplay = () => {
        if (!filterStartDate && !filterEndDate) return 'Semua Tanggal';
        const fmt = (d) => {
            if (!d) return '';
            const [y, m, day] = d.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
        };
        if (filterStartDate && filterEndDate) return `${fmt(filterStartDate)} — ${fmt(filterEndDate)}`;
        if (filterStartDate) return `Dari ${fmt(filterStartDate)}`;
        return `Sampai ${fmt(filterEndDate)}`;
    };

    // Loading
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem' }} />
                <span style={{ fontSize: '0.875rem' }}>Memuat data...</span>
            </div>
        );
    }
    // Empty
    if (rangkumanData.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <Package size={64} strokeWidth={1.5} style={{ margin: '0 auto 1.5rem', color: 'var(--text-tertiary)' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Belum Ada Data</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '24rem', margin: '0 auto' }}>Upload file Excel terlebih dahulu untuk melihat dashboard.</p>
            </div>
        );
    }

    const tooltipStyle = {
        background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
        borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.8125rem',
    };

    const primaryCards = [
        { label: 'Total Pesanan', value: sums.pesananOrder, sub: `${sums.pesananPCS} PCS`, icon: ShoppingBag, gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#7c3aed' },
        { label: 'Terjual', value: sums.fixTerbeliOrder, sub: `${sums.fixTerbeliPCS} PCS`, icon: CheckCircle, gradient: 'linear-gradient(135deg, #10b981, #34d399)', color: '#10b981' },
        { label: 'Laba Kotor', value: formatRupiah(sums.labaBersih), sub: `Omzet: ${formatRupiah(sums.labaKotor)}`, icon: Wallet, gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#f59e0b', isMoney: true },
        { label: 'Total Nilai Aset', value: formatRupiah(sums.labaBersih + sums.estimasiAsetDiJalan), sub: `Aset di Jalan: ${formatRupiah(sums.estimasiAsetDiJalan)}`, icon: Landmark, gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)', color: '#06b6d4', isMoney: true },
    ];

    const secondaryCards = [
        { label: 'Sudah Cair', value: sums.sudahCairOrder, sub: `${sums.sudahCairPCS} PCS`, icon: Wallet, color: '#10b981' },
        { label: 'Belum Cair', value: sums.belumCairOrder, sub: `${sums.belumCairPCS} PCS`, icon: HourglassIcon, color: '#f59e0b' },
        { label: 'Cancel', value: sums.cancelOrder, sub: `${sums.cancelPCS} PCS`, icon: XCircle, color: '#ef4444' },
        { label: 'Terkirim', value: sums.terkirimOrder, sub: `${sums.terkirimPCS} PCS`, icon: Truck, color: '#06b6d4' },
        { label: 'Akan Dikirim', value: sums.akanDikirimOrder, sub: `${sums.akanDikirimPCS} PCS`, icon: Clock, color: '#8b5cf6' },
        { label: 'Retur', value: sums.returnOrder, sub: null, icon: RotateCcw, color: '#7c3aed' },
        { label: 'Pengembalian', value: sums.pengembalianOrder, sub: null, icon: RotateCcw, color: '#ec4899' },
        { label: 'Affiliasi', value: formatRupiah(sums.affiliasiNominal), sub: `${sums.affiliasiCount} order`, icon: Handshake, color: '#a78bfa' },
        { label: 'COD', value: sums.codJumlah, sub: `${sums.pesananOrder > 0 ? ((sums.codJumlah / sums.pesananOrder) * 100).toFixed(1) : 0}%`, icon: Banknote, color: '#f97316' },
    ];

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: isMobile ? '0.5rem' : '1rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ margin: 0, fontSize: isMobile ? '1.125rem' : undefined }}>Dashboard</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '0.6875rem' : '0.875rem', margin: '0.125rem 0 0' }}>Ringkasan transaksi marketplace Anda</p>
                </div>
                <div style={{ position: 'relative' }} ref={datePickerRef}>
                    <button onClick={() => setShowDatePicker(!showDatePicker)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem', padding: isMobile ? '0.4rem 0.75rem' : '0.625rem 1rem',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: isMobile ? '0.6875rem' : '0.8125rem',
                        fontWeight: 600, color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)',
                        transition: 'all var(--transition-fast)',
                    }}>
                        <Calendar size={isMobile ? 13 : 16} color="var(--accent-primary)" />
                        {formatDateDisplay()}
                    </button>
                    {showDatePicker && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', zIndex: 100 }}>
                            <DateRangePicker startDate={filterStartDate} endDate={filterEndDate}
                                onChange={({ startDate, endDate }) => { setFilterStartDate(startDate); setFilterEndDate(endDate); }}
                                onClose={() => setShowDatePicker(false)} />
                        </div>
                    )}
                </div>
            </div>

            {/* Primary Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? '0.5rem' : '1rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                {primaryCards.map(({ label, value, sub, icon: Icon, gradient, color, isMoney }, idx) => (
                    <div key={label} className="glass-card" style={{ padding: isMobile ? '0.625rem 0.75rem' : '1.25rem', position: 'relative', overflow: 'hidden', animation: `fadeInUp 0.4s ease ${idx * 80}ms both` }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px', background: gradient }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: isMobile ? '0.5625rem' : '0.6875rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: isMobile ? '0.25rem' : '0.5rem' }}>{label}</p>
                                <p style={{ fontSize: isMobile ? (isMoney ? '0.8125rem' : '1.25rem') : (isMoney ? '1.25rem' : '2rem'), fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.02em', wordBreak: 'break-all' }}>
                                    {isMoney ? value : formatCompact(value)}
                                </p>
                                {sub && <p style={{ fontSize: isMobile ? '0.5625rem' : '0.75rem', color: 'var(--text-secondary)', marginTop: isMobile ? '0.125rem' : '0.375rem', fontWeight: 500 }}>{sub}</p>}
                            </div>
                            <div style={{ width: isMobile ? '1.75rem' : '2.5rem', height: isMobile ? '1.75rem' : '2.5rem', borderRadius: 'var(--radius-sm)', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={isMobile ? 13 : 18} color="white" strokeWidth={2} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart: Tren Laba Kotor & Terjual */}
            <div style={{ marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.5rem' : '1rem', color: 'var(--text-primary)' }}>Tren {periodLabel} — Laba Kotor & Terjual</h3>
                    {chartData.length > 0 ? (
                        <div style={{ height: isMobile ? '200px' : '280px', marginLeft: isMobile ? '-0.375rem' : 0, marginRight: isMobile ? '-0.375rem' : 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorLabaKotor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                    <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} tickFormatter={v => { const p = v.split('-'); return isMonthly ? `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][parseInt(p[1]) - 1]} ${p[0].slice(2)}` : `${p[2]}/${p[1]}`; }} axisLine={false} tickLine={false} interval={isMobile ? 'preserveStartEnd' : undefined} />
                                    <YAxis yAxisId="left" tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v} width={isMobile ? 32 : 60} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={isMobile ? 25 : 60} />
                                    <RechartsTooltip contentStyle={tooltipStyle} formatter={(v, name) => [name === 'Laba Kotor' ? formatRupiah(v) : v + ' PCS', name]} labelFormatter={l => { const p = l.split('-'); const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return isMonthly ? `${ms[parseInt(p[1]) - 1]} ${p[0]}` : `${parseInt(p[2])} ${ms[parseInt(p[1]) - 1]} ${p[0]}`; }} />
                                    <Bar yAxisId="right" dataKey="fixTerbeli" name="Terjual" fill="#10b981" opacity={0.6} radius={[3, 3, 0, 0]} barSize={isMonthly ? 20 : 10} />
                                    <Area yAxisId="left" type="monotone" dataKey="labaBersih" name="Laba Kotor" stroke="#06b6d4" strokeWidth={2.5} fill="url(#colorLabaKotor)" dot={false} activeDot={{ r: 5, fill: '#06b6d4', strokeWidth: 2, stroke: 'white' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>Tidak ada data untuk periode ini</p>}
                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                            <div style={{ width: 12, height: 3, borderRadius: 2, background: '#06b6d4' }} />
                            Laba Kotor (kiri)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
                            Terjual (kanan)
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Status Pie + Status Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))', gap: isMobile ? '0.75rem' : '1.5rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                {/* Status Distribution Pie */}
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.5rem' : '1rem', color: 'var(--text-primary)' }}>Distribusi Status Pesanan</h3>
                    {statusDistribution.length > 0 ? (
                        <>
                            <div style={{ height: isMobile ? '160px' : '200px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 55} outerRadius={isMobile ? 65 : 85} paddingAngle={3} dataKey="value" stroke="none">
                                            {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip content={<PieTooltipContent />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                                {statusDistribution.map(item => (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                        {item.label} ({item.value} · {item.pct}%)
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>Tidak ada data</p>}
                </div>

                {/* Status Bar Chart - Per Tanggal */}
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.5rem' : '1rem', color: 'var(--text-primary)' }}>Jumlah Per Status</h3>
                    {chartData.length > 0 ? (
                        <div style={{ height: isMobile ? '180px' : '240px', marginLeft: isMobile ? '-0.375rem' : 0, marginRight: isMobile ? '-0.375rem' : 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barSize={isMobile ? 4 : (isMonthly ? 12 : 6)} barGap={1}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                    <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} tickFormatter={v => { const p = v.split('-'); return isMonthly ? `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][parseInt(p[1]) - 1]} ${p[0].slice(2)}` : `${p[2]}/${p[1]}`; }} axisLine={false} tickLine={false} interval={isMobile ? 'preserveStartEnd' : undefined} />
                                    <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={isMobile ? 25 : 60} />
                                    <RechartsTooltip contentStyle={tooltipStyle} labelFormatter={l => { const p = l.split('-'); const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return isMonthly ? `${ms[parseInt(p[1]) - 1]} ${p[0]}` : `${parseInt(p[2])} ${ms[parseInt(p[1]) - 1]} ${p[0]}`; }} />
                                    <Bar dataKey="fixTerbeli" name="Terjual" fill="#10b981" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="cancel" name="Cancel" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="returnOrder" name="Retur" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="pengembalian" name="Pengembalian" fill="#ec4899" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>Tidak ada data</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                        {[{ label: 'Terjual', color: '#10b981' }, { label: 'Cancel', color: '#ef4444' }, { label: 'Retur', color: '#7c3aed' }, { label: 'Pengembalian', color: '#ec4899' }].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts Row 3: Pencairan Dana */}
            <div style={{ marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.375rem' : '0.75rem', color: 'var(--text-primary)' }}>Pencairan Dana</h3>
                    <div style={{ display: 'flex', gap: isMobile ? '0.75rem' : '1.5rem', marginBottom: isMobile ? '0.5rem' : '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
                            <span style={{ fontSize: isMobile ? '0.6875rem' : '0.8125rem', color: 'var(--text-secondary)' }}>Sudah Cair:</span>
                            <span style={{ fontSize: isMobile ? '0.8125rem' : '1.125rem', fontWeight: 800, color: '#10b981' }}>{sums.sudahCairOrder}</span>
                            <span style={{ fontSize: isMobile ? '0.5625rem' : '0.75rem', color: 'var(--text-tertiary)' }}>({sums.sudahCairPCS} PCS)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
                            <span style={{ fontSize: isMobile ? '0.6875rem' : '0.8125rem', color: 'var(--text-secondary)' }}>Belum Cair:</span>
                            <span style={{ fontSize: isMobile ? '0.8125rem' : '1.125rem', fontWeight: 800, color: '#f59e0b' }}>{sums.belumCairOrder}</span>
                            <span style={{ fontSize: isMobile ? '0.5625rem' : '0.75rem', color: 'var(--text-tertiary)' }}>({sums.belumCairPCS} PCS)</span>
                        </div>
                    </div>
                    {chartData.length > 0 ? (
                        <div style={{ height: isMobile ? '180px' : '220px', marginLeft: isMobile ? '-0.375rem' : 0, marginRight: isMobile ? '-0.375rem' : 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barSize={isMobile ? 5 : (isMonthly ? 14 : 8)} barGap={1}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                    <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} tickFormatter={v => { const p = v.split('-'); return isMonthly ? `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][parseInt(p[1]) - 1]} ${p[0].slice(2)}` : `${p[2]}/${p[1]}`; }} axisLine={false} tickLine={false} interval={isMobile ? 'preserveStartEnd' : undefined} />
                                    <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: isMobile ? 7 : 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={isMobile ? 25 : 60} />
                                    <RechartsTooltip contentStyle={tooltipStyle} labelFormatter={l => { const p = l.split('-'); const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return isMonthly ? `${ms[parseInt(p[1]) - 1]} ${p[0]}` : `${parseInt(p[2])} ${ms[parseInt(p[1]) - 1]} ${p[0]}`; }} />
                                    <Bar dataKey="sudahCair" name="Sudah Cair" fill="#10b981" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="belumCair" name="Belum Cair" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>Tidak ada data</p>}
                </div>
            </div>

            {/* Pie Charts Row: Payment Method + Affiliate */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: isMobile ? '0.75rem' : '1.5rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                {/* Payment Method Pie */}
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.5rem' : '1rem', color: 'var(--text-primary)' }}>Metode Pembayaran</h3>
                    {paymentMethodDist.length > 0 ? (
                        <>
                            <div style={{ height: isMobile ? '160px' : '200px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={paymentMethodDist} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 55} outerRadius={isMobile ? 65 : 85} paddingAngle={3} dataKey="value" nameKey="label" stroke="none">
                                            {paymentMethodDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip content={<PieTooltipContent />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                                {paymentMethodDist.map(item => {
                                    const total = paymentMethodDist.reduce((s, x) => s + x.value, 0);
                                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                                    return (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                            {item.label} ({item.value} · {pct}%)
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>Tidak ada data</p>}
                </div>

                {/* Affiliate Pie */}
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.5rem' : '1rem', color: 'var(--text-primary)' }}>Distribusi Affiliasi</h3>
                    {affiliateDist.length > 0 ? (
                        <>
                            <div style={{ height: isMobile ? '160px' : '200px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={affiliateDist} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 55} outerRadius={isMobile ? 65 : 85} paddingAngle={3} dataKey="value" nameKey="label" stroke="none">
                                            {affiliateDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip content={<PieTooltipContent />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                                {affiliateDist.map(item => {
                                    const total = affiliateDist.reduce((s, x) => s + x.value, 0);
                                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                                    return (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                            {item.label} ({item.value} · {pct}%)
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>Tidak ada data</p>}
                </div>
            </div>

            {/* Secondary Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: isMobile ? '0.375rem' : '0.75rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                {secondaryCards.map(({ label, value, sub, icon: Icon, color }, idx) => (
                    <div key={label} className="glass-card" style={{ padding: isMobile ? '0.5rem' : '1rem', animation: `fadeInUp 0.4s ease ${(idx + 4) * 60}ms both` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.25rem' : '0.5rem', marginBottom: isMobile ? '0.25rem' : '0.5rem' }}>
                            <div style={{ width: isMobile ? '1.25rem' : '1.75rem', height: isMobile ? '1.25rem' : '1.75rem', borderRadius: 'var(--radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={isMobile ? 10 : 14} color={color} strokeWidth={2.5} />
                            </div>
                            <span style={{ fontSize: isMobile ? '0.5rem' : '0.6875rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                        </div>
                        <p style={{ fontSize: isMobile ? (typeof value === 'string' ? '0.6875rem' : '0.9375rem') : (typeof value === 'string' ? '1rem' : '1.375rem'), fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, wordBreak: 'break-all' }}>
                            {typeof value === 'number' ? formatCompact(value) : value}
                        </p>
                        {sub && <p style={{ fontSize: isMobile ? '0.5rem' : '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.125rem', fontWeight: 500 }}>{sub}</p>}
                    </div>
                ))}
            </div>

            {/* Bottom Row: Financial + Top Products */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: isMobile ? '0.75rem' : '1.5rem' }}>

                {/* Financial Summary */}
                <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.8125rem' : '1rem', fontWeight: 700, marginBottom: isMobile ? '0.5rem' : '1rem', color: 'var(--text-primary)' }}>Ringkasan Keuangan</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[
                            { label: 'Omzet', value: sums.labaKotor, color: '#10b981', icon: ArrowUpRight },
                            { label: 'Laba Kotor', value: sums.labaBersih, color: '#06b6d4', icon: TrendingUp },
                            { label: 'Affiliasi', value: sums.affiliasiNominal, color: '#a78bfa', icon: Handshake },
                            { label: 'COD Orders', value: sums.codJumlah, color: '#f97316', icon: Banknote, isCount: true },
                        ].map(({ label, value, color, icon: FI, isCount }) => (
                            <div key={label} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: isMobile ? '0.5rem 0.625rem' : '0.875rem 1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.375rem' : '0.625rem' }}>
                                    <FI size={isMobile ? 13 : 16} color={color} />
                                    <span style={{ fontSize: isMobile ? '0.6875rem' : '0.8125rem', color: 'var(--text-secondary)' }}>{label}</span>
                                </div>
                                <span style={{ fontSize: isMobile ? '0.75rem' : '0.9375rem', fontWeight: 700, color }}>{isCount ? value : formatRupiah(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Products */}
                {topProducts.length > 0 && (
                    <div className="glass-card" style={{ padding: isMobile ? '0.75rem' : '1.5rem', gridColumn: '1 / -1' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Produk Terlaris</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8125rem' }}>
                                <thead>
                                    <tr>{['#', 'Nama Produk', 'Qty Terjual', 'Estimasi Pendapatan'].map(h => (
                                        <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: h === '#' ? 'center' : 'left', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {topProducts.map((p, i) => (
                                        <tr key={i} style={{ transition: 'background var(--transition-fast)' }}
                                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--accent-primary)' }}>{i + 1}</td>
                                            <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                                            <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.qty.toLocaleString('id-ID')}</td>
                                            <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: '#10b981' }}>{formatRupiah(Math.round(p.revenue))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
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
    const fmtMO = (s) => { if (!s) return ''; const [y, m] = s.split('-'); const ms = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; return `${ms[parseInt(m) - 1]} ${y}`; };
    const qBtn = { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0', transition: 'color var(--transition-fast)' };

    return (
        <div style={{ width: '20rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '1rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={last7} style={qBtn} onMouseOver={e => e.target.style.color = '#a78bfa'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>7 Hari Terakhir</button>
                <div style={{ height: '1rem', borderLeft: '1px solid var(--border-subtle)' }} />
                <button type="button" onClick={thisMonth} style={qBtn} onMouseOver={e => e.target.style.color = '#a78bfa'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Bulan Ini</button>
                <div style={{ height: '1rem', borderLeft: '1px solid var(--border-subtle)' }} />
                <select value={selectedMonth} onChange={handleMonthChange} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, border: 'none', outline: 'none', cursor: 'pointer' }}>
                    <option value="">Pilih Bulan</option>
                    {monthOptions.map(m => <option key={m} value={m}>{fmtMO(m)}</option>)}
                </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <button type="button" onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '0.25rem' }}><ChevronLeft size={18} /></button>
                <div style={{ fontWeight: 700, color: '#a78bfa', userSelect: 'none' }}>{fmtMY(calendarMonth)}</div>
                <button type="button" onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '0.25rem' }}><ChevronRight size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.125rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#a78bfa', marginBottom: '0.25rem', userSelect: 'none' }}>
                {weekdays.map(w => <div key={w}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.125rem' }}>
                {days.map((d, i) => {
                    if (!d) return <div key={'e' + i} style={{ height: '2rem' }} />;
                    const sel = isInRange(d), st = isStart(d), en = isEnd(d);
                    const t = new Date(), isToday = d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
                    let bg = 'transparent', c = 'var(--text-primary)', fw = 400, br = '50%';
                    if (sel) { if (st && en) { bg = '#7c3aed'; c = '#fff'; fw = 700; } else if (st) { bg = '#7c3aed'; c = '#fff'; fw = 700; br = '50% 0 0 50%'; } else if (en) { bg = '#7c3aed'; c = '#fff'; fw = 700; br = '0 50% 50% 0'; } else { bg = 'rgba(124,58,237,0.3)'; c = '#e9d5ff'; } } else if (isToday) { c = '#a78bfa'; fw = 700; }
                    return (<button key={d.toISOString()} type="button" onClick={() => onDateClick(d)} style={{ height: '2rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', cursor: 'pointer', border: isToday && !sel ? '1px solid #a78bfa' : 'none', background: bg, color: c, fontWeight: fw, borderRadius: br, transition: 'background var(--transition-fast)', userSelect: 'none' }} onMouseOver={e => { if (!sel) e.target.style.background = 'rgba(124,58,237,0.15)'; }} onMouseOut={e => { if (!sel) e.target.style.background = bg; }}>{d.getDate()}</button>);
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
