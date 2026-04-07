import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  Tag, ChevronDown, ChevronRight, Save, Search,
  CheckCircle2, Circle, Layers, Zap, Filter, X,
  Loader2, Upload, Trash2, Download, AlertTriangle,
  FileX, CheckSquare, Square, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  apiGetPromoValues,
  apiUploadPromoProducts,
  apiSavePromoBatch,
  apiDeletePromoItems,
} from '../api';
import { useStore } from '../contexts/StoreContext';

// ─── Format helpers ────────────────────────────────────────────────
function fmtRp(val) {
  if (!val && val !== 0) return '';
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  return isNaN(n) || n === 0 ? '' : 'Rp' + n.toLocaleString('id-ID');
}
function toRawNum(val) {
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
}

// ─── Detect variation types from variation_value (e.g. "Ivory / Allsize") ──
function getVariationTypes(rows) {
  if (!rows || rows.length === 0) return [];
  const allVars = rows.map(r => r.variation_value || '');
  const bySlash = allVars.map(v => v.split(' / '));
  const maxParts = Math.max(...bySlash.map(a => a.length));
  if (maxParts > 1) {
    const types = [];
    for (let i = 0; i < maxParts; i++) {
      const vals = new Set();
      bySlash.forEach(a => { if (a[i]) vals.add(a[i].trim()); });
      types.push({ index: i, values: Array.from(vals).sort() });
    }
    return types;
  }
  const byComma = allVars.map(v => v.split(','));
  const maxComma = Math.max(...byComma.map(a => a.length));
  if (maxComma > 1) {
    const types = [];
    for (let i = 0; i < maxComma; i++) {
      const vals = new Set();
      byComma.forEach(a => { if (a[i]) vals.add(a[i].trim()); });
      types.push({ index: i, values: Array.from(vals).sort() });
    }
    return types;
  }
  return [];
}

// ─── Parse recommended price from TikTok fail reason ────────────────────
function extractRekoPrice(reason) {
  if (!reason) return null;
  // Pattern: "less than or equal to Rp140000"
  const matchLTE = reason.match(/less than or equal to\s*Rp([\d,.]+)/i);
  if (matchLTE) {
    const n = Number(matchLTE[1].replace(/[,.]/g, ''));
    if (!isNaN(n) && n > 0) return n;
  }
  // Pattern: "kurang dari atau sama dengan Rp140000" (Indonesian)
  const matchIDN = reason.match(/(?:kurang dari atau sama dengan|maksimum|max(?:imal)?)\s*Rp([\d,.]+)/i);
  if (matchIDN) {
    const n = Number(matchIDN[1].replace(/[,.]/g, ''));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

// ─── Excel: parse Sales Information ───────────────────────────────
function parseSalesInfoSheet(wb) {
  // Try 'Template' sheet first, fallback to first sheet
  const sheetName = wb.SheetNames.includes('Template') ? 'Template' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // ⚠️ TikTok templates often have stale cached range (e.g. A1:AL5).
  // Force-expand so XLSX reads ALL rows including product data beyond row 5.
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    range.e.r = Math.max(range.e.r, 5000);
    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });

  // Find the header row — the row containing 'product_id'
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (Array.isArray(rows[i]) && rows[i].some(cell => String(cell).toLowerCase() === 'product_id')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headerRow = rows[headerIdx].map(h => String(h).trim().toLowerCase());
  const productIdCol = headerRow.indexOf('product_id');
  const skuIdCol = headerRow.indexOf('sku_id');

  // Skip description rows — find first row where product_id or sku_id is numeric
  let dataStart = headerIdx + 1;
  while (dataStart < rows.length) {
    const r = rows[dataStart];
    const pid = String(r[productIdCol] || '').trim();
    const sid = String(r[skuIdCol] || '').trim();
    if ((pid && /^\d+$/.test(pid)) || (sid && /^\d+$/.test(sid))) break;
    dataStart++;
  }

  return rows.slice(dataStart)
    .map(r => {
      const obj = {};
      headerRow.forEach((k, i) => { obj[k] = r[i] ?? ''; });
      return obj;
    })
    .filter(r => String(r['product_id'] || '').trim() || String(r['sku_id'] || '').trim());
}


// ─── Excel: parse Fail Report ──────────────────────────────────────
function parseFailReport(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row — contains 'SKU ID' / 'sku id'
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(cell => String(cell).toLowerCase().includes('sku id') || String(cell).toLowerCase().includes('sku_id'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return new Map();

  const headerRow = rows[headerIdx].map(h => String(h).trim());
  const dataRows = rows.slice(headerIdx + 1);
  const map = new Map();
  dataRows.forEach(r => {
    const obj = {};
    headerRow.forEach((k, i) => { obj[k] = r[i] ?? ''; });
    // Support both "SKU ID" and "sku_id"
    const skuId = String(obj['SKU ID'] || obj['sku_id'] || obj['sku id'] || '').trim();
    const reason = String(obj['Reason'] || obj['reason'] || obj['Fail Reason'] || '').trim();
    if (skuId) map.set(skuId, reason);
  });
  return map;
}

// ─── Export ──────────────────────────────────────────────────────
function exportCampaign(rows, withStock, filename) {
  const tips = 'Kiat: Periksa persyaratan kampanye sebelum mengunggah file\n\n    1,Performa toko: Memenuhi kriteria pendaftaran kampanye TikTok Shop.\n    2,Toko terpilih: Hanya toko terpilih yang bisa mendaftar ke kampanye ini.\n    3,Kualitas produk: Memenuhi kriteria pendaftaran produk kampanye TikTok.\n    4,Harga kampanye: Harga kampanye harus lebih rendah dari harga eceran.\nBidang wajib diisi: ID produk , ID SKU, harga kampanye.';
  const header = withStock ? ['Product ID', 'SKU ID', 'Campaign price', 'Campaign stock'] : ['Product ID', 'SKU ID', 'Campaign price'];
  const aoa = [[tips], header, ...rows.map(r =>
    withStock ? [r.product_id, r.sku_id, r.harga_promo, r.stok_promo != null ? r.stok_promo : '']
              : [r.product_id, r.sku_id, r.harga_promo]
  )];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'Sheet1');
  XLSX.writeFile(wb2, filename);
}

// ─── Main Component ────────────────────────────────────────────────
function PromoTiktok() {
  const { activeStore } = useStore();
  const storeId = activeStore?.id || null;
  const fileInputRef = useRef(null);
  const failInputRef = useRef(null);
  const downloadRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [failMap, setFailMap] = useState(new Map());
  const [localValues, setLocalValues] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedSkus, setExpandedSkus] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showFailFilter, setShowFailFilter] = useState(false);
  const [failReasonFilters, setFailReasonFilters] = useState(new Set());
  const failFilterRef = useRef(null);
  const uploadRef = useRef(null);
  // Per-card bulk state: { [sellerSku]: { selections: [], harga: '', stok: '' } }
  const [cardBulk, setCardBulk] = useState({});
  const [flashSku, setFlashSku] = useState(null);
  const [ignoreZeroStock, setIgnoreZeroStock] = useState(false);
  const [downloadConfirm, setDownloadConfirm] = useState(null); // { rows, skipped, withStock, filename }

  useEffect(() => {
    function handleClick(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) setShowDownloadMenu(false);
      if (uploadRef.current && !uploadRef.current.contains(e.target)) setShowUploadMenu(false);
      if (failFilterRef.current && !failFilterRef.current.contains(e.target)) setShowFailFilter(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Unique fail reasons for checklist filter
  const uniqueFailReasons = useMemo(() => {
    const set = new Set();
    failMap.forEach(r => { if (r) set.add(r); });
    return Array.from(set).sort();
  }, [failMap]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetPromoValues(storeId);
      setProducts(Array.isArray(data) ? data : []);
    } catch { setProducts([]); }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ─── Group by seller_sku ─────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map();
    products.forEach(p => {
      const key = p.seller_sku || ('__NS__' + p.product_name);
      if (!map.has(key)) map.set(key, { sellerSku: key, noSku: !p.seller_sku, productName: p.product_name || '', rows: [] });
      map.get(key).rows.push(p);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.noSku !== b.noSku) return a.noSku ? 1 : -1;
      return a.sellerSku.localeCompare(b.sellerSku);
    });
  }, [products]);

  // ─── Local value helpers ─────────────────────────────────────
  function getLocal(id, field) {
    if (localValues[id] && field in localValues[id]) return localValues[id][field];
    const p = products.find(x => x.id === id);
    return p ? p[field] : null;
  }

  function onHargaChange(id, e) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setLocalField(id, 'harga_promo', raw === '' ? '' : fmtRp(raw));
  }

  function onStokChange(id, e) {
    setLocalField(id, 'stok_promo', e.target.value.replace(/[^0-9]/g, ''));
  }

  // ─── Fill status ─────────────────────────────────────────────
  const getFillStatus = useCallback((rows) => {
    const anyFilled = rows.some(r => toRawNum(getLocal(r.id, 'harga_promo')) > 0);
    const allFilled = rows.every(r => toRawNum(getLocal(r.id, 'harga_promo')) > 0);
    if (allFilled && anyFilled) return 'filled';
    if (anyFilled) return 'partial';
    return 'unfilled';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValues, products]);

  const stats = useMemo(() => {
    let filled = 0, partial = 0, unfilled = 0;
    grouped.forEach(({ rows }) => {
      const s = getFillStatus(rows);
      if (s === 'filled') filled++; else if (s === 'partial') partial++; else unfilled++;
    });
    return { filled, partial, unfilled, total: grouped.length };
  }, [grouped, getFillStatus]);

  const progressPercent = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  const filteredGroups = useMemo(() => {
    let items = grouped;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(({ sellerSku, productName }) =>
        sellerSku.toLowerCase().includes(q) || (productName && productName.toLowerCase().includes(q))
      );
    }
    if (filterMode !== 'all') {
      items = items.filter(({ rows }) => {
        const s = getFillStatus(rows);
        if (filterMode === 'filled') return s === 'filled';
        if (filterMode === 'unfilled') return s !== 'filled';
        return true;
      });
    }
    // ─── Filter by fail reason ─────────────────────────────────
    if (failReasonFilters.size > 0) {
      items = items.filter(({ rows }) =>
        rows.some(r => {
          const reason = failMap.get(String(r.sku_id));
          return reason && failReasonFilters.has(reason);
        })
      );
    }
    // ─── Filter stok 0 ───────────────────────────────────────
    if (ignoreZeroStock) {
      // Sembunyikan group jika SEMUA variasi stok <= 0 atau null
      items = items.filter(({ rows }) =>
        rows.some(r => Number(r.stok_saat_ini || 0) > 0)
      );
    }
    return items;
  }, [grouped, searchQuery, filterMode, getFillStatus, failReasonFilters, failMap, ignoreZeroStock]);

  // ─── Selection ───────────────────────────────────────────────
  const allVisibleIds = useMemo(() => filteredGroups.flatMap(g => g.rows.map(r => r.id)), [filteredGroups]);
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

  function toggleSelectAll() { setSelectedIds(isAllSelected ? new Set() : new Set(allVisibleIds)); }

  function toggleSelectGroup(rows) {
    const ids = rows.map(r => r.id);
    const allSel = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSel ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function toggleSelectOne(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  // ─── Per-Card Bulk apply ─────────────────────────────────────
  function applyCardBulk(sellerSku, rows) {
    const bulk = cardBulk[sellerSku] || { selections: [], harga: '', stok: '' };
    if (!bulk.harga && bulk.stok === '') return;
    const varTypes = getVariationTypes(rows);
    const selections = bulk.selections || [];

    const targets = rows.filter(p => {
      if (varTypes.length === 0) return true;
      const varStr = p.variation_value || '';
      let parts = varStr.split(' / ');
      if (parts.length === 1) parts = varStr.split(',');
      parts = parts.map(x => x.trim());
      if (parts.length !== varTypes.length) return true;
      for (let i = 0; i < varTypes.length; i++) {
        const sel = selections[i] || 'Semua';
        if (sel !== 'Semua' && sel !== parts[i]) return false;
      }
      return true;
    });

    targets.forEach(p => {
      setLocalValues(prev => {
        const cur = prev[p.id] || {};
        const next = { ...cur };
        if (bulk.harga) next.harga_promo = bulk.harga;
        if (bulk.stok !== '') next.stok_promo = bulk.stok;
        return { ...prev, [p.id]: next };
      });
    });
    setIsDirty(true);
    setCardBulk(prev => ({ ...prev, [sellerSku]: { selections, harga: '', stok: '' } }));
    setFlashSku(sellerSku);
    setTimeout(() => setFlashSku(null), 1500);
  }

  function setCardBulkField(sellerSku, field, value) {
    setCardBulk(prev => {
      const cur = prev[sellerSku] || { selections: [], harga: '', stok: '' };
      return { ...prev, [sellerSku]: { ...cur, [field]: value } };
    });
  }

  function setCardBulkSelection(sellerSku, idx, value) {
    setCardBulk(prev => {
      const cur = prev[sellerSku] || { selections: [], harga: '', stok: '' };
      const selections = [...(cur.selections || [])];
      selections[idx] = value;
      return { ...prev, [sellerSku]: { ...cur, selections } };
    });
  }

  // Direct-set a single localValues field (used by saran harga)
  function setLocalField(id, field, value) {
    setLocalValues(prev => {
      const cur = prev[id] || {};
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
    setIsDirty(true);
  }

  // Apply saran harga from failMap to a list of rows
  function applySaranHarga(rows) {
    rows.forEach(r => {
      const rekoPrice = extractRekoPrice(failMap.get(String(r.sku_id)));
      if (rekoPrice) setLocalField(r.id, 'harga_promo', fmtRp(rekoPrice));
    });
  }

  // ─── Upload ──────────────────────────────────────────────────
  async function handleProductFile(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = parseSalesInfoSheet(wb);

      if (rows.length === 0) {
        alert(
          'File tidak mengandung data produk.\n\n' +
          'Pastikan file yang diupload adalah hasil export Batch Edit dari TikTok Seller Center yang sudah berisi produk (bukan template kosong).\n\n' +
          'Cara mendapatkan file:\n' +
          'TikTok Seller Center → Produkku → Batch Edit → Pilih produk → Download Template'
        );
        setUploading(false);
        return;
      }

      const mapped = rows.map(r => ({
        product_id: String(r['product_id'] || '').trim(),
        sku_id: String(r['sku_id'] || '').trim(),
        product_name: String(r['product_name'] || r['title'] || '').trim(),
        seller_sku: String(r['seller_sku'] || r['seller sku'] || '').trim(),
        variation_value: String(r['variation_value'] || r['variation name'] || r['sku_name'] || '').trim(),
        stok_saat_ini: (() => {
          const raw = String(
            r['available_stock'] || r['Available Stock'] || r['available stock'] ||
            r['kuantitas'] || r['Kuantitas'] ||
            r['quantity'] || r['Quantity'] ||
            r['stock'] || r['Stock'] || r['stok'] || ''
          ).replace(/[^0-9]/g, '');
          return raw === '' ? null : (Number(raw) || 0);
        })(),
      })).filter(r => r.product_id || r.sku_id);

      if (mapped.length === 0) {
        alert('Data terbaca tapi tidak ditemukan Product ID / SKU ID.\nPastikan file tidak kosong dan format kolom benar.');
        setUploading(false);
        return;
      }

      await apiUploadPromoProducts(mapped, storeId);
      await loadProducts();
      alert(`Berhasil mengupload ${mapped.length} baris produk.`);
    } catch (err) {
      alert('Gagal membaca file: ' + err.message);
      console.error(err);
    }
    setUploading(false);
  }

  async function handleFailFile(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      setFailMap(parseFailReport(wb));
    } catch (err) { alert('Gagal membaca fail report: ' + err.message); }
  }

  // ─── Save ────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    try {
      const updates = Object.entries(localValues).map(([id, vals]) => ({
        id: Number(id),
        ...('harga_promo' in vals ? { harga_promo: toRawNum(vals.harga_promo) } : {}),
        ...('stok_promo' in vals ? { stok_promo: vals.stok_promo !== '' ? toRawNum(vals.stok_promo) : null } : {}),
      }));
      if (updates.length > 0) await apiSavePromoBatch(updates, storeId);
      setLocalValues({});
      setIsDirty(false);
      setSaveSuccess(true);
      await loadProducts();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) { alert('Gagal menyimpan: ' + err.message); }
    setIsSaving(false);
  }

  // ─── Delete ──────────────────────────────────────────────────
  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiDeletePromoItems(Array.from(selectedIds), storeId);
      setSelectedIds(new Set());
      setLocalValues(prev => { const next = { ...prev }; selectedIds.forEach(id => delete next[id]); return next; });
      await loadProducts();
    } catch (err) { alert('Gagal menghapus: ' + err.message); }
    setIsDeleting(false);
    setDeleteConfirm(false);
  }

  // ─── Export ──────────────────────────────────────────────────
  function buildExportRows() {
    // Jika ada centang → gunakan yang tercentang saja
    // Jika tidak ada centang → ikuti filter aktif (filteredGroups)
    let base;
    if (selectedIds.size > 0) {
      base = products.filter(p => selectedIds.has(p.id));
    } else {
      // Ambil semua produk dari group yang sedang tampil (sudah difilter fail, stok 0, search, dll)
      const visibleIds = new Set(filteredGroups.flatMap(g => g.rows.map(r => r.id)));
      // Juga filter variasi stok 0 jika ignoreZeroStock aktif
      base = products.filter(p => {
        if (!visibleIds.has(p.id)) return false;
        if (ignoreZeroStock && !(Number(p.stok_saat_ini || 0) > 0)) return false;
        return true;
      });
    }
    return base.filter(p => toRawNum(getLocal(p.id, 'harga_promo')) > 0).map(p => ({
      product_id: p.product_id, sku_id: p.sku_id,
      harga_promo: toRawNum(getLocal(p.id, 'harga_promo')),
      stok_promo: getLocal(p.id, 'stok_promo') !== null && getLocal(p.id, 'stok_promo') !== ''
        ? toRawNum(getLocal(p.id, 'stok_promo')) : null,
    }));
  }

  function triggerExport(withStock) {
    setShowDownloadMenu(false);
    const rows = buildExportRows();
    if (!rows.length) { alert('Tidak ada data harga kampanye yang diisi.'); return; }

    // Hitung produk yang dilewati (ada di base tapi tidak punya harga)
    let base;
    if (selectedIds.size > 0) {
      base = products.filter(p => selectedIds.has(p.id));
    } else {
      const visibleIds = new Set(filteredGroups.flatMap(g => g.rows.map(r => r.id)));
      base = products.filter(p => {
        if (!visibleIds.has(p.id)) return false;
        if (ignoreZeroStock && !(Number(p.stok_saat_ini || 0) > 0)) return false;
        return true;
      });
    }
    const skipped = base.length - rows.length;
    const filename = withStock ? 'KAMPANYE_TIKTOK_STOK.xlsx' : 'KAMPANYE_TIKTOK.xlsx';

    if (skipped > 0) {
      setDownloadConfirm({ rows, skipped, withStock, filename });
    } else {
      exportCampaign(rows, withStock, filename);
    }
  }

  function handleExportNoStock() { triggerExport(false); }
  function handleExportWithStock() { triggerExport(true); }

  function getFailReason(rows) {
    for (const r of rows) { const f = failMap.get(String(r.sku_id)); if (f) return f; }
    return null;
  }

  // ─── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="im-container">
        <div className="im-header">
          <div className="im-header-left">
            <div className="im-icon-box"><Tag size={22} /></div>
            <div><h2 className="im-title">Kampanye</h2><p className="im-subtitle">Memuat data...</p></div>
          </div>
        </div>
        <div className="im-cards-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', animation: `fadeInUp 0.3s ease ${i * 60}ms both` }}>
              <div className="skeleton" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem', flexShrink: 0 }}>&nbsp;</div>
              <div style={{ flex: 1 }}><div className="skeleton" style={{ height: '0.75rem', width: '45%', marginBottom: '0.3rem' }}>&nbsp;</div><div className="skeleton" style={{ height: '0.625rem', width: '25%' }}>&nbsp;</div></div>
              <div className="skeleton" style={{ height: '2rem', width: '9rem', borderRadius: 'var(--radius-md)' }}>&nbsp;</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <div className="im-container">

      {/* ══ HEADER ══ */}
      <div className="im-header">
        <div className="im-header-left">
          <div className="im-icon-box"><Tag size={22} /></div>
          <div>
            <h2 className="im-title">Kampanye</h2>
            <p className="im-subtitle">{stats.total} SKU · {stats.filled} terisi</p>
          </div>
        </div>
        <div className="im-header-stats">

          {/* ── Upload dropdown ── */}
          <div ref={uploadRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUploadMenu(v => !v)}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', background: failMap.size > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-glass)', border: `1px solid ${failMap.size > 0 ? 'rgba(239,68,68,0.25)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: failMap.size > 0 ? '#f87171' : 'var(--text-secondary)', transition: 'all 0.15s' }}
            >
              {uploading
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Upload...</>
                : <><Upload size={13} /> Upload{products.length > 0 ? ` (${products.length})` : ''}{failMap.size > 0 ? ` · ⚠${failMap.size}` : ''}</>
              }
              <ChevronDown size={12} style={{ transform: showUploadMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showUploadMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 0.375rem)', left: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '185px', zIndex: 50, overflow: 'hidden' }}>
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowUploadMenu(false); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '0.625rem 0.875rem', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Produk</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Sales Information TikTok</span>
                </button>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 0.875rem' }} />
                <button
                  onClick={() => { failInputRef.current?.click(); setShowUploadMenu(false); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '0.625rem 0.875rem', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: failMap.size > 0 ? '#f87171' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <FileX size={13} /> Fail Report
                    {failMap.size > 0 && <span style={{ fontSize: '0.625rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '0.05rem 0.35rem', borderRadius: '0.2rem', fontWeight: 700 }}>{failMap.size}</span>}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                    {failMap.size > 0 ? 'Klik × di bawah untuk hapus' : 'Upload laporan gagal TikTok'}
                  </span>
                </button>
                {failMap.size > 0 && (
                  <>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 0.875rem' }} />
                    <button
                      onClick={() => { setFailMap(new Map()); setFailReasonFilters(new Set()); setShowUploadMenu(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', width: '100%', padding: '0.5rem 0.875rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: '#f87171', transition: 'background 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <X size={12} /> Hapus Data Fail
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleProductFile} />
          <input ref={failInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFailFile} />

          {/* Fail reason filter dropdown — only when fail data loaded */}
          {failMap.size > 0 && uniqueFailReasons.length > 0 && (
            <div ref={failFilterRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFailFilter(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.625rem', background: failReasonFilters.size > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-glass)', border: `1px solid ${failReasonFilters.size > 0 ? 'rgba(239,68,68,0.35)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: failReasonFilters.size > 0 ? '#f87171' : 'var(--text-secondary)' }}
              >
                <Filter size={12} />
                {failReasonFilters.size > 0 ? `${failReasonFilters.size} alasan` : 'Filter Alasan'}
                <ChevronDown size={11} style={{ transform: showFailFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showFailFilter && (
                <div style={{ position: 'absolute', top: 'calc(100% + 0.375rem)', left: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '260px', maxHeight: '280px', overflowY: 'auto', zIndex: 60, padding: '0.5rem 0' }}>
                  <div style={{ padding: '0.25rem 0.75rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-medium)', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Filter Alasan Gagal</span>
                    {failReasonFilters.size > 0 && (
                      <button onClick={() => setFailReasonFilters(new Set())} style={{ fontSize: '0.625rem', color: '#6c5ce7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset</button>
                    )}
                  </div>
                  {uniqueFailReasons.map(reason => (
                    <label key={reason} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.375rem 0.875rem', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={failReasonFilters.has(reason)}
                        onChange={() => {
                          setFailReasonFilters(prev => {
                            const next = new Set(prev);
                            next.has(reason) ? next.delete(reason) : next.add(reason);
                            return next;
                          });
                        }}
                        style={{ marginTop: '0.125rem', accentColor: '#f87171', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{reason}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* Download dropdown */}
          <div ref={downloadRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDownloadMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.25)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#6c5ce7' }}
            >
              <Download size={13} /> Download
              <ChevronDown size={12} style={{ transform: showDownloadMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showDownloadMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 0.375rem)', right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '155px', zIndex: 50, overflow: 'hidden' }}>
                {[{ label: 'Tanpa Stok', sub: '3 kolom', fn: handleExportNoStock }, { label: 'Dengan Stok', sub: '4 kolom', fn: handleExportWithStock }].map(item => (
                  <button key={item.label} onClick={item.fn}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '0.625rem 0.875rem', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-glass-hover)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{item.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save */}
          <button className="btn-primary" onClick={handleSave} disabled={isSaving || !isDirty}
            style={{ padding: '0.4rem 1rem', fontSize: '0.8125rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: !isDirty && !saveSuccess ? 0.4 : 1, background: saveSuccess ? 'var(--gradient-success)' : undefined, transition: 'all 0.3s' }}
          >
            {isSaving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Simpan...</>
              : saveSuccess ? <><CheckCircle2 size={13} /> Tersimpan!</>
              : <><Save size={13} /> Simpan{isDirty ? ' •' : ''}</>}
          </button>
        </div>
      </div>

      {/* ══ PROGRESS ══ */}
      <div className="im-progress-wrapper">
        <div className="im-progress-bar"><div className="im-progress-fill" style={{ width: `${progressPercent}%` }} /></div>
        <span className="im-progress-label">{progressPercent}%</span>
      </div>

      {/* ══ TOOLBAR ══ */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <button onClick={toggleSelectAll}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.625rem', background: isAllSelected ? 'rgba(108,92,231,0.08)' : 'var(--bg-glass)', border: `1px solid ${isAllSelected ? 'rgba(108,92,231,0.3)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: isAllSelected ? '#6c5ce7' : 'var(--text-secondary)' }}
        >
          {isAllSelected ? <CheckSquare size={13} /> : <Square size={13} />}
          {selectedIds.size > 0 ? `${selectedIds.size} terpilih` : 'Pilih Semua'}
        </button>
        <button onClick={loadProducts}
          style={{ padding: '0.4rem 0.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>

        {/* Toggle Abaikan Stok 0 */}
        <button
          onClick={() => setIgnoreZeroStock(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.625rem', background: ignoreZeroStock ? 'rgba(245,158,11,0.1)' : 'var(--bg-glass)', border: `1px solid ${ignoreZeroStock ? 'rgba(245,158,11,0.4)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: ignoreZeroStock ? '#f59e0b' : 'var(--text-secondary)', transition: 'all 0.15s' }}
          title="Sembunyikan produk yang seluruh variasinya memiliki stok 0"
        >
          {ignoreZeroStock ? <CheckSquare size={13} /> : <Square size={13} />}
          Abaikan Stok 0
        </button>

        <div style={{ flex: 1 }} />
        {selectedIds.size > 0 && (
          <button onClick={() => setDeleteConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.625rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, color: '#f87171' }}
          >
            <Trash2 size={13} /> Hapus ({selectedIds.size})
          </button>
        )}
      </div>

      {/* ══ SEARCH + FILTER ══ */}
      <div className="im-toolbar">
        <div className="im-search-box">
          <Search size={16} className="im-search-icon" />
          <input type="text" placeholder="Cari SKU atau nama produk..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="im-search-input" />
          {searchQuery && <button className="im-search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
        </div>
        <div className="im-filter-tabs">
          {[
            { key: 'all', label: 'Semua', count: stats.total },
            { key: 'unfilled', label: 'Belum', count: stats.unfilled + stats.partial },
            { key: 'filled', label: 'Terisi', count: stats.filled },
          ].map(tab => (
            <button key={tab.key} className={`im-filter-tab ${filterMode === tab.key ? 'active' : ''}`} onClick={() => setFilterMode(tab.key)}>
              {tab.label}<span className="im-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ DELETE CONFIRM ══ */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '340px', width: '90%', textAlign: 'center' }}>
            <AlertTriangle size={28} color="#f59e0b" style={{ margin: '0 auto 0.625rem' }} />
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>Hapus {selectedIds.size} produk?</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.125rem' }}>Data akan dihapus permanen dari database.</p>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteConfirm(false)} disabled={isDeleting} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem' }}>Batal</button>
              <button onClick={handleDelete} disabled={isDeleting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 1rem', background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: '#fff', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                {isDeleting ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Menghapus...</> : <><Trash2 size={13} /> Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DOWNLOAD CONFIRM ══ */}
      {downloadConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '380px', width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={18} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>Ada produk yang belum diisi</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tidak semua harga kampanye terisi</p>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1, padding: '0.625rem 0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{downloadConfirm.rows.length}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>Siap didownload</div>
              </div>
              <div style={{ flex: 1, padding: '0.625rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>{downloadConfirm.skipped}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>Dilewati (belum diisi)</div>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {downloadConfirm.skipped} SKU tidak memiliki harga promo dan tidak akan masuk ke file. Lanjutkan download atau kembali untuk mengisi terlebih dahulu?
            </p>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setDownloadConfirm(null)}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                ← Isi Dulu
              </button>
              <button
                onClick={() => {
                  exportCampaign(downloadConfirm.rows, downloadConfirm.withStock, downloadConfirm.filename);
                  setDownloadConfirm(null);
                }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem', background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: '#fff', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                <Download size={14} /> Tetap Download
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="im-cards-grid">
        {filteredGroups.length === 0 ? (
          <div className="im-empty">
            <Filter size={36} strokeWidth={1.5} />
            <p style={{ marginTop: '0.5rem' }}>
              {products.length === 0 ? 'Belum ada produk. Upload Sales Information dulu.' : 'Tidak ada SKU yang cocok.'}
            </p>
            {searchQuery && <button className="btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }} onClick={() => { setSearchQuery(''); setFilterMode('all'); }}>Reset Filter</button>}
          </div>
        ) : filteredGroups.map(({ sellerSku, noSku, productName, rows }) => {
          const isExpanded = expandedSkus.has(sellerSku);
          const fillStatus = getFillStatus(rows);
          const failReason = getFailReason(rows);
          const displayName = noSku ? (productName || sellerSku.replace('__NS__', '')) : sellerSku;
          const groupIds = rows.map(r => r.id);
          const allGroupSelected = groupIds.every(id => selectedIds.has(id));
          const someGroupSelected = groupIds.some(id => selectedIds.has(id));
          const varTypes = getVariationTypes(rows);
          const bulk = cardBulk[sellerSku] || { selections: [], harga: '', stok: '' };
          const isFlash = flashSku === sellerSku;
          // Total stok saat ini untuk grup
          const totalStock = rows.reduce((sum, r) => sum + (Number(r.stok_saat_ini || 0) || 0), 0);

          return (
            <div key={sellerSku} className={`im-card ${fillStatus === 'filled' ? 'im-card-filled' : ''} ${failReason ? 'im-card-invalid' : ''} ${isFlash ? 'im-card-flash' : ''}`}>
              {/* Card Header */}
              <div className="im-card-header" style={{ gap: '0.5rem' }}>
                {/* Checkbox */}
                <button onClick={() => toggleSelectGroup(rows)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', flexShrink: 0, color: allGroupSelected ? '#6c5ce7' : someGroupSelected ? '#a78bfa' : 'var(--text-tertiary)' }}
                >
                  {allGroupSelected || someGroupSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                </button>

                {/* Name */}
                <div className="im-card-left" style={{ flex: 1, minWidth: 0 }}>
                  <div className="im-sku-info">
                    <div className="im-sku-name">
                      {noSku && <span style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: '0.5625rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '0.2rem' }}>SKU-</span>}
                      <span style={{ fontSize: noSku ? '0.75rem' : '0.8125rem' }}>{displayName}</span>
                      {fillStatus === 'filled' && <CheckCircle2 size={13} className="im-check" />}
                      {failReason && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.5625rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '0.2rem' }} title={failReason}>
                          <AlertTriangle size={9} /> GAGAL
                        </span>
                      )}
                      {totalStock > 0 && (
                        <span style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: '0.25rem' }}>
                          · stok {totalStock.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                    {rows.length > 1 && (
                      <button className="im-var-badge" onClick={() => {
                        setExpandedSkus(prev => {
                          const next = new Set(prev);
                          next.has(sellerSku) ? next.delete(sellerSku) : next.add(sellerSku);
                          return next;
                        });
                      }}>
                        <Layers size={10} />{rows.length} variasi
                        {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Input direct (single var) */}
                {rows.length === 1 && (() => {
                  const singleReko = extractRekoPrice(failMap.get(String(rows[0].sku_id)));
                  return (
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                      <input type="text" inputMode="numeric" placeholder="Harga Promo" className="im-input" style={{ width: '7.5rem' }}
                        value={localValues[rows[0].id]?.harga_promo !== undefined ? localValues[rows[0].id].harga_promo : fmtRp(rows[0].harga_promo || '')}
                        onInput={e => onHargaChange(rows[0].id, e)}
                      />
                      <input type="text" inputMode="numeric" placeholder="Stok (∞)" className="im-input" style={{ width: '5.25rem' }}
                        value={localValues[rows[0].id]?.stok_promo !== undefined ? localValues[rows[0].id].stok_promo : (rows[0].stok_promo != null ? rows[0].stok_promo : '')}
                        onInput={e => onStokChange(rows[0].id, e)}
                      />
                      {singleReko && (
                        <button
                          onClick={() => applySaranHarga(rows)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0.5rem', background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700, color: '#6c5ce7', whiteSpace: 'nowrap' }}
                          title={`Saran harga: ${fmtRp(singleReko)}`}
                        >
                          💡 {fmtRp(singleReko)}
                        </button>
                      )}
                    </div>
                  );
                })()}
                {rows.length > 1 && !isExpanded && <span className="im-multi-label">Multi-variasi</span>}
              </div>

              {/* Fail detail — removed block, reason shown per variation row */}

              {/* Expanded Variations */}
              {isExpanded && rows.length > 1 && (
                <div className="im-variations">
                  {/* ── Isi Masal Bar (like InputModal) ── */}
                  <div className="im-bulk-bar">
                    <Zap size={14} className="im-bulk-icon" />
                    <span className="im-bulk-label">Isi Masal:</span>

                    {/* Variation dropdowns */}
                    {varTypes.map(({ values }, idx) => (
                      <select
                        key={idx}
                        value={bulk.selections[idx] || 'Semua'}
                        onChange={e => setCardBulkSelection(sellerSku, idx, e.target.value)}
                        className="im-bulk-select"
                      >
                        <option value="Semua">Semua</option>
                        {values.map(val => <option key={val} value={val}>{val}</option>)}
                      </select>
                    ))}

                    {/* Harga input */}
                    <input
                      type="text" inputMode="numeric"
                      placeholder="Harga Promo"
                      className="im-bulk-input"
                      style={{ width: '7rem' }}
                      value={bulk.harga}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setCardBulkField(sellerSku, 'harga', raw === '' ? '' : fmtRp(raw));
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') applyCardBulk(sellerSku, rows); }}
                    />

                    {/* Stok input */}
                    <input
                      type="text" inputMode="numeric"
                      placeholder="Stok (∞)"
                      className="im-bulk-input"
                      style={{ width: '5.5rem' }}
                      value={bulk.stok}
                      onChange={e => setCardBulkField(sellerSku, 'stok', e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') applyCardBulk(sellerSku, rows); }}
                    />

                    <button
                      className="im-bulk-apply"
                      onClick={() => applyCardBulk(sellerSku, rows)}
                      disabled={!bulk.harga && bulk.stok === ''}
                    >
                      <Save size={13} /> Terapkan
                    </button>

                    {/* Saran harga — di samping Terapkan, langsung ke semua variasi yg punya saran */}
                    {(() => {
                      const withReko = rows.filter(r => extractRekoPrice(failMap.get(String(r.sku_id))));
                      if (withReko.length === 0) return null;
                      return (
                        <button
                          onClick={() => applySaranHarga(rows)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.625rem', background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700, color: '#6c5ce7', whiteSpace: 'nowrap' }}
                          title={`Terapkan saran harga ke ${withReko.length} variasi`}
                        >
                          💡 Saran ({withReko.length})
                        </button>
                      );
                    })()}
                  </div>

                  {/* Variation list */}
                  <div className="im-var-list">
                    {rows
                      .filter(p => ignoreZeroStock ? Number(p.stok_saat_ini || 0) > 0 : true)
                      .map(p => {
                      const hargaVal = localValues[p.id]?.harga_promo !== undefined ? localValues[p.id].harga_promo : fmtRp(p.harga_promo || '');
                      const stokVal = localValues[p.id]?.stok_promo !== undefined ? localValues[p.id].stok_promo : (p.stok_promo != null ? p.stok_promo : '');
                      const varFail = failMap.get(String(p.sku_id));

                      return (
                        <div key={p.id} className={`im-var-item ${toRawNum(hargaVal) > 0 ? 'im-var-filled' : ''}`}>
                          <button onClick={() => toggleSelectOne(p.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: selectedIds.has(p.id) ? '#6c5ce7' : 'var(--text-tertiary)', flexShrink: 0 }}
                          >
                            {selectedIds.has(p.id) ? <CheckSquare size={13} /> : <Square size={13} />}
                          </button>
                          <div className="im-var-detail" style={{ flex: 1, minWidth: 0 }}>
                            <span className="im-var-name">{p.variation_value || 'Default'}</span>
                            {p.sku_id && (
                              <span className="im-var-skuid">
                                {p.sku_id}
                                {p.stok_saat_ini != null && (
                                  <span style={{ marginLeft: '0.3rem', opacity: 0.7 }}>· {Number(p.stok_saat_ini).toLocaleString('id-ID')} stok</span>
                                )}
                              </span>
                            )}
                            {varFail && (
                              <div style={{ color: '#f87171', fontSize: '0.5625rem', fontWeight: 500, lineHeight: 1.4, marginTop: '0.15rem' }}>
                                ⚠ {varFail}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                            <input type="text" inputMode="numeric" placeholder="Harga Promo" className="im-input im-input-sm" style={{ width: '6.5rem' }}
                              value={hargaVal} onInput={e => onHargaChange(p.id, e)}
                            />
                            <input type="text" inputMode="numeric" placeholder="Stok (∞)" className="im-input im-input-sm" style={{ width: '4.75rem' }}
                              value={stokVal} onInput={e => onStokChange(p.id, e)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PromoTiktok;
