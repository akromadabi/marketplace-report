import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  Tag, ChevronDown, ChevronRight, Save, Search,
  CheckCircle2, Circle, Layers, Zap, Filter, X,
  Loader2, Upload, Trash2, Download, AlertTriangle,
  FileX, CheckSquare, Square, RefreshCw, Bookmark, Plus, Edit2, Calculator
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useModalValues } from '../hooks/useApiData';
import {
  apiGetPromoShopeeValues as apiGetPromoValues,
  apiUploadPromoShopeeProducts as apiUploadPromoProducts,
  apiSavePromoShopeeBatch as apiSavePromoBatch,
  apiDeletePromoShopeeItems as apiDeletePromoItems,
  apiGetCampaignTemplates,
  apiSaveCampaignTemplate,
  apiDeleteCampaignTemplate,
  apiGetFeeProfiles
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
  // Pattern from Rekomendasi Harga Diskon column
  const matchSaran = reason.match(/saran harga:\s*Rp?([\d,.]+)/i);
  if (matchSaran) {
    const n = Number(matchSaran[1].replace(/[,.]/g, ''));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}


// ─── Excel: parse Sales Information Shopee ──────────────────────────────
function parseSalesInfoSheet(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    range.e.r = Math.max(range.e.r, 5000);
    ws['!ref'] = XLSX.utils.encode_range(range);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
  const headers = rows[0] || [];
  const namaIdx = headers.indexOf('Nama Produk');
  const kodeIdx = headers.indexOf('Kode Produk');
  const namaVarIdx = headers.indexOf('Nama Variasi');
  const kodeVarIdx = headers.indexOf('Kode Variasi');
  const stokIdx = headers.indexOf('Stok');
  // Kadang ada Rekomendasi di Shopee:
  const rekoIdx = headers.findIndex(h => String(h).includes('Rekomendasi'));
  
  const parsed = [];
  // Shopee data starts exactly at row 4 (index 3)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const kode = String(row[kodeIdx] || '').trim();
    if (!kode || !/^\d+$/.test(kode)) continue;
    
    let saran = null;
    if (rekoIdx > -1 && row[rekoIdx]) {
      const num = Number(String(row[rekoIdx]).replace(/[^0-9]/g, ''));
      if (num > 0) saran = num;
    }
    
    parsed.push({
      product_id: kode,
      sku_id: String(row[kodeVarIdx] || '').trim(),
      product_name: String(row[namaIdx] || '').trim(),
      seller_sku: '', // not commonly used in shopee template line
      variation_value: String(row[namaVarIdx] || '').trim(),
      stok_saat_ini: row[stokIdx] ? Number(String(row[stokIdx]).replace(/[^0-9]/g, '')) : null,
      saran_harga: saran
    });
  }
  return parsed;
}

// ─── Replace Fail map ───
// Shopee doesn't have an error upload
// We get Saran Harga directly from the db (p.saran_harga).

// ─── Excel: parse Fail Report ──────────────────────────────────────
function parseFailReport(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row — contains 'SKU ID' / 'sku id' / 'Kode Variasi'
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(cell => {
      const c = String(cell).toLowerCase();
      return c.includes('sku id') || c.includes('sku_id') || c.includes('kode variasi');
    })) {
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
    
    // Shopee uses "Kode Variasi", Tiktok uses "SKU ID"
    const skuId = String(obj['Kode Variasi'] || obj['SKU ID'] || obj['sku_id'] || obj['sku id'] || '').trim();
    // Skip instruction/tooltip rows in Shopee template
    if (!skuId || skuId.toLowerCase() === 'wajib' || skuId.toLowerCase() === 'opsional' || skuId.toLowerCase().includes('memenuhi kriteria')) return;

    let reason = String(obj['Alasan Gagal'] || obj['Reason'] || obj['reason'] || obj['Fail Reason'] || '').trim();
    const reko = String(obj['Rekomendasi Harga Diskon'] || '').trim();
    
    if (reko && !reason.includes('Saran harga:')) {
      reason += (reason ? ' | ' : '') + `Saran harga: Rp${reko}`;
    }

    if (skuId && reason) map.set(skuId, reason);
  });
  return map;
}


const SHOPEE_HEADER_ROW0 = ['Nama Produk','Kode Produk','Nama Variasi','Kode Variasi','Harga Diskon (Tidak Wajib)','Stok Promo (Tidak Wajib)','Harga Diskon (Wajib)','Periode Mulai','Periode Selesai','Nama Promo','Harga Diskon','Diskon (%)','Stok Saat Ini','Stok Promo','Batas Pembelian'];
const SHOPEE_HEADER_ROW1 = ['Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Wajib','Tidak Wajib','Referensi','Wajib','Wajib'];
const SHOPEE_HEADER_ROW2 = ['','','','','','','','','','','Masukkan harga diskon produk','','','Aktifkan promo dengan mengisi stok promo','Batas pembelian per pembeli per hari, min 1'];

function exportCampaign(rows, withStock, filename) {
  const aoa = [SHOPEE_HEADER_ROW0, SHOPEE_HEADER_ROW1, SHOPEE_HEADER_ROW2];
  rows.forEach(r => {
    aoa.push([
      r.product_name || '',
      r.product_id,
      r.variation_value || '',
      r.sku_id,
      '','','','','','',
      r.harga_promo,
      '',
      r.stok_saat_ini || '',
      withStock && r.stok_promo != null ? r.stok_promo : '',
      r.batas_pembelian != null ? r.batas_pembelian : ''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'Sheet1');
  XLSX.writeFile(wb2, filename);
}

// ─── Main Component ────────────────────────────────────────────────
function PromoShopee() {
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

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showFailFilter, setShowFailFilter] = useState(false);
  const failFilterRef = useRef(null);
  const [failReasonFilters, setFailReasonFilters] = useState(new Set());

  // ─── Templates State ────────────
  const [templates, setTemplates] = useState([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const templateRef = useRef(null);

  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [loadConfirmTemplate, setLoadConfirmTemplate] = useState(null);

  const uploadRef = useRef(null);
  const filterRef = useRef(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  // Per-card bulk state: { [sellerSku]: { selections: [], harga: '', stok: '', batas: '' } }
  const [cardBulk, setCardBulk] = useState({});
  const [flashSku, setFlashSku] = useState(null);
  const [ignoreZeroStock, setIgnoreZeroStock] = useState(false);
  const [downloadConfirm, setDownloadConfirm] = useState(null); // { rows, skipped, withStock, filename }

  // ─── Stok Masal State ────────────
  const [showStokMasalModal, setShowStokMasalModal] = useState(false);
  const [stokMasalMode, setStokMasalMode] = useState('samakan'); // samakan, kurangi, tambah
  const [stokMasalValue, setStokMasalValue] = useState('');

  // ─── Kalkulator Harga State ──────
  const { modalValues } = useModalValues(storeId);
  const [feeProfiles, setFeeProfiles] = useState([]);

  useEffect(() => {
    function handleClick(e) {
      if (uploadRef.current && !uploadRef.current.contains(e.target)) setShowUploadMenu(false);
      if (downloadRef.current && !downloadRef.current.contains(e.target)) setShowDownloadMenu(false);
      if (failFilterRef.current && !failFilterRef.current.contains(e.target)) setShowFailFilter(false);
      if (templateRef.current && !templateRef.current.contains(e.target)) setShowTemplateMenu(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getHppValue = useCallback((row) => {
    if (!row) return '';
    const varKey = `${row.seller_sku}||${row.product_id}||${row.variation_value}`;
    if (modalValues[varKey]) return modalValues[varKey];
    if (modalValues[row.seller_sku]) return modalValues[row.seller_sku];
    return '';
  }, [modalValues]);

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
    try {
      const profiles = await apiGetFeeProfiles(storeId);
      setFeeProfiles(Array.isArray(profiles) ? profiles : []);
    } catch { setFeeProfiles([]); }
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

  function onBatasChange(id, e) {
    setLocalField(id, 'batas_pembelian', e.target.value.replace(/[^0-9]/g, ''));
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

  // ─── Templates API ────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    if (!activeStore?.id) return;
    try {
      const res = await apiGetCampaignTemplates(activeStore.id, 'shopee');
      setTemplates(res || []);
    } catch (e) {
      console.error("Gagal meload template:", e);
    }
  }, [activeStore]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSaveTemplate = async (overrideName = null) => {
    const finalName = typeof overrideName === 'string' ? overrideName : templateName;
    if (!finalName.trim()) return;

    // Ambil hanya produk yang tampil berdasar filter aktif
    const visibleIds = new Set(filteredGroups.flatMap(g => g.rows.map(r => r.id)));
    let base = products.filter(p => {
      if (!visibleIds.has(p.id)) return false;
      if (ignoreZeroStock && !(Number(p.stok_saat_ini || 0) > 0)) return false;
      return true;
    });

    if (base.length < products.length) {
      if (!window.confirm(`Hanya ${base.length} produk yang terfilter yang akan disimpan ke dalam Preset. Lanjutkan?`)) return;
    }

    setIsSavingTemplate(true);

    const payload = base.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      sku_id: p.sku_id,
      variation_name: p.variation_name,
      seller_sku: p.seller_sku,
      harga_normal: p.harga_normal,
      stok_saat_ini: p.stok_saat_ini,

      harga_promo: localValues[p.id]?.harga_promo !== undefined ? localValues[p.id].harga_promo : (p.harga_promo || null),
      stok_promo: localValues[p.id]?.stok_promo !== undefined ? localValues[p.id].stok_promo : (p.stok_promo || null),
      batas_pembelian: localValues[p.id]?.batas_pembelian !== undefined ? localValues[p.id].batas_pembelian : (p.batas_pembelian || null),
      checked: selectedIds.has(p.id)
    }));

    try {
      await apiSaveCampaignTemplate(activeStore.id, 'shopee', finalName.trim(), payload);
      setSaveTemplateModal(false);
      setTemplateName('');
      loadTemplates();
    } catch (e) {
      alert("Gagal simpan template: " + e.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const confirmLoadTemplate = (template) => {
    setLoadConfirmTemplate(template);
    setShowTemplateMenu(false);
  };

  const executeLoadTemplate = async (template, mode = 'full') => {
    const payload = template.payload || [];
    setLoadConfirmTemplate(null);

    // MODE HARGA ONLY: Hanya menimpa state `localValues` bagi produk yg kebetulan sudah tampil
    if (mode === 'harga_only') {
      const skuMap = new Map();
      products.forEach(p => skuMap.set(String(p.sku_id), p));
      
      const newLocalValues = { ...localValues };
      const newSelectedIds = new Set(selectedIds); 

      payload.forEach(item => {
        const matchedProduct = skuMap.get(String(item.sku_id));
        if (matchedProduct) {
          if (item.harga_promo != null || item.stok_promo != null || item.batas_pembelian != null) {
            newLocalValues[matchedProduct.id] = {
              harga_promo: item.harga_promo,
              stok_promo: item.stok_promo,
              batas_pembelian: item.batas_pembelian
            };
          }
          if (item.checked) {
            newSelectedIds.add(matchedProduct.id);
          }
        }
      });

      setLocalValues(newLocalValues);
      setSelectedIds(newSelectedIds);
      return;
    }
    
    // MODE FULL: Inject kembali produk dari template ke database (supaya tabel terisi kembali)
    const uploadPayload = payload.map(p => ({
      product_id: String(p.product_id || ''),
      product_name: p.product_name,
      sku_id: String(p.sku_id || ''),
      variation_name: p.variation_name,
      seller_sku: p.seller_sku,
      harga_normal: p.harga_normal,
      stok_saat_ini: p.stok_saat_ini
    }));

    try {
      setLoading(true);
      await apiUploadPromoProducts(uploadPayload, activeStore?.id);
      
      const latestProducts = await apiGetPromoValues(activeStore?.id) || [];
      setProducts(latestProducts);
      
      const skuMap = new Map();
      latestProducts.forEach(p => skuMap.set(String(p.sku_id), p));
      
      const newLocalValues = { ...localValues };
      const newSelectedIds = new Set(); 

      payload.forEach(item => {
        const matchedProduct = skuMap.get(String(item.sku_id));
        if (matchedProduct) {
          if (item.harga_promo != null || item.stok_promo != null || item.batas_pembelian != null) {
            newLocalValues[matchedProduct.id] = {
              harga_promo: item.harga_promo,
              stok_promo: item.stok_promo,
              batas_pembelian: item.batas_pembelian
            };
          }
          if (item.checked) {
            newSelectedIds.add(matchedProduct.id);
          }
        }
      });

      setLocalValues(newLocalValues);
      setSelectedIds(newSelectedIds);
    } catch (e) {
      alert("Gagal load template: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Hapus template ini?")) return;
    try {
      await apiDeleteCampaignTemplate(id);
      loadTemplates();
    } catch (e) {
      alert("Gagal menghapus: " + e.message);
    }
  };

  // ─── Selection ───────────────────────────────────────────────
  const allVisibleIds = useMemo(() => filteredGroups.flatMap(g => g.rows.filter(r => !ignoreZeroStock || Number(r.stok_saat_ini || 0) > 0).map(r => r.id)), [filteredGroups, ignoreZeroStock]);
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

  function toggleSelectAll() { setSelectedIds(isAllSelected ? new Set() : new Set(allVisibleIds)); }

  function toggleSelectGroup(rows) {
    const ids = rows.filter(r => !ignoreZeroStock || Number(r.stok_saat_ini || 0) > 0).map(r => r.id);
    const allSel = ids.length > 0 && ids.every(id => selectedIds.has(id));
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
    const bulk = cardBulk[sellerSku] || { selections: [], harga: '', stok: '', batas: '' };
    if (!bulk.harga && bulk.stok === '' && bulk.batas === '') return;
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
        if (bulk.batas !== '') next.batas_pembelian = bulk.batas;
        return { ...prev, [p.id]: next };
      });
    });
    setIsDirty(true);
    setCardBulk(prev => ({ ...prev, [sellerSku]: { selections, harga: '', stok: '', batas: '' } }));
    setFlashSku(sellerSku);
    setTimeout(() => setFlashSku(null), 1500);
  }

  function setCardBulkField(sellerSku, field, value) {
    setCardBulk(prev => {
      const cur = prev[sellerSku] || { selections: [], harga: '', stok: '', batas: '' };
      return { ...prev, [sellerSku]: { ...cur, [field]: value } };
    });
  }

  function setCardBulkSelection(sellerSku, idx, value) {
    setCardBulk(prev => {
      const cur = prev[sellerSku] || { selections: [], harga: '', stok: '', batas: '' };
      const selections = [...(cur.selections || [])];
      selections[idx] = value;
      return { ...prev, [sellerSku]: { ...cur, selections } };
    });
  }

  // ─── Stok Masal (Global bulk) ─────────────────────────────────
  const handleApplyStokMasal = () => {
    const val = Number(stokMasalValue) || 0;
    const newLocals = { ...localValues };
    let changed = false;

    filteredGroups.forEach(({ rows }) => {
      rows.forEach(r => {
        const stokSaatIni = Number(r.stok_saat_ini || 0);
        let newStok = stokSaatIni;

        if (stokMasalMode === 'samakan') {
          newStok = stokSaatIni;
        } else if (stokMasalMode === 'kurangi') {
          newStok = stokSaatIni - val;
        } else if (stokMasalMode === 'tambah') {
          newStok = stokSaatIni + val;
        }

        if (newStok < 0) newStok = 0;

        const cur = newLocals[r.id] || {};
        newLocals[r.id] = { ...cur, stok_promo: String(newStok) };
        changed = true;
      });
    });

    if (changed) {
      setLocalValues(newLocals);
      setIsDirty(true);
    }
    setShowStokMasalModal(false);
  };

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
      if (r.saran_harga) setLocalField(r.id, 'harga_promo', fmtRp(r.saran_harga));
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
        stok_saat_ini: r.stok_saat_ini !== undefined ? r.stok_saat_ini : null,
        saran_harga: r.saran_harga || null,
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
        ...('batas_pembelian' in vals ? { batas_pembelian: vals.batas_pembelian !== '' ? toRawNum(vals.batas_pembelian) : null } : {}),
      }));
      if (updates.length > 0) await apiSavePromoBatch(updates, storeId);
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
      setIsSaving(false);
      return;
    }
    // Save berhasil — baru clear local edits dan reload
    setLocalValues({});
    setIsDirty(false);
    setSaveSuccess(true);
    try { await loadProducts(); } catch { /* reload gagal tapi data sudah tersimpan */ }
    setIsSaving(false);
    setTimeout(() => setSaveSuccess(false), 2000);
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
  }

  // ─── Export ──────────────────────────────────────────────────
  function buildExportRows() {
    // Jika ada centang → gunakan yang tercentang saja
    // Jika tidak ada centang → ikuti filter aktif (filteredGroups)
    let base;
    if (selectedIds.size > 0) {
      base = products.filter(p => selectedIds.has(p.id));
      if (ignoreZeroStock) base = base.filter(p => Number(p.stok_saat_ini || 0) > 0);
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
      product_name: p.product_name, variation_value: p.variation_value, stok_saat_ini: p.stok_saat_ini,
      harga_promo: toRawNum(getLocal(p.id, 'harga_promo')),
      stok_promo: getLocal(p.id, 'stok_promo') !== null && getLocal(p.id, 'stok_promo') !== ''
        ? toRawNum(getLocal(p.id, 'stok_promo')) : null,
      batas_pembelian: getLocal(p.id, 'batas_pembelian') !== null && getLocal(p.id, 'batas_pembelian') !== ''
        ? toRawNum(getLocal(p.id, 'batas_pembelian')) : null,
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
      if (ignoreZeroStock) base = base.filter(p => Number(p.stok_saat_ini || 0) > 0);
    } else {
      const visibleIds = new Set(filteredGroups.flatMap(g => g.rows.map(r => r.id)));
      base = products.filter(p => {
        if (!visibleIds.has(p.id)) return false;
        if (ignoreZeroStock && !(Number(p.stok_saat_ini || 0) > 0)) return false;
        return true;
      });
    }
    const skipped = base.length - rows.length;
    const d = new Date();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const dateStr = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const filename = `Kampanye Shopee ${dateStr}.xlsx`;

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
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Promo Shopee</span>
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


          {/* Preset Dropdown */}
          <div ref={templateRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTemplateMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}
            >
              <Bookmark size={13} /> Preset
              <ChevronDown size={12} style={{ transform: showTemplateMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showTemplateMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 0.375rem)', right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '220px', zIndex: 50, overflow: 'hidden' }}>
                <button
                  onClick={() => { setSaveTemplateModal(true); setShowTemplateMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 0.875rem', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', color: 'var(--accent-primary)', fontSize: '0.8125rem', fontWeight: 600 }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Plus size={14} /> Simpan Preset
                </button>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {templates.length === 0 ? (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Belum ada preset</div>
                  ) : templates.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', width: '100%', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <button onClick={() => confirmLoadTemplate(t)} style={{ flex: 1, padding: '0.625rem 0.75rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {t.name}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowTemplateMenu(false); handleSaveTemplate(t.name); }} title="Timpa (Update) Preset Ini" style={{ padding: '0.625rem 0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', opacity: 0.8 }}
                        onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.8}
                      >
                        <Save size={13} />
                      </button>
                      <button onClick={(e) => handleDeleteTemplate(e, t.id)} title="Hapus Preset" style={{ padding: '0.625rem 0.625rem 0.625rem 0.2rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', opacity: 0.8 }}
                        onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.8}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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



      {/* ══ SEARCH + FILTER ══ */}
      <div className="im-toolbar">
        <div className="im-search-box">
          <Search size={16} className="im-search-icon" />
          <input type="text" placeholder="Cari SKU atau nama produk..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="im-search-input" />
          {searchQuery && <button className="im-search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
        </div>

        {/* ── Filter button ── */}
        <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowFilterMenu(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem',
              background: (filterMode !== 'all' || ignoreZeroStock) ? 'rgba(108,92,231,0.1)' : 'var(--bg-glass)',
              border: `1px solid ${(filterMode !== 'all' || ignoreZeroStock) ? 'rgba(108,92,231,0.35)' : 'var(--border-medium)'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 600,
              color: (filterMode !== 'all' || ignoreZeroStock) ? '#6c5ce7' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Filter size={13} />
            Filter
            {(filterMode !== 'all' || ignoreZeroStock) && (
              <span style={{ background: '#6c5ce7', color: '#fff', borderRadius: '99px', fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>
                {(filterMode !== 'all' ? 1 : 0) + (ignoreZeroStock ? 1 : 0)}
              </span>
            )}
            <ChevronDown size={11} style={{ transform: showFilterMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showFilterMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 0.375rem)', right: 0,
              background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
              minWidth: '185px', zIndex: 60, padding: '0.5rem 0'
            }}>
              {/* Section 1: Tampilkan */}
              <div style={{ padding: '0.2rem 0.75rem 0.35rem', fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tampilkan</div>
              {[
                { key: 'all',      label: 'Semua',       count: stats.total },
                { key: 'unfilled', label: 'Belum terisi', count: stats.unfilled + stats.partial },
              ].map(opt => (
                <label key={opt.key}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="radio" name="filterMode"
                    checked={filterMode === opt.key}
                    onChange={() => setFilterMode(opt.key)}
                    style={{ accentColor: '#6c5ce7', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', flex: 1 }}>{opt.label}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{opt.count}</span>
                </label>
              ))}

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--border-medium)', margin: '0.35rem 0' }} />

              {/* Section 2: Opsi */}
              <div style={{ padding: '0.2rem 0.75rem 0.35rem', fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Opsi</div>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                title="Sembunyikan produk yang seluruh variasinya memiliki stok 0"
              >
                <input
                  type="checkbox"
                  checked={ignoreZeroStock}
                  onChange={() => setIgnoreZeroStock(v => !v)}
                  style={{ accentColor: '#f59e0b', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Abaikan Stok 0</span>
              </label>
            </div>
          )}
        </div>

        {/* ── Stok Masal ── */}
        <button
          onClick={() => setShowStokMasalModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.75rem', background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: 600, color: '#6c5ce7',
            transition: 'all 0.2s', flexShrink: 0
          }}
          title="Atur stok secara masal berdasar stok saat ini"
        >
          <Layers size={13} />
          Input Stok Masal
        </button>
      </div>

      {/* ══ MENGHINDARI TERTIMPA - LOAD PRESET CONFIRM ══ */}
      {loadConfirmTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '420px', width: '90%', textAlign: 'center' }}>
            <Bookmark size={28} color="#6c5ce7" style={{ margin: '0 auto 0.625rem' }} />
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.375rem' }}>Muat Preset: {loadConfirmTemplate.name}</h3>
            
            {(Object.keys(localValues).length > 0 || selectedIds.size > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.625rem', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', textAlign: 'left', marginBottom: '1.25rem', marginTop: '1rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>Memuat preset akan <strong>menimpa data</strong> Anda di layar. Bagaimana Anda ingin memuatnya?</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', textAlign: 'left' }}>
              <button 
                onClick={() => executeLoadTemplate(loadConfirmTemplate, 'harga_only')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#6c5ce7'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-medium)'}
              >
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><CheckCircle2 size={14} color="#6c5ce7"/> Load Harga Saja</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left' }}>Hanya menimpa isian harga/stok pada produk yang sesuai dan sedang tampil di layar.</span>
              </button>

              <button 
                onClick={() => executeLoadTemplate(loadConfirmTemplate, 'full')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#6c5ce7'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-medium)'}
              >
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Layers size={14} color="#6c5ce7"/> Load Produk & Harga</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left' }}>Memuat dan meleburkan kembali produk lama Anda dari preset ini ke daftar tabel.</span>
              </button>
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <button className="btn-secondary" onClick={() => setLoadConfirmTemplate(null)} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', width: '100%' }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STOK MASAL MODAL ══ */}
      {showStokMasalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Input Stok Masal</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Terapkan aturan perhitungan stok ini ke <strong>semua produk yang sedang tampil</strong> (tidak difilter). Jika hasilnya kurang dari 0, stok akan disetel menjadi 0 (tidak ikut promo).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input type="radio" value="samakan" checked={stokMasalMode === 'samakan'} onChange={() => setStokMasalMode('samakan')} style={{ accentColor: '#6c5ce7' }} />
                <span>Samakan persis dengan <strong>Stok Saat Ini</strong></span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input type="radio" value="kurangi" checked={stokMasalMode === 'kurangi'} onChange={() => setStokMasalMode('kurangi')} style={{ accentColor: '#6c5ce7' }} />
                <span><strong>Kurangi</strong> nilai Stok Saat Ini dengan:</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input type="radio" value="tambah" checked={stokMasalMode === 'tambah'} onChange={() => setStokMasalMode('tambah')} style={{ accentColor: '#6c5ce7' }} />
                <span><strong>Tambahkan</strong> nilai ke Stok Saat Ini sebesar:</span>
              </label>
            </div>

            {stokMasalMode !== 'samakan' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Besaran Angka</div>
                <input 
                  type="number" className="im-input" autoFocus
                  placeholder="Contoh: 10"
                  value={stokMasalValue} onChange={e => setStokMasalValue(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowStokMasalModal(false)} style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}>Batal</button>
              <button 
                className="btn-primary" 
                onClick={handleApplyStokMasal} 
                disabled={stokMasalMode !== 'samakan' && !stokMasalValue}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <Zap size={14} /> Eksekusi Masal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ INPUT SAVE PRESET ══ */}
      {saveTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '360px', width: '90%' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>Simpan Sebagai Preset</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Semua harga, stok, dan pilihan produk aktif akan disimpan.</p>
            <input 
              type="text" 
              className="im-input" 
              placeholder="Contoh: Promo 9.9 Super Sale" 
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              style={{ marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setSaveTemplateModal(false)} disabled={isSavingTemplate} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem' }}>Batal</button>
              <button className="btn-primary" onClick={handleSaveTemplate} disabled={isSavingTemplate || !templateName.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                {isSavingTemplate ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                Simpan
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
          const bulk = cardBulk[sellerSku] || { selections: [], harga: '', stok: '', batas: '' };
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
                <div className="im-card-left" 
                  style={{ flex: 1, minWidth: 0, cursor: rows.length > 1 ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (rows.length > 1) {
                      setExpandedSkus(prev => {
                        const next = new Set(prev);
                        next.has(sellerSku) ? next.delete(sellerSku) : next.add(sellerSku);
                        return next;
                      });
                    }
                  }}
                >
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
                  const singleReko = rows[0].saran_harga;
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
                      <input type="text" inputMode="numeric" placeholder="Batas" className="im-input" style={{ width: '4.5rem' }}
                        value={localValues[rows[0].id]?.batas_pembelian !== undefined ? localValues[rows[0].id].batas_pembelian : (rows[0].batas_pembelian != null ? rows[0].batas_pembelian : '')}
                        onInput={e => onBatasChange(rows[0].id, e)}
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
                    <input
                      type="text" inputMode="numeric"
                      placeholder="Batas"
                      className="im-bulk-input"
                      style={{ width: '5rem' }}
                      value={bulk.batas}
                      onChange={e => setCardBulkField(sellerSku, 'batas', e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') applyCardBulk(sellerSku, rows); }}
                    />

                    <button
                      className="im-bulk-apply"
                      onClick={() => applyCardBulk(sellerSku, rows)}
                      disabled={!bulk.harga && bulk.stok === '' && bulk.batas === ''}
                    >
                      <Save size={13} /> Terapkan
                    </button>

                    {/* Saran harga — di samping Terapkan, langsung ke semua variasi yg punya saran */}
                    {(() => {
                      const withReko = rows.filter(r => r.saran_harga);
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
                      .filter(p => {
                        if (ignoreZeroStock && !(Number(p.stok_saat_ini || 0) > 0)) return false;
                        if (varTypes.length === 0) return true;
                        const selections = bulk.selections || [];
                        const variation = p.variation_value || '';
                        let parts = variation.split(' / ');
                        if (parts.length === 1) parts = variation.split(',');
                        parts = parts.map(s => s.trim());
                        if (parts.length !== varTypes.length) return true;
                        for (let i = 0; i < varTypes.length; i++) {
                          const sel = selections[i] || 'Semua';
                          if (sel !== 'Semua' && sel !== parts[i]) return false;
                        }
                        return true;
                      })
                      .map(p => {
                      const hargaVal = localValues[p.id]?.harga_promo !== undefined ? localValues[p.id].harga_promo : fmtRp(p.harga_promo || '');
                      const stokVal = localValues[p.id]?.stok_promo !== undefined ? localValues[p.id].stok_promo : (p.stok_promo != null ? p.stok_promo : '');
                      const batasVal = localValues[p.id]?.batas_pembelian !== undefined ? localValues[p.id].batas_pembelian : (p.batas_pembelian != null ? p.batas_pembelian : '');
                      const varFail = failMap.get(String(p.sku_id));

                      return (
                        <div key={p.id} className={`im-var-item ${toRawNum(hargaVal) > 0 ? 'im-var-filled' : ''}`}>
                          <button onClick={() => toggleSelectOne(p.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: selectedIds.has(p.id) ? '#6c5ce7' : 'var(--text-tertiary)', flexShrink: 0 }}
                          >
                            {selectedIds.has(p.id) ? <CheckSquare size={13} /> : <Square size={13} />}
                          </button>
                          <div className="im-var-detail" style={{ flex: 1, minWidth: 0 }}>
                            <span className="im-var-name">
                              {p.variation_value || 'Default'}
                              {p.saran_harga && (
                                <button
                                  onClick={() => setLocalField(p.id, 'harga_promo', fmtRp(p.saran_harga))}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1rem', padding: '0.15rem 0.3rem', background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', borderRadius: '0.15rem', cursor: 'pointer', fontSize: '0.55rem', fontWeight: 700, color: '#6c5ce7', whiteSpace: 'nowrap', marginLeft: '0.375rem' }}
                                  title={`Gunakan saran harga: ${fmtRp(p.saran_harga)}`}
                                >
                                  💡 {fmtRp(p.saran_harga)}
                                </button>
                              )}
                            </span>
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
                            <input type="text" inputMode="numeric" placeholder="Batas" className="im-input im-input-sm" style={{ width: '4rem' }}
                              value={batasVal} onInput={e => onBatasChange(p.id, e)}
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
      {/* ══ FLOATING SELECTION BAR ══ */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-primary)', border: '1px solid var(--border-medium)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', borderRadius: '3rem',
          padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', zIndex: 100,
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <button onClick={toggleSelectAll}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            <div style={{ color: isAllSelected ? '#6c5ce7' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              {isAllSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </div>
            {selectedIds.size} Terpilih
          </button>

          <div style={{ width: '1px', height: '1.5rem', background: 'var(--border-medium)' }} />

          <button onClick={() => { if (window.confirm(`Hapus ${selectedIds.size} produk?\nData akan dihapus permanen dari database.`)) handleDelete(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '2rem', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#ef4444', transition: 'all 0.2s' }}
          >
            {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
            Hapus ({selectedIds.size})
          </button>
        </div>
      )}



    </div>
  );
}

export default PromoShopee;
