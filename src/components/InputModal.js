import React, { useMemo, useState, useCallback } from "react";
import {
  Package, ChevronDown, ChevronRight, Save, Search,
  CheckCircle2, Circle, Layers, Zap, Filter, X, Loader2,
  AlertTriangle, Check
} from 'lucide-react';
import { useApiData, useModalValues } from '../hooks/useApiData';
import { useStore } from '../contexts/StoreContext';
import { useNotification } from '../contexts/NotificationContext';
import VariationMultiSelect, { isVarMatch, formatDisplayName } from './VariationMultiSelect';

function InputModal() {
  const { addNotification } = useNotification();
  const { activeStoreId } = useStore();
  const { data: ordersData, loading: loadingOrders } = useApiData('skuCatalog', activeStoreId);
  const { modalValues, setModalValues, loading: loadingModal, saveAll } = useModalValues(activeStoreId);

  // ─── Data Processing ───────────────────────────────────────────────
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
      const variationRaw = order['Variation'] || order['SKU Name'];
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
      // Remove phantom empty variations if named variations exist for the same skuId
      const skusWithNamedVars = new Set();
      val.variations.forEach(v => {
        if (v.skuId && v.variation) {
          skusWithNamedVars.add(v.skuId);
        }
      });
      if (skusWithNamedVars.size > 0) {
        val.variations = val.variations.filter(v => !(v.skuId && !v.variation && skusWithNamedVars.has(v.skuId)));
      }

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
  const [appliedSkus, setAppliedSkus] = useState({});
  const [recentlyFilledKeys, setRecentlyFilledKeys] = useState(() => new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── Save all to DB ───────────────────────────────────────────────
  async function handleSaveAll() {
    if (!isDirty && !isSaving) {
      addNotification?.({
        type: 'info',
        message: 'Tidak ada perubahan baru untuk disimpan. Semua nilai HPP sudah tersimpan di database.',
        duration: 3500
      });
      return;
    }
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
      addNotification?.({
        type: 'success',
        message: '✓ Nilai HPP berhasil disimpan ke database!',
        duration: 4000
      });
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      addNotification?.({
        type: 'error',
        message: 'Gagal menyimpan HPP: ' + (err?.message || 'Terjadi kesalahan'),
        duration: 5000
      });
    }
    setIsSaving(false);
  }

  // ─── Helpers ───────────────────────────────────────────────────────
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
    const distinct = Array.from(new Set(allVariations.map(v => (v || '').trim()).filter(Boolean))).sort();
    if (distinct.length > 1) {
      return [{ index: 0, values: distinct }];
    }
    return [];
  }

  function getFilteredVariationTypes(allVariations, activeVariations) {
    if (!activeVariations || activeVariations.length === 0) return [];
    const baseTypes = getVariationTypes(allVariations);
    if (baseTypes.length === 0) return [];

    const activeVarStrings = activeVariations.map(v => v.variation);
    return baseTypes.map(({ index, values }) => {
      const activeVals = new Set();
      activeVarStrings.forEach(v => {
        let parts = v.split(' / ');
        if (parts.length === 1) parts = v.split(',');
        parts = parts.map(p => p.trim());
        if (parts[index]) activeVals.add(parts[index]);
      });
      return {
        index,
        values: values.filter(val => activeVals.has(val)),
      };
    }).filter(dim => dim.values.length > 0);
  }

  function toggleExpand(sku) {
    setExpandedSkus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
        setBulkInputs((prevBulk) => { const newBulk = { ...prevBulk }; delete newBulk[sku]; return newBulk; });
        setRecentlyFilledKeys(prevKeys => {
          const next = new Set(prevKeys);
          for (const k of next) {
            if (k.startsWith(sku + '||')) next.delete(k);
          }
          return next;
        });
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
    setRecentlyFilledKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setIsDirty(true);
  }

  const filledVariationCountBySku = useMemo(() => {
    const counts = new Map();
    for (const k of Object.keys(modalValues)) {
      const sepIdx = k.indexOf('||');
      if (sepIdx > 0 && modalValues[k]) {
        const sku = k.slice(0, sepIdx);
        counts.set(sku, (counts.get(sku) || 0) + 1);
      }
    }
    return counts;
  }, [modalValues]);

  const invalidSkus = useMemo(() => {
    const invalidSet = new Set();
    groupedBySellerSku.forEach(({ sellerSku, variations }) => {
      const filledCount = filledVariationCountBySku.get(sellerSku) || 0;
      if (filledCount > 0 && filledCount < variations.length) invalidSet.add(sellerSku);
    });
    return invalidSet;
  }, [groupedBySellerSku, filledVariationCountBySku]);

  function hasAnyVariationFilled(sellerSku) {
    return (filledVariationCountBySku.get(sellerSku) || 0) > 0;
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
    if (!bulk || !bulk.value) {
      addNotification?.({
        type: 'info',
        message: 'Masukkan nilai HPP terlebih dahulu pada bar Isi Masal.',
        duration: 3500
      });
      return;
    }
    const variations = groupedBySellerSku.find(g => g.sellerSku === sellerSku)?.variations || [];
    if (variations.length === 0) return;

    // Filter target variations based on filterMode
    const targetVariations = variations.filter(v => {
      if (filterMode === 'all') return true;
      const key = sellerSku + '||' + v.skuId + '||' + v.variation;
      const isFilled = Boolean(modalValues[key]);
      if (filterMode === 'filled') return isFilled;
      if (filterMode === 'unfilled') return !isFilled || recentlyFilledKeys.has(key);
      return true;
    });

    const variationTypes = getFilteredVariationTypes(variations, targetVariations);
    const selections = bulk.selections || [];
    const keysToUpdate = [];

    targetVariations.forEach(({ skuId, variation }) => {
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
            if (!isVarMatch(sel, parts[i])) { match = false; break; }
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
    setRecentlyFilledKeys((prev) => {
      const next = new Set(prev);
      keysToUpdate.forEach(k => next.add(k));
      return next;
    });
    setIsDirty(true);

    // Flash saved feedback
    setFlashSaved(sellerSku);
    setTimeout(() => setFlashSaved(null), 1500);
    setAppliedSkus(prev => ({ ...prev, [sellerSku]: true }));
    setTimeout(() => setAppliedSkus(prev => ({ ...prev, [sellerSku]: false })), 2000);

    addNotification?.({
      type: 'success',
      message: `✓ Nilai HPP diterapkan ke ${keysToUpdate.length} variasi pada "${sellerSku}". Klik "Simpan" di atas untuk menyimpan permanen.`,
      duration: 3500
    });
  }

  // ─── Computed Stats & Filtering ────────────────────────────────────
  const getSkuFillStatus = useCallback((sellerSku, variations) => {
    if (modalValues[sellerSku]) return 'filled';
    const filledCount = filledVariationCountBySku.get(sellerSku) || 0;
    if (filledCount >= variations.length && filledCount > 0) return 'filled';
    if (filledCount > 0) return 'partial';
    return 'unfilled';
  }, [modalValues, filledVariationCountBySku]);

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
        formatDisplayName(sellerSku).toLowerCase().includes(q) ||
        (productName && productName.toLowerCase().includes(q))
      );
    }
    // Fill status filter
    if (filterMode !== 'all') {
      items = items.filter(({ sellerSku, variations }) => {
        const status = getSkuFillStatus(sellerSku, variations);
        if (filterMode === 'filled') return status === 'filled';
        if (filterMode === 'unfilled') return status === 'unfilled' || status === 'partial' || variations.some(v => recentlyFilledKeys.has(sellerSku + '||' + v.skuId + '||' + v.variation)) || recentlyFilledKeys.has(sellerSku);
        return true;
      });
    }
    return items;
  }, [groupedBySellerSku, searchQuery, filterMode, getSkuFillStatus, recentlyFilledKeys]);

  // Channel icon helper
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

  // Progress percentage
  const progressPercent = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  // Toggle expand all
  const allExpanded = useMemo(() => {
    const multiVarSkus = filteredSkus.filter(g => g.variations.length > 1);
    return multiVarSkus.length > 0 && multiVarSkus.every(g => expandedSkus.has(g.sellerSku));
  }, [filteredSkus, expandedSkus]);

  const toggleExpandAll = () => {
    const multiVarSkus = filteredSkus.filter(g => g.variations.length > 1);
    if (allExpanded) {
      setExpandedSkus(prev => {
        const next = new Set(prev);
        multiVarSkus.forEach(g => next.delete(g.sellerSku));
        return next;
      });
    } else {
      setExpandedSkus(prev => {
        const next = new Set(prev);
        multiVarSkus.forEach(g => next.add(g.sellerSku));
        return next;
      });
    }
  };

  // Keyboard Navigation: Enter advances to next card input
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('.im-input:not([disabled])'));
      const index = inputs.indexOf(e.target);
      if (index >= 0 && index < inputs.length - 1) {
        inputs[index + 1].focus();
        inputs[index + 1].select();
      }
    }
  };

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
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="glass-card"
              style={{
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', flexShrink: 0 }}>&nbsp;</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="skeleton" style={{ height: '0.875rem', width: `${40 + Math.random() * 30}%`, marginBottom: '0.375rem' }}>&nbsp;</div>
                  <div className="skeleton" style={{ height: '0.625rem', width: '25%' }}>&nbsp;</div>
                </div>
              </div>
              <div className="skeleton" style={{ height: '2.1rem', width: '9rem', borderRadius: '6px', flexShrink: 0 }}>&nbsp;</div>
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
            disabled={isSaving || (!isDirty && !saveSuccess)}
            style={{
              padding: '0.45rem 1.15rem',
              fontSize: '0.8125rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              opacity: (!isDirty && !saveSuccess) ? 0.45 : 1,
              background: saveSuccess ? 'var(--gradient-success)' : undefined,
              transition: 'all 0.25s ease',
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

      {/* Toolbar: Search + Filter + Expand All */}
      <div className="im-toolbar">
        <div className="im-search-box">
          <Search size={16} className="im-search-icon" />
          <input
            type="text"
            placeholder="Cari SKU atau nama produk..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <div className="im-filter-tabs">
            {[
              { key: 'all', label: 'Semua', count: stats.total },
              { key: 'unfilled', label: 'Belum Terisi', count: stats.unfilled + stats.partial },
              { key: 'filled', label: 'Terisi', count: stats.filled },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`im-filter-tab ${filterMode === tab.key ? 'active' : ''}`}
                onClick={() => {
                  setFilterMode(tab.key);
                  setRecentlyFilledKeys(new Set());
                }}
              >
                {tab.label}
                <span className="im-filter-count">({tab.count})</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleExpandAll}
            title={allExpanded ? "Tutup Semua Variasi" : "Buka Semua Variasi"}
            style={{
              height: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: allExpanded ? '#eef2ff' : '#ffffff',
              color: allExpanded ? '#4f46e5' : '#475569',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={13} />
            <span>{allExpanded ? 'Tutup Variasi' : 'Buka Variasi'}</span>
          </button>
        </div>
      </div>

      {/* SKU Cards (Single Clean Column) */}
      <div className="im-cards-grid">
        {filteredSkus.length === 0 ? (
          <div className="im-empty">
            <Filter size={38} strokeWidth={1.5} style={{ margin: '0 auto', opacity: 0.6 }} />
            <p style={{ fontWeight: 600, color: '#475569' }}>Tidak ada SKU yang cocok</p>
            {(searchQuery || filterMode !== 'all') && (
              <button
                className="btn-secondary"
                style={{ marginTop: '0.65rem', fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}
                onClick={() => { setSearchQuery(''); setFilterMode('all'); setRecentlyFilledKeys(new Set()); }}
              >
                Reset Pencarian & Filter
              </button>
            )}
          </div>
        ) : (
          filteredSkus.map(({ sellerSku, variations, noSku, productName }) => {
            const isExpanded = expandedSkus.has(sellerSku);
            const mainModalValue = modalValues[sellerSku] || '';
            const variationCount = variations.length;
            const anyVariationFilled = hasAnyVariationFilled(sellerSku);
            const filledCount = filledVariationCountBySku.get(sellerSku) || 0;
            const isInvalid = invalidSkus.has(sellerSku);

            // Filter variations based on filterMode
            const targetVariations = variations.filter(v => {
              if (filterMode === 'all') return true;
              const key = sellerSku + '||' + v.skuId + '||' + v.variation;
              const isFilled = Boolean(modalValues[key]);
              if (filterMode === 'filled') return isFilled;
              if (filterMode === 'unfilled') return !isFilled || recentlyFilledKeys.has(key);
              return true;
            });

            const variationTypes = getFilteredVariationTypes(variations, targetVariations);
            const bulk = bulkInputs[sellerSku] || { selections: [], value: '' };
            const chInfo = getChannelIcon(sellerSku, variations);
            const fillStatus = getSkuFillStatus(sellerSku, variations);
            const isFlashSaved = flashSaved === sellerSku;
            const rawName = noSku
              ? (productName || sellerSku.replace('__NSKU__', ''))
              : sellerSku;
            const displayName = formatDisplayName(rawName);

            return (
              <div
                key={sellerSku}
                className={`im-card im-card-${fillStatus} ${isInvalid ? 'im-card-invalid' : ''} ${isFlashSaved ? 'im-card-flash' : ''}`}
              >
                {/* Card Main Row */}
                <div
                  className="im-card-header"
                  onClick={() => variationCount > 1 && toggleExpand(sellerSku)}
                  style={{ cursor: variationCount > 1 ? 'pointer' : 'default' }}
                >
                  <div className="im-card-left">
                    {chInfo && (
                      <img
                        src={chInfo.iconSrc}
                        alt={chInfo.channel}
                        title={chInfo.channel}
                        className="im-channel-icon"
                        loading="lazy"
                      />
                    )}
                    <div className="im-sku-info">
                      <div className="im-sku-title-row">
                        {noSku && (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                              color: '#fff',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            Tanpa SKU
                          </span>
                        )}
                        <span
                          className="im-sku-name"
                          title={sellerSku !== displayName ? `SKU: ${sellerSku}` : undefined}
                        >
                          {displayName}
                        </span>
                        {fillStatus === 'filled' && (
                          <CheckCircle2 size={15} className="im-check" />
                        )}
                        {variationCount > 1 && (
                          <span
                            className="im-var-badge"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(sellerSku);
                            }}
                            title="Klik untuk melihat rincian variasi"
                          >
                            <Layers size={11} />
                            <span>
                              {filterMode === 'unfilled'
                                ? `${Math.max(0, variationCount - filledCount)} belum terisi`
                                : filterMode === 'filled'
                                ? `${filledCount} terisi`
                                : `${variationCount} variasi`}
                            </span>
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                        )}
                      </div>
                      {!noSku && productName && productName !== sellerSku && (
                        <div className="im-sku-desc" title={productName}>
                          {productName}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="im-card-right" onClick={(e) => e.stopPropagation()}>
                    {variationCount <= 1 || !anyVariationFilled ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Rp0"
                        className={`im-input ${anyVariationFilled ? 'im-input-disabled' : ''}`}
                        value={anyVariationFilled ? '' : mainModalValue}
                        onInput={(e) => { if (!anyVariationFilled) handleMainInputChange(sellerSku, e); }}
                        onKeyDown={handleInputKeyDown}
                        disabled={anyVariationFilled}
                      />
                    ) : (
                      <span
                        className="im-multi-label"
                        onClick={() => toggleExpand(sellerSku)}
                        style={{ cursor: 'pointer' }}
                        title="Klik untuk melihat atau mengubah nilai variasi"
                      >
                        Multi-variasi ({filledCount}/{variationCount})
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Invalid Warning */}
                {isInvalid && (
                  <div className="im-warning">
                    <AlertTriangle size={14} />
                    <span>Perhatian: Isi seluruh nilai variasi atau kosongkan semua ({filledCount} dari {variationCount} terisi)</span>
                  </div>
                )}

                {/* Expanded Variations */}
                {isExpanded && variationCount > 1 && (
                  <div className="im-variations">
                    {filterMode === 'unfilled' && (
                      <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#eef2ff', padding: '0.35rem 0.65rem', borderRadius: '6px' }}>
                        <Filter size={12} />
                        <span>Menampilkan {targetVariations.length} variasi belum terisi (dari {variationCount} total)</span>
                      </div>
                    )}

                    {/* Bulk Edit Bar */}
                    <div className="im-bulk-bar">
                      <Zap size={14} className="im-bulk-icon" />
                      <span className="im-bulk-label">Isi Masal:</span>
                      {variationTypes.length > 0 ? (
                        variationTypes.map(({ values }, idx) => (
                          <VariationMultiSelect
                            key={idx}
                            values={values}
                            selected={bulk.selections[idx]}
                            onChange={(vals) => handleBulkDropdownChange(sellerSku, idx, vals)}
                            allLabel="Semua"
                          />
                        ))
                      ) : null}
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Rp0"
                        className="im-bulk-input"
                        value={bulk.value}
                        onChange={(e) => handleBulkValueChange(sellerSku, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applyBulkInput(sellerSku);
                          }
                        }}
                      />
                      <button
                        className="im-bulk-apply"
                        onClick={() => applyBulkInput(sellerSku)}
                        disabled={!bulk.value}
                      >
                        <Check size={12} />
                        Terapkan
                      </button>
                    </div>

                    {/* Variation Items */}
                    {targetVariations.length === 0 ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', margin: '0.5rem 0' }}>
                        ✓ Seluruh variasi pada produk ini telah terisi
                      </div>
                    ) : (
                      <div className="im-var-list">
                        {targetVariations.filter(({ variation }) => {
                          if (variationTypes.length === 0) return true;
                          const selections = bulk.selections || [];
                          let parts = variation.split(' / ');
                          if (parts.length === 1) parts = variation.split(',');
                          parts = parts.map(p => p.trim());
                          if (parts.length !== variationTypes.length) return true;
                          for (let i = 0; i < variationTypes.length; i++) {
                            const sel = selections[i] || 'Semua Variasi';
                            if (!isVarMatch(sel, parts[i])) return false;
                          }
                          return true;
                        }).map(({ skuId, variation }) => {
                          const key = sellerSku + '||' + skuId + '||' + variation;
                          const val = modalValues[key] || '';
                          return (
                            <div key={key} className={`im-var-item ${val ? 'im-var-filled' : ''}`}>
                              <div className="im-var-detail">
                                <span className="im-var-name">{variation || 'Default'}</span>
                                {skuId && <span className="im-var-skuid">{skuId}</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="Rp0"
                                  className="im-input im-input-sm"
                                  value={val}
                                  onInput={(e) => handleVariationInputChange(sellerSku, skuId, variation, e)}
                                  onKeyDown={handleInputKeyDown}
                                />
                                {val && <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
