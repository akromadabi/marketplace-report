import React, { useMemo, useState, useCallback } from 'react';
import { BarChart3, ChevronUp, ChevronDown, ArrowUpDown, MapPin, Package, X, Copy, Check } from 'lucide-react';
import { useProcessedOrders } from '../hooks/useProcessedOrders';


// ─── helpers ───────────────────────────────────────────────────────────
function parseQuantity(q) {
  if (typeof q === 'number') return q;
  if (typeof q === 'string') { const n = parseInt(q.replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; }
  return 0;
}

function formatRupiah(number) {
  if (typeof number !== 'number' || isNaN(number)) return '';
  return 'Rp' + number.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function getProvince(row) {
  if (row.province) return row.province.trim().toUpperCase();
  return 'Tidak Diketahui';
}

function getCity(row) {
  if (row.regencyAndCity) return row.regencyAndCity.trim().toUpperCase();
  return 'Tidak Diketahui';
}

// ─── main component ────────────────────────────────────────────────────
function ProductAnalysis() {
  const { rangkumanData, loading: isLoading } = useProcessedOrders();

  // View mode: 'sku' | 'regional'
  const [viewMode, setViewMode] = useState('sku');
  const [isFlatView, setIsFlatView] = useState(false);
  // For regional: which province is expanded to show cities
  const [expandedProvince, setExpandedProvince] = useState(null);
  // Regional sort state
  const [regionalSort, setRegionalSort] = useState({ column: 'Total Return', direction: 'desc' });
  // Metric filter: 'return' | 'gagal_kirim' | 'semua'
  const [metricFilter, setMetricFilter] = useState('semua');
  // SKU mode - expanded rows
  const [expandedSkus, setExpandedSkus] = useState(new Set());
  const [variationSorts, setVariationSorts] = useState({});
  const [citySorts, setCitySorts] = useState({});
  const [skuSort, setSkuSort] = useState({ column: 'Total Terjual', direction: 'desc' });
  // Popup for order IDs
  const [popup, setPopup] = useState(null); // { title, orderIds }
  const [copiedId, setCopiedId] = useState(null);

  const openPopup = useCallback((title, orders) => setPopup({ title, orders }), []);
  const closePopup = useCallback(() => setPopup(null), []);

  // ─── SKU aggregation ────────────────────────────────────────────────
  const skuAggregated = useMemo(() => {
    const map = new Map();
    rangkumanData.forEach((row) => {
      const statusOrder = (row.statusOrder || '').toLowerCase();
      const isReturn = statusOrder === 'return';
      // hook sets statusOrder to 'Pengembalian' for Gagal Kirim Paket / Paket Ditolak
      const isGagalKirim = statusOrder === 'pengembalian';
      const isAffiliated = row.totalAffiliateCommission < 0;
      const settlement = row.totalSettlementAmount || 0;
      const lineItems = row.orders || [];

      lineItems.forEach((order) => {
        const sku = (order['Seller SKU'] || '').toString().trim();
        if (!sku) return;
        const quantity = parseQuantity(order['Quantity']);
        const variation = (order['Variation'] || '').toString().trim() || '(No Variation)';
        const skuId = (order['SKU ID'] || '').toString().trim();
        const totalQtyInOrder = row.totalQuantity || 1;
        const itemSettlement = (settlement / totalQtyInOrder) * quantity;

        if (!map.has(sku)) {
          map.set(sku, { sku, productName: order['Product Name'] || '', totalQuantity: 0, totalReturn: 0, totalGagalKirim: 0, totalNilaiJual: 0, totalNilaiJualAFF: 0, countNilaiJual: 0, countNilaiJualAFF: 0, returnOrders: [], gagalKirimOrders: [], variations: new Map() });
        }
        const skuData = map.get(sku);
        skuData.totalQuantity += quantity;
        if (isReturn) { skuData.totalReturn += quantity; if (!skuData.returnOrders.find(o => o.orderId === row.orderId)) skuData.returnOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
        if (isGagalKirim) { skuData.totalGagalKirim += quantity; if (!skuData.gagalKirimOrders.find(o => o.orderId === row.orderId)) skuData.gagalKirimOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
        if (settlement > 0 && !isAffiliated && !isReturn && !isGagalKirim) { skuData.totalNilaiJual += itemSettlement; skuData.countNilaiJual += quantity; }
        if (settlement > 0 && isAffiliated && !isReturn && !isGagalKirim) { skuData.totalNilaiJualAFF += itemSettlement; skuData.countNilaiJualAFF += quantity; }

        if (!skuData.variations.has(variation)) {
          skuData.variations.set(variation, { variation, productName: order['Product Name'] || '', totalQuantity: 0, totalReturn: 0, totalGagalKirim: 0, skuId, totalNilaiJual: 0, totalNilaiJualAFF: 0, countNilaiJual: 0, countNilaiJualAFF: 0, returnOrders: [], gagalKirimOrders: [] });
        }
        const varData = skuData.variations.get(variation);
        varData.totalQuantity += quantity;
        if (isReturn) { varData.totalReturn += quantity; if (!varData.returnOrders.find(o => o.orderId === row.orderId)) varData.returnOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
        if (isGagalKirim) { varData.totalGagalKirim += quantity; if (!varData.gagalKirimOrders.find(o => o.orderId === row.orderId)) varData.gagalKirimOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
        if (settlement > 0 && !isAffiliated && !isReturn && !isGagalKirim) { varData.totalNilaiJual += itemSettlement; varData.countNilaiJual += quantity; }
        if (settlement > 0 && isAffiliated && !isReturn && !isGagalKirim) { varData.totalNilaiJualAFF += itemSettlement; varData.countNilaiJualAFF += quantity; }
      });
    });

    const arr = Array.from(map.values());
    arr.forEach((skuObj) => {
      skuObj.totalNilaiJual = skuObj.countNilaiJual > 0 ? skuObj.totalNilaiJual / skuObj.countNilaiJual : 0;
      skuObj.totalNilaiJualAFF = skuObj.countNilaiJualAFF > 0 ? skuObj.totalNilaiJualAFF / skuObj.countNilaiJualAFF : 0;
      skuObj.variations.forEach((varObj) => {
        varObj.totalNilaiJual = varObj.countNilaiJual > 0 ? varObj.totalNilaiJual / varObj.countNilaiJual : 0;
        varObj.totalNilaiJualAFF = varObj.countNilaiJualAFF > 0 ? varObj.totalNilaiJualAFF / varObj.countNilaiJualAFF : 0;
      });
    });
    arr.sort((a, b) => b.totalQuantity - a.totalQuantity);
    return arr;
  }, [rangkumanData]);

  // ─── Regional aggregation ────────────────────────────────────────────────────
  const regionalAggregated = useMemo(() => {
    const provinceMap = new Map();
    rangkumanData.forEach((row) => {
      const statusOrder = (row.statusOrder || '').toLowerCase();
      const isReturn = statusOrder === 'return';
      const isGagalKirim = statusOrder === 'pengembalian';

      const province = getProvince(row);
      const city = getCity(row);

      if (!provinceMap.has(province)) {
        provinceMap.set(province, { province, totalOrders: 0, totalReturn: 0, totalGagalKirim: 0, returnOrders: [], gagalKirimOrders: [], cities: new Map() });
      }
      const provData = provinceMap.get(province);
      provData.totalOrders++;
      if (isReturn) { provData.totalReturn++; if (!provData.returnOrders.find(o => o.orderId === row.orderId)) provData.returnOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
      if (isGagalKirim) { provData.totalGagalKirim++; if (!provData.gagalKirimOrders.find(o => o.orderId === row.orderId)) provData.gagalKirimOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }

      if (!provData.cities.has(city)) {
        provData.cities.set(city, { city, totalOrders: 0, totalReturn: 0, totalGagalKirim: 0, returnOrders: [], gagalKirimOrders: [] });
      }
      const cityData = provData.cities.get(city);
      cityData.totalOrders++;
      if (isReturn) { cityData.totalReturn++; if (!cityData.returnOrders.find(o => o.orderId === row.orderId)) cityData.returnOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
      if (isGagalKirim) { cityData.totalGagalKirim++; if (!cityData.gagalKirimOrders.find(o => o.orderId === row.orderId)) cityData.gagalKirimOrders.push({ orderId: row.orderId, statusOrder: row.statusOrder, city: row.regencyAndCity, province: row.province, verifikasiPaket: row.verifikasiPaket }); }
    });

    return Array.from(provinceMap.values()).sort((a, b) => (b.totalReturn + b.totalGagalKirim) - (a.totalReturn + a.totalGagalKirim));
  }, [rangkumanData]);


  // ─── Flat aggregations ────────────────────────────────────────────────────
  const flatSkuAggregated = useMemo(() => {
    const flat = [];
    skuAggregated.forEach(skuObj => {
      Array.from(skuObj.variations.values()).forEach(varObj => {
        flat.push({ ...varObj, parentSku: skuObj.sku });
      });
    });
    return flat;
  }, [skuAggregated]);

  const flatRegionalAggregated = useMemo(() => {
    const flat = [];
    regionalAggregated.forEach(provObj => {
      Array.from(provObj.cities.values()).forEach(cityObj => {
        flat.push({ ...cityObj, parentProvince: provObj.province });
      });
    });
    return flat;
  }, [regionalAggregated]);

  const sortedFlatSku = useMemo(() => {
    return sortVariations(flatSkuAggregated, skuSort);
  }, [flatSkuAggregated, skuSort]);

  const sortedFlatRegional = useMemo(() => {
    // Re-use city sorts logic or a simpler one
    const { column, direction } = regionalSort;
    return [...flatRegionalAggregated].sort((a, b) => {
      let aVal, bVal;
      switch (column) {
        case 'Provinsi': return direction === 'asc' ? a.parentProvince.localeCompare(b.parentProvince) : b.parentProvince.localeCompare(a.parentProvince);
        case 'Kota / Kabupaten': return direction === 'asc' ? a.city.localeCompare(b.city) : b.city.localeCompare(a.city);
        case 'Total Pesanan': aVal = a.totalOrders; bVal = b.totalOrders; break;
        case 'Total Return': case 'Return': aVal = a.totalReturn; bVal = b.totalReturn; break;
        case '% Return': aVal = a.totalOrders > 0 ? a.totalReturn / a.totalOrders : 0; bVal = b.totalOrders > 0 ? b.totalReturn / b.totalOrders : 0; break;
        case 'Gagal Kirim': aVal = a.totalGagalKirim; bVal = b.totalGagalKirim; break;
        case '% Gagal Kirim': aVal = a.totalOrders > 0 ? a.totalGagalKirim / a.totalOrders : 0; bVal = b.totalOrders > 0 ? b.totalGagalKirim / b.totalOrders : 0; break;
        default: return 0;
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [flatRegionalAggregated, regionalSort]);

  const totalQuantityAllSkus = useMemo(() => skuAggregated.reduce((sum, s) => sum + s.totalQuantity, 0), [skuAggregated]);

  function toggleSku(sku) {
    setExpandedSkus((prev) => { const s = new Set(prev); if (s.has(sku)) s.delete(sku); else s.add(sku); return s; });
  }

  function sortVariations(variationsArray, sortConfig) {
    if (!sortConfig || !sortConfig.column) return variationsArray;
    const { column, direction } = sortConfig;
    return [...variationsArray].sort((a, b) => {
      switch (column) {
        case 'SKU Produk': { const c = (a.parentSku || '').localeCompare(b.parentSku || ''); return direction === 'asc' ? c : -c; }
        case 'Variation': { const c = a.variation.toLowerCase().localeCompare(b.variation.toLowerCase()); return direction === 'asc' ? c : -c; }
        case 'ID Produk': { const c = a.skuId.toLowerCase().localeCompare(b.skuId.toLowerCase()); return direction === 'asc' ? c : -c; }
        case 'Total Quantity Terjual': return direction === 'asc' ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity;
        case 'Total Return': return direction === 'asc' ? a.totalReturn - b.totalReturn : b.totalReturn - a.totalReturn;
        case 'Total Gagal Kirim': return direction === 'asc' ? a.totalGagalKirim - b.totalGagalKirim : b.totalGagalKirim - a.totalGagalKirim;
        case 'Nilai Jual': return direction === 'asc' ? a.totalNilaiJual - b.totalNilaiJual : b.totalNilaiJual - a.totalNilaiJual;
        case 'Nilai Jual AFF': return direction === 'asc' ? a.totalNilaiJualAFF - b.totalNilaiJualAFF : b.totalNilaiJualAFF - a.totalNilaiJualAFF;
        default: return 0;
      }
    });
  }

  function handleVariationSortClick(sku, column) {
    setVariationSorts((prev) => {
      const c = prev[sku];
      if (c && c.column === column) return { ...prev, [sku]: { column, direction: c.direction === 'asc' ? 'desc' : 'asc' } };
      return { ...prev, [sku]: { column, direction: 'asc' } };
    });
  }

  function VarSortIcon({ sku, column }) {
    const sort = variationSorts[sku];
    if (!sort || sort.column !== column) return <ArrowUpDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sort.direction === 'asc' ? <ChevronUp size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} /> : <ChevronDown size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
  }

  function handleSkuSortClick(column) {
    setSkuSort(prev =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'desc' }
    );
  }

  const sortedSkuAggregated = useMemo(() => {
    const { column, direction } = skuSort;
    return [...skuAggregated].sort((a, b) => {
      let aVal, bVal;
      switch (column) {
        case 'SKU Produk': return direction === 'asc' ? a.sku.localeCompare(b.sku) : b.sku.localeCompare(a.sku);
        case 'Total Terjual': aVal = a.totalQuantity; bVal = b.totalQuantity; break;
        case 'Presentase': aVal = a.totalQuantity; bVal = b.totalQuantity; break;
        case 'Total Return': aVal = a.totalReturn; bVal = b.totalReturn; break;
        case '% Return': aVal = a.totalQuantity > 0 ? a.totalReturn / a.totalQuantity : 0; bVal = b.totalQuantity > 0 ? b.totalReturn / b.totalQuantity : 0; break;
        case 'Gagal Kirim': aVal = a.totalGagalKirim; bVal = b.totalGagalKirim; break;
        case '% Gagal Kirim': aVal = a.totalQuantity > 0 ? a.totalGagalKirim / a.totalQuantity : 0; bVal = b.totalQuantity > 0 ? b.totalGagalKirim / b.totalQuantity : 0; break;
        case 'Nilai Jual': aVal = a.totalNilaiJual; bVal = b.totalNilaiJual; break;
        case 'Nilai Jual AFF': aVal = a.totalNilaiJualAFF; bVal = b.totalNilaiJualAFF; break;
        default: return 0;
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [skuAggregated, skuSort]);

  function SkuSortIcon({ column }) {
    if (skuSort.column !== column) return <ArrowUpDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return skuSort.direction === 'asc'
      ? <ChevronUp size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />
      : <ChevronDown size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
  }

  function handleRegionalSortClick(column) {
    setRegionalSort(prev =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'desc' }
    );
  }

  const sortedRegional = useMemo(() => {
    const { column, direction } = regionalSort;
    return [...regionalAggregated].sort((a, b) => {
      let aVal, bVal;
      switch (column) {
        case 'Provinsi': return direction === 'asc' ? a.province.localeCompare(b.province) : b.province.localeCompare(a.province);
        case 'Total Pesanan': aVal = a.totalOrders; bVal = b.totalOrders; break;
        case 'Total Return': aVal = a.totalReturn; bVal = b.totalReturn; break;
        case '% Return': aVal = a.totalOrders > 0 ? a.totalReturn / a.totalOrders : 0; bVal = b.totalOrders > 0 ? b.totalReturn / b.totalOrders : 0; break;
        case 'Gagal Kirim': aVal = a.totalGagalKirim; bVal = b.totalGagalKirim; break;
        case '% Gagal Kirim': aVal = a.totalOrders > 0 ? a.totalGagalKirim / a.totalOrders : 0; bVal = b.totalOrders > 0 ? b.totalGagalKirim / b.totalOrders : 0; break;
        default: return 0;
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [regionalAggregated, regionalSort]);

  function RegSortIcon({ column }) {
    if (regionalSort.column !== column) return <ArrowUpDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return regionalSort.direction === 'asc'
      ? <ChevronUp size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />
      : <ChevronDown size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
  }

  function handleCitySortClick(province, column) {
    setCitySorts(prev => {
      const c = prev[province];
      if (c && c.column === column) return { ...prev, [province]: { column, direction: c.direction === 'asc' ? 'desc' : 'asc' } };
      return { ...prev, [province]: { column, direction: 'desc' } };
    });
  }

  function CitySortIcon({ province, column }) {
    const sort = citySorts[province];
    if (!sort || sort.column !== column) return <ArrowUpDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sort.direction === 'asc'
      ? <ChevronUp size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />
      : <ChevronDown size={12} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
  }

  // ─── derived column config for SKU mode ──────────────────────────────
  const showReturn = metricFilter === 'return' || metricFilter === 'semua';
  const showGagalKirim = metricFilter === 'gagal_kirim' || metricFilter === 'semua';

  const skuColumns = ['SKU Produk', 'Total Terjual', 'Presentase', ...(showReturn ? ['Total Return', '% Return'] : []), ...(showGagalKirim ? ['Gagal Kirim', '% Gagal Kirim'] : []), 'Nilai Jual', 'Nilai Jual AFF'];
  const varColumns = ['Variasi', 'ID Produk', 'Total Terjual', 'Presentase', ...(showReturn ? ['Total Return', '% Return'] : []), ...(showGagalKirim ? ['Gagal Kirim', '% Gagal Kirim'] : []), 'Nilai Jual', 'Nilai Jual AFF'];
  const varColumnsFlat = ['SKU Produk', ...varColumns];
  const regionalColumnsFlat = ['Provinsi', 'Kota / Kabupaten', 'Total Pesanan', ...(showReturn ? ['Return', '% Return'] : []), ...(showGagalKirim ? ['Gagal Kirim', '% Gagal Kirim'] : [])];

  const btnBase = { padding: '0.4rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' };
  const btnActive = { ...btnBase, background: 'var(--accent-primary)', color: '#fff', borderColor: '#7c3aed' };
  const btnInactive = { ...btnBase, background: 'var(--bg-glass)', color: 'var(--text-secondary)' };

  const metricBtnBase = { padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' };

  const getMetricStyle = (key) => metricFilter === key
    ? { ...metricBtnBase, background: key === 'return' ? 'rgba(251,191,36,0.2)' : key === 'gagal_kirim' ? 'rgba(251,146,60,0.2)' : 'rgba(124,58,237,0.2)', color: key === 'return' ? '#fbbf24' : key === 'gagal_kirim' ? '#fb923c' : '#a78bfa', borderColor: key === 'return' ? '#fbbf24' : key === 'gagal_kirim' ? '#fb923c' : '#7c3aed' }
    : { ...metricBtnBase, background: 'var(--bg-glass)', color: 'var(--text-tertiary)' };

  // ─── render ───────────────────────────────────────────────────────────

  function OrderPopup() {
    if (!popup) return null;
    const orders = popup.orders || [];
    const handleCopy = (id) => {
      navigator.clipboard.writeText(id).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      });
    };
    const verBadge = (v) => {
      if (!v || v === '-') return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>-</span>;
      const color = v === 'Diterima' ? '#4ade80' : v === 'Diproses' ? '#fbbf24' : v === 'Gagal Kirim Paket' || v === 'Paket Ditolak' ? '#fb923c' : 'var(--text-secondary)';
      return <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{v}</span>;
    };
    return (
      <div onClick={closePopup} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card, #1e1b2e)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '12px', width: '100%', maxWidth: '860px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(167,139,250,0.15)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#a78bfa' }}>{popup.title}</span>
            <button onClick={closePopup} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' }}><X size={18} /></button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem 0' }}>Tidak ada order.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card, #1e1b2e)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid rgba(167,139,250,0.15)' }}>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', width: '38%' }}>ID Order</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Status Order</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>Alamat</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Verifikasi Paket</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, idx) => (
                    <tr key={o.orderId} style={{ background: idx % 2 === 0 ? 'rgba(124,58,237,0.05)' : 'transparent', borderBottom: '1px solid rgba(167,139,250,0.06)' }}>
                      <td style={{ padding: '0.4rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{o.orderId}</span>
                          <button onClick={() => handleCopy(o.orderId)} title="Copy ID" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === o.orderId ? '#4ade80' : '#a78bfa', padding: '2px 4px', borderRadius: '4px', transition: 'color 0.2s', flexShrink: 0 }}>
                            {copiedId === o.orderId ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: o.statusOrder === 'Return' ? '#fbbf24' : o.statusOrder === 'Pengembalian' ? '#fb923c' : 'var(--text-secondary)' }}>{o.statusOrder}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)' }}>{[o.city, o.province].filter(Boolean).join(', ') || '-'}</td>
                      <td style={{ padding: '0.4rem 1rem', textAlign: 'center' }}>{verBadge(o.verifikasiPaket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(167,139,250,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{orders.length} order</span>
            <button onClick={() => { navigator.clipboard.writeText(orders.map(o => o.orderId).join('\n')); }} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Copy size={12} /> Copy Semua ID
            </button>
          </div>
        </div>
      </div>
    );
  }

  function ClickableCount({ count, color, orders, label }) {
    if (!count) return <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>0</span>;
    return (
      <button
        onClick={e => { e.stopPropagation(); openPopup(label, orders || []); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color, padding: 0, textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
      >
        {count}
      </button>
    );
  }

  return (

    <div>
      <OrderPopup />
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={24} style={{ color: '#7c3aed' }} />
            Wawasan
          </h2>
          <p>{viewMode === 'sku' ? `${skuAggregated.length} SKU • ${totalQuantityAllSkus.toLocaleString('id-ID')} total terjual` : `${regionalAggregated.length} Provinsi`}</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
          {/* Flat List Toggle (Checkbox) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: isFlatView ? '#a78bfa' : 'var(--text-secondary)', background: isFlatView ? 'rgba(124,58,237,0.1)' : 'var(--bg-glass)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', border: isFlatView ? '1px solid rgba(167,139,250,0.4)' : '1px solid var(--border-subtle)', transition: 'all 0.2s' }}>
            <input type="checkbox" checked={isFlatView} onChange={() => setIsFlatView(!isFlatView)} style={{ accentColor: '#7c3aed', width: '1rem', height: '1rem', cursor: 'pointer', margin: 0 }} />
            Flat List
          </label>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              style={{ ...btnBase, background: 'rgba(124, 58, 237, 0.1)', color: '#a78bfa', borderColor: 'rgba(124, 58, 237, 0.3)', WebkitAppearance: 'none', paddingRight: '2.5rem', cursor: 'pointer', minWidth: '130px' }}
            >
              <option value="sku" style={{ background: '#1e1b2e', color: '#a78bfa' }}>📦 Per Produk</option>
              <option value="regional" style={{ background: '#1e1b2e', color: '#a78bfa' }}>📍 Per Wilayah</option>
            </select>
            <div style={{ position: 'absolute', right: '0.8rem', pointerEvents: 'none', color: '#a78bfa', display: 'flex', alignItems: 'center' }}>
              <ChevronDown size={14} />
            </div>
          </div>

        </div>
      </div>

      {/* ── SKU TABLE ─────────────────────────────────────────────────── */}
      {
        viewMode === 'sku' && (
          <div className="modern-table-wrapper">
            <div style={{ overflowX: 'auto' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '3rem' }}>No</th>
                    {(isFlatView ? varColumnsFlat : skuColumns).map((col) => (
                      <th key={col} onClick={() => handleSkuSortClick(col)} style={{ cursor: 'pointer', textAlign: col === 'SKU Produk' || col === 'Variasi' ? 'left' : 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: col === 'SKU Produk' || col === 'Variasi' ? 'flex-start' : 'center' }}>
                          <span>{col}</span><SkuSortIcon column={col} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td><div className="skeleton" style={{ height: '1rem', width: '1.5rem' }}>&nbsp;</div></td>{skuColumns.map(c => <td key={c}><div className="skeleton" style={{ height: '1rem', width: '60%', margin: '0 auto' }}>&nbsp;</div></td>)}</tr>
                  )) : skuAggregated.length === 0 ? (
                    <tr><td colSpan={skuColumns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Tidak ada data untuk ditampilkan.</td></tr>
                  ) : (isFlatView ? sortedFlatSku.map((varObj, idx) => {
                    const totalVarQty = sortedFlatSku.reduce((s, v) => s + v.totalQuantity, 0);
                    const varPct = totalQuantityAllSkus > 0 ? (varObj.totalQuantity / totalQuantityAllSkus) * 100 : 0;
                    const varRetPct = varObj.totalQuantity > 0 ? (varObj.totalReturn / varObj.totalQuantity) * 100 : 0;
                    const varGkPct = varObj.totalQuantity > 0 ? (varObj.totalGagalKirim / varObj.totalQuantity) * 100 : 0;
                    return (
                      <tr key={varObj.parentSku + ' ' + varObj.variation} style={{ background: idx % 2 === 0 ? 'rgba(124,58,237,0.02)' : 'transparent', borderBottom: '1px solid rgba(167,139,250,0.06)' }}>
                        <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: '#a78bfa' }}>{varObj.parentSku}</td>
                        <td title={varObj.variation}>{varObj.variation}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{varObj.skuId}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{varObj.totalQuantity}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{varPct.toFixed(2)}%</td>
                        {showReturn && <>
                          <td style={{ textAlign: 'center' }}><ClickableCount count={varObj.totalReturn} color="#fbbf24" orders={varObj.returnOrders} label={'Return — ' + varObj.parentSku + ' / ' + varObj.variation} /></td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: varRetPct > 5 ? '#f87171' : 'var(--text-primary)' }}>{varRetPct.toFixed(2)}%</td>
                        </>}
                        {showGagalKirim && <>
                          <td style={{ textAlign: 'center' }}><ClickableCount count={varObj.totalGagalKirim} color="#fb923c" orders={varObj.gagalKirimOrders} label={'Gagal Kirim — ' + varObj.parentSku + ' / ' + varObj.variation} /></td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: varGkPct > 5 ? '#f87171' : 'var(--text-primary)' }}>{varGkPct.toFixed(2)}%</td>
                        </>}
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatRupiah(varObj.totalNilaiJual)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatRupiah(varObj.totalNilaiJualAFF)}</td>
                      </tr>
                    );
                  }) : sortedSkuAggregated.map((skuObj, i) => {
                    const isExpanded = expandedSkus.has(skuObj.sku);
                    const pct = totalQuantityAllSkus > 0 ? (skuObj.totalQuantity / totalQuantityAllSkus) * 100 : 0;
                    const retPct = skuObj.totalQuantity > 0 ? (skuObj.totalReturn / skuObj.totalQuantity) * 100 : 0;
                    const gkPct = skuObj.totalQuantity > 0 ? (skuObj.totalGagalKirim / skuObj.totalQuantity) * 100 : 0;

                    return (
                      <React.Fragment key={skuObj.sku}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => toggleSku(skuObj.sku)}>
                          <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                {skuObj.sku.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 700, color: '#a78bfa' }}>{skuObj.sku}</span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Klik untuk detail variasi</span>
                              </div>
                              <div style={{ marginLeft: 'auto', color: '#a78bfa' }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{skuObj.totalQuantity}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{pct.toFixed(2)}%</td>
                          {showReturn && <>
                            <td style={{ textAlign: 'center' }}><ClickableCount count={skuObj.totalReturn} color="#fbbf24" orders={skuObj.returnOrders} label={`Return — ${skuObj.sku}`} /></td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: retPct > 5 ? '#f87171' : 'var(--text-primary)' }}>{retPct.toFixed(2)}%</td>
                          </>}
                          {showGagalKirim && <>
                            <td style={{ textAlign: 'center' }}><ClickableCount count={skuObj.totalGagalKirim} color="#fb923c" orders={skuObj.gagalKirimOrders} label={`Gagal Kirim — ${skuObj.sku}`} /></td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: gkPct > 5 ? '#f87171' : 'var(--text-primary)' }}>{gkPct.toFixed(2)}%</td>
                          </>}
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatRupiah(skuObj.totalNilaiJual)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatRupiah(skuObj.totalNilaiJualAFF)}</td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={skuColumns.length + 1} style={{ padding: 0, background: 'rgba(124,58,237,0.05)' }}>
                              <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(167,139,250,0.2)' }}>
                                <table className="modern-table" style={{ margin: 0, borderRadius: 0 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: '3rem' }}>No</th>
                                      {varColumns.map((col) => (
                                        <th key={col} onClick={() => handleVariationSortClick(skuObj.sku, col)} style={{ cursor: 'pointer' }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}><span>{col}</span><VarSortIcon sku={skuObj.sku} column={col} /></div>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const sorted = sortVariations(Array.from(skuObj.variations.values()), variationSorts[skuObj.sku]);
                                      if (sorted.length === 0) return <tr><td colSpan={varColumns.length + 1} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-tertiary)' }}>Tidak ada variasi.</td></tr>;
                                      const totalVarQty = sorted.reduce((s, v) => s + v.totalQuantity, 0);
                                      return sorted.map((varObj, idx) => {
                                        const varPct = totalVarQty > 0 ? (varObj.totalQuantity / totalVarQty) * 100 : 0;
                                        const varRetPct = varObj.totalQuantity > 0 ? (varObj.totalReturn / varObj.totalQuantity) * 100 : 0;
                                        const varGkPct = varObj.totalQuantity > 0 ? (varObj.totalGagalKirim / varObj.totalQuantity) * 100 : 0;
                                        return (
                                          <tr key={varObj.variation}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{idx + 1}</td>
                                            <td style={{ fontSize: '0.75rem' }} title={varObj.variation}>{varObj.variation}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{varObj.skuId}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{varObj.totalQuantity}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{varPct.toFixed(2)}%</td>
                                            {showReturn && <>
                                              <td style={{ textAlign: 'center', fontSize: '0.75rem' }}><ClickableCount count={varObj.totalReturn} color="#fbbf24" orders={varObj.returnOrders} label={`Return — ${skuObj.sku} / ${varObj.variation}`} /></td>
                                              <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: varRetPct > 5 ? '#f87171' : 'var(--text-primary)' }}>{varRetPct.toFixed(2)}%</td>
                                            </>}
                                            {showGagalKirim && <>
                                              <td style={{ textAlign: 'center', fontSize: '0.75rem' }}><ClickableCount count={varObj.totalGagalKirim} color="#fb923c" orders={varObj.gagalKirimOrders} label={`Gagal Kirim — ${skuObj.sku} / ${varObj.variation}`} /></td>
                                              <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: varGkPct > 5 ? '#f87171' : 'var(--text-primary)' }}>{varGkPct.toFixed(2)}%</td>
                                            </>}
                                            <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{formatRupiah(varObj.totalNilaiJual)}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{formatRupiah(varObj.totalNilaiJualAFF)}</td>
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* ── REGIONAL TABLE ─────────────────────────────────────────────── */}
      {
        viewMode === 'regional' && (
          <div className="modern-table-wrapper">
            <div style={{ overflowX: 'auto' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '3rem' }}>No</th>
                    {(isFlatView ? regionalColumnsFlat : ["Provinsi", "Total Pesanan", ...(showReturn ? ["Total Return", "% Return"] : []), ...(showGagalKirim ? ["Gagal Kirim", "% Gagal Kirim"] : [])]).map(col => (
                      <th key={col} onClick={() => handleRegionalSortClick(col)} style={{ cursor: 'pointer', textAlign: col === 'Provinsi' || col === 'Kota / Kabupaten' ? 'left' : 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: col === 'Provinsi' || col === 'Kota / Kabupaten' ? 'flex-start' : 'center' }}>
                          <span>{col}</span><RegSortIcon column={col} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height: '1.5rem', width: '100%' }}>&nbsp;</div></td></tr>
                  )) : sortedRegional.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Tidak ada data untuk ditampilkan.</td></tr>
                  ) : (isFlatView ? sortedFlatRegional.map((cityObj, idx) => {
                    const cRetPct = cityObj.totalOrders > 0 ? (cityObj.totalReturn / cityObj.totalOrders) * 100 : 0;
                    const cGkPct = cityObj.totalOrders > 0 ? (cityObj.totalGagalKirim / cityObj.totalOrders) * 100 : 0;
                    return (
                      <tr key={cityObj.parentProvince + cityObj.city} style={{ background: idx % 2 === 0 ? 'rgba(124,58,237,0.02)' : 'transparent', borderBottom: '1px solid rgba(167,139,250,0.06)' }}>
                        <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: '#a78bfa' }}>{cityObj.parentProvince}</td>
                        <td style={{ fontWeight: 600 }}>{cityObj.city}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{cityObj.totalOrders}</td>
                        {showReturn && <>
                          <td style={{ textAlign: 'center' }}><ClickableCount count={cityObj.totalReturn} color="#fbbf24" orders={cityObj.returnOrders} label={'Return — ' + cityObj.city} /></td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: cRetPct > 5 ? '#f87171' : 'var(--text-secondary)' }}>{cRetPct.toFixed(1)}%</td>
                        </>}
                        {showGagalKirim && <>
                          <td style={{ textAlign: 'center' }}><ClickableCount count={cityObj.totalGagalKirim} color="#fb923c" orders={cityObj.gagalKirimOrders} label={'Gagal Kirim — ' + cityObj.city} /></td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: cGkPct > 5 ? '#f87171' : 'var(--text-secondary)' }}>{cGkPct.toFixed(1)}%</td>
                        </>}
                      </tr>
                    );
                  }) : sortedRegional.map((provObj, i) => {
                    const isExpanded = expandedProvince === provObj.province;
                    const retPct = provObj.totalOrders > 0 ? (provObj.totalReturn / provObj.totalOrders) * 100 : 0;
                    const gkPct = provObj.totalOrders > 0 ? (provObj.totalGagalKirim / provObj.totalOrders) * 100 : 0;
                    const totalMasalah = provObj.totalReturn + provObj.totalGagalKirim;
                    const citySort = citySorts[provObj.province] || { column: 'Total Return', direction: 'desc' };
                    const sortedCities = Array.from(provObj.cities.values()).sort((a, b) => {
                      const { column, direction } = citySort;
                      let aVal, bVal;
                      switch (column) {
                        case 'Kota / Kabupaten': return direction === 'asc' ? a.city.localeCompare(b.city) : b.city.localeCompare(a.city);
                        case 'Total Pesanan': aVal = a.totalOrders; bVal = b.totalOrders; break;
                        case 'Return': aVal = a.totalReturn; bVal = b.totalReturn; break;
                        case '% Return': aVal = a.totalOrders > 0 ? a.totalReturn / a.totalOrders : 0; bVal = b.totalOrders > 0 ? b.totalReturn / b.totalOrders : 0; break;
                        case 'Gagal Kirim': aVal = a.totalGagalKirim; bVal = b.totalGagalKirim; break;
                        case '% Gagal Kirim': aVal = a.totalOrders > 0 ? a.totalGagalKirim / a.totalOrders : 0; bVal = b.totalOrders > 0 ? b.totalGagalKirim / b.totalOrders : 0; break;
                        default: return 0;
                      }
                      return direction === 'asc' ? aVal - bVal : bVal - aVal;
                    });

                    return (
                      <React.Fragment key={provObj.province}>
                        <tr
                          style={{ cursor: 'pointer', background: isExpanded ? 'rgba(124,58,237,0.07)' : undefined }}
                          onClick={() => setExpandedProvince(isExpanded ? null : provObj.province)}
                        >
                          <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'linear-gradient(135deg, #5b21b6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.65rem', flexShrink: 0 }}>
                                {provObj.province.slice(0, 2)}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 700, color: '#a78bfa' }}>{provObj.province}</span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Klik untuk detail kota</span>
                              </div>
                              <div style={{ marginLeft: 'auto', color: '#a78bfa' }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{provObj.totalOrders}</td>
                          {showReturn && <>
                            <td style={{ textAlign: 'center' }}><ClickableCount count={provObj.totalReturn} color="#fbbf24" orders={provObj.returnOrders} label={`Return — ${provObj.province}`} /></td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: retPct > 5 ? '#f87171' : 'var(--text-secondary)' }}>{retPct.toFixed(1)}%</td>
                          </>}
                          {showGagalKirim && <>
                            <td style={{ textAlign: 'center' }}><ClickableCount count={provObj.totalGagalKirim} color="#fb923c" orders={provObj.gagalKirimOrders} label={`Gagal Kirim — ${provObj.province}`} /></td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: gkPct > 5 ? '#f87171' : 'var(--text-secondary)' }}>{gkPct.toFixed(1)}%</td>
                          </>}
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={9} style={{ padding: 0, background: 'rgba(124,58,237,0.04)' }}>
                              <div style={{ borderTop: '1px solid rgba(167,139,250,0.2)' }}>
                                <table className="modern-table" style={{ margin: 0, borderRadius: 0 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: '3rem' }}>No</th>
                                      {['Kota / Kabupaten', 'Total Pesanan', ...(showReturn ? ['Return', '% Return'] : []), ...(showGagalKirim ? ['Gagal Kirim', '% Gagal Kirim'] : [])].map(col => (
                                        <th key={col} onClick={() => handleCitySortClick(provObj.province, col)} style={{ cursor: 'pointer', textAlign: col === 'Kota / Kabupaten' ? 'left' : 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: col === 'Kota / Kabupaten' ? 'flex-start' : 'center' }}>
                                            <span>{col}</span><CitySortIcon province={provObj.province} column={col} />
                                          </div>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedCities.map((cityObj, idx) => {
                                      const cRetPct = cityObj.totalOrders > 0 ? (cityObj.totalReturn / cityObj.totalOrders) * 100 : 0;
                                      const cGkPct = cityObj.totalOrders > 0 ? (cityObj.totalGagalKirim / cityObj.totalOrders) * 100 : 0;
                                      const cMasalah = cityObj.totalReturn + cityObj.totalGagalKirim;
                                      return (
                                        <tr key={cityObj.city}>
                                          <td style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{idx + 1}</td>
                                          <td style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{cityObj.city}</td>
                                          <td style={{ textAlign: 'center', fontSize: '0.8125rem' }}>{cityObj.totalOrders}</td>
                                          {showReturn && <>
                                            <td style={{ textAlign: 'center', fontSize: '0.8125rem' }}><ClickableCount count={cityObj.totalReturn} color="#fbbf24" orders={cityObj.returnOrders} label={`Return — ${provObj.province} / ${cityObj.city}`} /></td>
                                            <td style={{ textAlign: 'center', fontSize: '0.8125rem', color: cRetPct > 5 ? '#f87171' : 'var(--text-tertiary)' }}>{cRetPct.toFixed(1)}%</td>
                                          </>}
                                          {showGagalKirim && <>
                                            <td style={{ textAlign: 'center', fontSize: '0.8125rem' }}><ClickableCount count={cityObj.totalGagalKirim} color="#fb923c" orders={cityObj.gagalKirimOrders} label={`Gagal Kirim — ${provObj.province} / ${cityObj.city}`} /></td>
                                            <td style={{ textAlign: 'center', fontSize: '0.8125rem', color: cGkPct > 5 ? '#f87171' : 'var(--text-tertiary)' }}>{cGkPct.toFixed(1)}%</td>
                                          </>}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default ProductAnalysis;
