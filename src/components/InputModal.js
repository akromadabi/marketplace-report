import React, { useMemo, useState, useCallback } from "react";
import {
  Package, ChevronDown, ChevronRight, Save, Search,
  CheckCircle2, Circle, Layers, Zap, Filter, X, Loader2
} from 'lucide-react';
import { useApiData, useModalValues } from '../hooks/useApiData';

function InputModal() {
  const { data: ordersData, loading: loadingOrders } = useApiData('orders');
  const { modalValues, setModalValues, loading: loadingModal, saveAll, saveSingle } = useModalValues();
  // ─── Data Processing (unchanged logic) ─────────────────────────────
  const skuIdToChannel = useMemo(() => {
    const map = new Map();
    const sellerSkuToChannel = new Map();
    ordersData.forEach((order) => {
      const skuIdRaw = order["SKU ID"];
      const sellerSkuRaw = order["Seller SKU"];
      const channel = order["Channel Marketplace"] || "";
      if (skuIdRaw !== undefined && skuIdRaw !== null) {
        const skuId = skuIdRaw.toString().trim();
        if (skuId) map.set(skuId, channel);
      }
      if (sellerSkuRaw !== undefined && sellerSkuRaw !== null) {
        const sellerSku = sellerSkuRaw.toString().trim();
        if (sellerSku) sellerSkuToChannel.set(sellerSku, channel);
      }
    });
    return { skuIdToChannel: map, sellerSkuToChannel };
  }, [ordersData]);

  const platformIcons = {
    Tiktok: "https://static.vecteezy.com/system/resources/previews/023/986/939/non_2x/tiktok-logo-tiktok-logo-transparent-tiktok-icon-transparent-free-free-png.png",
    Shopee: "https://static.vecteezy.com/system/resources/previews/053/407/516/non_2x/shopee-logo-shopee-icon-transparent-social-media-icons-free-png.png",
    Lazada: "https://static.cdnlogo.com/logos/l/48/lazada-icon800x800.png",
    Tokopedia: "https://freelogopng.com/images/all_img/1691990957tokopedia-icon-png.png",
    Unknown: "https://icons.iconarchive.com/icons/custom-icon-design/flatastic-1/512/delete-icon.png",
  };

  const groupedBySellerSku = useMemo(() => {
    const map = new Map();
    ordersData.forEach((order) => {
      const sellerSkuRaw = order['Seller SKU'];
      const skuIdRaw = order['SKU ID'];
      const variationRaw = order['Variation'];
      const productName = order['Product Name'] || '';
      const sellerSku = sellerSkuRaw ? sellerSkuRaw.toString().trim() : '';
      const skuId = skuIdRaw !== undefined && skuIdRaw !== null ? skuIdRaw.toString().trim() : '';
      const variation = variationRaw !== undefined && variationRaw !== null ? variationRaw.toString().trim() : '';
      // Use sellerSku as key, or fallback to Product Name for products without SKU
      const key = sellerSku || (productName ? '__NSKU__' + productName : '');
      if (key === '') return;
      if (!map.has(key)) map.set(key, { sellerSku: key, productName, noSku: !sellerSku, variations: [] });
      const entry = map.get(key);
      if (!entry.productName && productName) entry.productName = productName;
      const variations = entry.variations;
      if (!variations.some(v => v.skuId === skuId && v.variation === variation)) {
        variations.push({ skuId, variation });
      }
    });
    for (const val of map.values()) {
      val.variations.sort((a, b) => {
        const skuCompare = a.skuId.localeCompare(b.skuId);
        if (skuCompare !== 0) return skuCompare;
        return a.variation.localeCompare(b.variation);
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      // Products with SKU first, then no-SKU
      if (a.noSku !== b.noSku) return a.noSku ? 1 : -1;
      return a.sellerSku.localeCompare(b.sellerSku);
    });
  }, [ordersData]);



  // ─── State ─────────────────────────────────────────────────────────
  const [expandedSkus, setExpandedSkus] = useState(new Set());
  const [bulkInputs, setBulkInputs] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all | filled | unfilled
  const [flashSaved, setFlashSaved] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── Save all to DB ───────────────────────────────────────────────
  async function handleSaveAll() {
    setIsSaving(true);
    try {
      const toSave = {};
      Object.entries(modalValues).forEach(([key, val]) => {
        const num = String(val).replace(/[^0-9]/g, '');
        toSave[key] = num || '0';
      });
      await saveAll(toSave);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // ignore
    }
    setIsSaving(false);
  }

  // ─── Helpers (unchanged logic) ─────────────────────────────────────
  function getVariationTypes(variations) {
    if (!variations || variations.length === 0) return [];
    const allVariations = variations.map(v => v.variation);
    const splitBySlash = allVariations.map(v => v.split(' / '));
    const maxParts = Math.max(...splitBySlash.map(arr => arr.length));
    if (maxParts > 1) {
      const variationTypes = [];
      for (let i = 0; i < maxParts; i++) {
        const vals = new Set();
        splitBySlash.forEach(arr => { if (arr[i]) vals.add(arr[i].trim()); });
        variationTypes.push({ index: i, values: Array.from(vals).sort() });
      }
      return variationTypes;
    }
    const splitByComma = allVariations.map(v => v.split(','));
    const maxPartsComma = Math.max(...splitByComma.map(arr => arr.length));
    if (maxPartsComma > 1) {
      const variationTypes = [];
      for (let i = 0; i < maxPartsComma; i++) {
        const vals = new Set();
        splitByComma.forEach(arr => { if (arr[i]) vals.add(arr[i].trim()); });
        variationTypes.push({ index: i, values: Array.from(vals).sort() });
      }
      return variationTypes;
    }
    return [];
  }

  function toggleExpand(sku) {
    setExpandedSkus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
        setBulkInputs((prevBulk) => { const newBulk = { ...prevBulk }; delete newBulk[sku]; return newBulk; });
      } else {
        newSet.add(sku);
        setBulkInputs((prevBulk) => {
          if (prevBulk[sku]) return prevBulk;
          return { ...prevBulk, [sku]: { selections: [], value: '' } };
        });
      }
      return newSet;
    });
  }

  function handleMainInputChange(sellerSku, e) {
    let value = e.target.value;
    let numericValue = value.toString().replace(/[^0-9]/g, '');
    if (numericValue === '') {
      setModalValues((prev) => { const newObj = { ...prev }; delete newObj[sellerSku]; return newObj; });
      setIsDirty(true);
      return;
    }
    if (numericValue.length > 15) numericValue = numericValue.slice(0, 15);
    const formatted = 'Rp' + Number(numericValue).toLocaleString('id-ID');
    setModalValues((prev) => ({ ...prev, [sellerSku]: formatted }));
    setIsDirty(true);
  }

  function handleVariationInputChange(sellerSku, skuId, variation, e) {
    let value = e.target.value;
    let numericValue = value.toString().replace(/[^0-9]/g, '');
    const key = sellerSku + '||' + skuId + '||' + variation;
    if (numericValue === '') {
      setModalValues((prev) => {
        const newObj = { ...prev };
        delete newObj[key];
        return newObj;
      });
      setIsDirty(true);
      return;
    }
    if (numericValue.length > 15) numericValue = numericValue.slice(0, 15);
    const formatted = 'Rp' + Number(numericValue).toLocaleString('id-ID');
    setModalValues((prev) => {
      const newObj = { ...prev };
      newObj[key] = formatted;
      if (newObj[sellerSku]) delete newObj[sellerSku];
      return newObj;
    });
    setIsDirty(true);
  }

  const invalidSkus = useMemo(() => {
    const invalidSet = new Set();
    groupedBySellerSku.forEach(({ sellerSku, variations }) => {
      const variationKeys = variations.map(({ skuId, variation }) => sellerSku + '||' + skuId + '||' + variation);
      const filledCount = variationKeys.reduce((acc, key) => acc + (modalValues[key] ? 1 : 0), 0);
      if (filledCount > 0 && filledCount < variationKeys.length) invalidSet.add(sellerSku);
    });
    return invalidSet;
  }, [groupedBySellerSku, modalValues]);

  function hasAnyVariationFilled(sellerSku) {
    return Object.keys(modalValues).some(k => k.startsWith(sellerSku + '||'));
  }

  function handleBulkDropdownChange(sellerSku, index, value) {
    setBulkInputs((prev) => {
      const prevEntry = prev[sellerSku] || { selections: [], value: '' };
      const newSelections = [...prevEntry.selections];
      newSelections[index] = value;
      return { ...prev, [sellerSku]: { ...prevEntry, selections: newSelections } };
    });
  }

  function handleBulkValueChange(sellerSku, e) {
    let value = e.target.value;
    let numericValue = value.toString().replace(/[^0-9]/g, '');
    if (numericValue.length > 15) numericValue = numericValue.slice(0, 15);
    const formatted = numericValue === '' ? '' : 'Rp' + Number(numericValue).toLocaleString('id-ID');
    setBulkInputs((prev) => {
      const prevEntry = prev[sellerSku] || { selections: [], value: '' };
      return { ...prev, [sellerSku]: { ...prevEntry, value: formatted } };
    });
  }

  function applyBulkInput(sellerSku) {
    const bulk = bulkInputs[sellerSku];
    if (!bulk || !bulk.value) return;
    const variations = groupedBySellerSku.find(g => g.sellerSku === sellerSku)?.variations || [];
    if (variations.length === 0) return;
    const variationTypes = getVariationTypes(variations);
    const selections = bulk.selections || [];
    const keysToUpdate = [];

    variations.forEach(({ skuId, variation }) => {
      if (variationTypes.length === 0) {
        keysToUpdate.push(sellerSku + '||' + skuId + '||' + variation);
      } else {
        let parts = variation.split(' / ');
        if (parts.length === 1) parts = variation.split(',');
        parts = parts.map(p => p.trim());
        if (parts.length !== variationTypes.length) {
          keysToUpdate.push(sellerSku + '||' + skuId + '||' + variation);
        } else {
          let match = true;
          for (let i = 0; i < variationTypes.length; i++) {
            const sel = selections[i] || 'Semua Variasi';
            if (sel !== 'Semua Variasi' && sel !== parts[i]) { match = false; break; }
          }
          if (match) keysToUpdate.push(sellerSku + '||' + skuId + '||' + variation);
        }
      }
    });

    if (keysToUpdate.length === 0) return;
    setModalValues((prev) => {
      const newObj = { ...prev };
      if (newObj[sellerSku]) delete newObj[sellerSku];
      keysToUpdate.forEach((key) => {
        newObj[key] = bulk.value;
      });
      return newObj;
    });
    setIsDirty(true);

    // Flash saved feedback
    setFlashSaved(sellerSku);
    setTimeout(() => setFlashSaved(null), 1500);
  }

  // ─── Computed Stats & Filtering ────────────────────────────────────
  const getSkuFillStatus = useCallback((sellerSku, variations) => {
    // Check main value first
    if (modalValues[sellerSku]) return 'filled';
    // Check variation values
    const variationKeys = variations.map(({ skuId, variation }) => sellerSku + '||' + skuId + '||' + variation);
    const filledCount = variationKeys.reduce((acc, key) => acc + (modalValues[key] ? 1 : 0), 0);
    if (filledCount === variationKeys.length && filledCount > 0) return 'filled';
    if (filledCount > 0) return 'partial';
    return 'unfilled';
  }, [modalValues]);

  const stats = useMemo(() => {
    let filled = 0, partial = 0, unfilled = 0;
    groupedBySellerSku.forEach(({ sellerSku, variations }) => {
      const status = getSkuFillStatus(sellerSku, variations);
      if (status === 'filled') filled++;
      else if (status === 'partial') partial++;
      else unfilled++;
    });
    return { filled, partial, unfilled, total: groupedBySellerSku.length };
  }, [groupedBySellerSku, getSkuFillStatus]);

  const filteredSkus = useMemo(() => {
    let items = groupedBySellerSku;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(({ sellerSku, productName }) =>
        sellerSku.toLowerCase().includes(q) ||
        (productName && productName.toLowerCase().includes(q))
      );
    }
    // Fill status filter
    if (filterMode !== 'all') {
      items = items.filter(({ sellerSku, variations }) => {
        const status = getSkuFillStatus(sellerSku, variations);
        if (filterMode === 'filled') return status === 'filled';
        if (filterMode === 'unfilled') return status === 'unfilled' || status === 'partial';
        return true;
      });
    }
    return items;
  }, [groupedBySellerSku, searchQuery, filterMode, getSkuFillStatus]);

  // ─── Channel icon helper ──────────────────────────────────────────
  function getChannelIcon(sellerSku, variations) {
    let ch = "";
    if (variations.length > 0) {
      ch = skuIdToChannel.skuIdToChannel.get(variations[0].skuId) || "";
      if (!ch) ch = skuIdToChannel.sellerSkuToChannel.get(sellerSku) || "";
    }
    if (!ch) return null;
    const iconSrc = platformIcons[ch.charAt(0).toUpperCase() + ch.slice(1).toLowerCase()] || platformIcons.Unknown;
    return { iconSrc, channel: ch };
  }

  // ─── Progress percentage ──────────────────────────────────────────
  const progressPercent = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  // ─── Loading State ─────────────────────────────────────────────────
  if (loadingOrders || loadingModal) {
    return (
      <div className="im-container">
        <div className="im-header">
          <div className="im-header-left">
            <div className="im-icon-box">
              <Package size={22} />
            </div>
            <div>
              <h2 className="im-title">Input HPP</h2>
              <p className="im-subtitle">Memuat data produk...</p>
            </div>
          </div>
        </div>

        {/* Skeleton Progress Bar */}
        <div className="im-progress-wrapper">
          <div className="im-progress-bar">
            <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}>&nbsp;</div>
          </div>
        </div>

        {/* Skeleton Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="skeleton" style={{ height: '2.5rem', flex: '1 1 200px', borderRadius: 'var(--radius-md)' }}>&nbsp;</div>
          <div className="skeleton" style={{ height: '2.5rem', width: '14rem', borderRadius: 'var(--radius-md)' }}>&nbsp;</div>
        </div>

        {/* Skeleton Cards */}
        <div className="im-cards-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="glass-card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                animation: `fadeInUp 0.3s ease ${i * 60}ms both`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', flexShrink: 0 }}>&nbsp;</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="skeleton" style={{ height: '0.875rem', width: `${45 + Math.random() * 35}%`, marginBottom: '0.375rem' }}>&nbsp;</div>
                  <div className="skeleton" style={{ height: '0.625rem', width: '30%' }}>&nbsp;</div>
                </div>
              </div>
              <div className="skeleton" style={{ height: '2.25rem', width: '5.5rem', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>&nbsp;</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="im-container">
      {/* Page Header */}
      <div className="im-header">
        <div className="im-header-left">
          <div className="im-icon-box">
            <Package size={22} />
          </div>
          <div>
            <h2 className="im-title">Input HPP</h2>
            <p className="im-subtitle">{stats.total} SKU produk</p>
          </div>
        </div>
        <div className="im-header-stats">
          <div className="im-stat-chip im-stat-filled">
            <CheckCircle2 size={14} />
            <span>{stats.filled} terisi</span>
          </div>
          <div className="im-stat-chip im-stat-unfilled">
            <Circle size={14} />
            <span>{stats.unfilled + stats.partial} belum</span>
          </div>
          <button
            className="btn-primary"
            onClick={handleSaveAll}
            disabled={isSaving || !isDirty}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8125rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              opacity: (!isDirty && !saveSuccess) ? 0.4 : 1,
              background: saveSuccess ? 'var(--gradient-success)' : undefined,
              transition: 'all 0.3s',
            }}
          >
            {isSaving ? (
              <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</>
            ) : saveSuccess ? (
              <><CheckCircle2 size={14} /> Tersimpan!</>
            ) : (
              <><Save size={14} /> Simpan{isDirty ? ' •' : ''}</>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="im-progress-wrapper">
        <div className="im-progress-bar">
          <div className="im-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="im-progress-label">{progressPercent}%</span>
      </div>

      {/* Toolbar: Search + Filter */}
      <div className="im-toolbar">
        <div className="im-search-box">
          <Search size={16} className="im-search-icon" />
          <input
            type="text"
            placeholder="Cari SKU produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="im-search-input"
          />
          {searchQuery && (
            <button className="im-search-clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="im-filter-tabs">
          {[
            { key: 'all', label: 'Semua', count: stats.total },
            { key: 'unfilled', label: 'Belum Terisi', count: stats.unfilled + stats.partial },
            { key: 'filled', label: 'Terisi', count: stats.filled },
          ].map(tab => (
            <button
              key={tab.key}
              className={`im-filter-tab ${filterMode === tab.key ? 'active' : ''}`}
              onClick={() => setFilterMode(tab.key)}
            >
              {tab.label}
              <span className="im-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SKU Cards */}
      <div className="im-cards-grid">
        {filteredSkus.length === 0 ? (
          <div className="im-empty">
            <Filter size={40} strokeWidth={1.5} />
            <p>Tidak ada SKU yang cocok</p>
            {searchQuery && (
              <button className="btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }} onClick={() => { setSearchQuery(''); setFilterMode('all'); }}>
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          filteredSkus.map(({ sellerSku, variations, noSku, productName }) => {
            const isExpanded = expandedSkus.has(sellerSku);
            const mainModalValue = modalValues[sellerSku] || '';
            const variationCount = variations.length;
            const anyVariationFilled = hasAnyVariationFilled(sellerSku);
            const isInvalid = invalidSkus.has(sellerSku);
            const variationTypes = getVariationTypes(variations);
            const bulk = bulkInputs[sellerSku] || { selections: [], value: '' };
            const chInfo = getChannelIcon(sellerSku, variations);
            const fillStatus = getSkuFillStatus(sellerSku, variations);
            const isFlashSaved = flashSaved === sellerSku;
            // Display name for the card
            const displayName = noSku
              ? (productName || sellerSku.replace('__NSKU__', ''))
              : sellerSku;

            return (
              <div key={sellerSku} className={`im-card ${fillStatus === 'filled' ? 'im-card-filled' : ''} ${isInvalid ? 'im-card-invalid' : ''} ${isFlashSaved ? 'im-card-flash' : ''}`}>
                {/* Card Main Row */}
                <div className="im-card-header">
                  <div className="im-card-left">
                    {chInfo && (
                      <img src={chInfo.iconSrc} alt={chInfo.channel} className="im-channel-icon" loading="lazy" />
                    )}
                    <div className="im-sku-info">
                      <div className="im-sku-name">
                        {noSku && (
                          <span style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#fff',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            marginRight: '0.375rem',
                            letterSpacing: '0.02em',
                          }}>Tanpa SKU</span>
                        )}
                        <span style={noSku ? { fontSize: '0.8125rem' } : {}}>{displayName}</span>
                        {fillStatus === 'filled' && <CheckCircle2 size={14} className="im-check" />}
                      </div>
                      {variationCount > 1 && (
                        <button className="im-var-badge" onClick={() => toggleExpand(sellerSku)}>
                          <Layers size={11} />
                          {variationCount} variasi
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="im-card-right">
                    {variationCount <= 1 || !anyVariationFilled ? (
                      <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        placeholder="Rp0"
                        className={`im-input ${anyVariationFilled ? 'im-input-disabled' : ''}`}
                        value={anyVariationFilled ? '' : mainModalValue}
                        onInput={(e) => { if (!anyVariationFilled) handleMainInputChange(sellerSku, e); }}
                        disabled={anyVariationFilled}
                      />
                    ) : (
                      <span className="im-multi-label">Multi-harga</span>
                    )}
                  </div>
                </div>

                {/* Invalid Warning */}
                {isInvalid && (
                  <div className="im-warning">
                    ⚠ Isi seluruh nilai variasi atau kosongkan semua
                  </div>
                )}

                {/* Expanded Variations */}
                {isExpanded && variationCount > 1 && (
                  <div className="im-variations">
                    {/* Bulk Edit Bar */}
                    <div className="im-bulk-bar">
                      <Zap size={14} className="im-bulk-icon" />
                      <span className="im-bulk-label">Isi Masal:</span>
                      {variationTypes.length > 0 ? (
                        variationTypes.map(({ values }, idx) => (
                          <select
                            key={idx}
                            value={bulk.selections[idx] || 'Semua Variasi'}
                            onChange={(e) => handleBulkDropdownChange(sellerSku, idx, e.target.value)}
                            className="im-bulk-select"
                          >
                            <option value="Semua Variasi">Semua</option>
                            {values.map(val => <option key={val} value={val}>{val}</option>)}
                          </select>
                        ))
                      ) : null}
                      <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        placeholder="Rp0"
                        className="im-bulk-input"
                        value={bulk.value}
                        onChange={(e) => handleBulkValueChange(sellerSku, e)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyBulkInput(sellerSku); } }}
                      />
                      <button
                        className="im-bulk-apply"
                        onClick={() => applyBulkInput(sellerSku)}
                        disabled={!bulk.value}
                      >
                        <Save size={13} />
                        Terapkan
                      </button>
                    </div>

                    {/* Variation Items */}
                    <div className="im-var-list">
                      {variations.map(({ skuId, variation }) => {
                        const key = sellerSku + '||' + skuId + '||' + variation;
                        const val = modalValues[key] || '';
                        let channel = skuIdToChannel.skuIdToChannel.get(skuId) || "";
                        if (!channel) channel = skuIdToChannel.sellerSkuToChannel.get(sellerSku) || "";
                        return (
                          <div key={key} className={`im-var-item ${val ? 'im-var-filled' : ''}`}>
                            <div className="im-var-detail">
                              <span className="im-var-name">{variation || 'Default'}</span>
                              {skuId && <span className="im-var-skuid">{skuId}</span>}
                            </div>
                            <input
                              type="text" inputMode="numeric" pattern="[0-9]*"
                              placeholder="Rp0"
                              className="im-input im-input-sm"
                              value={val}
                              onInput={(e) => handleVariationInputChange(sellerSku, skuId, variation, e)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default InputModal;