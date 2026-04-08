import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, ChevronDown, Save, Search,
  CheckCircle2, Circle, Zap, Filter, X, Loader2,
  Trash2, Upload, Download, AlertCircle, CheckSquare, Square, Bookmark
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { useStore } from '../contexts/StoreContext';
import {
  apiGetPromoValues,
  apiUploadPromoProducts,
  apiSavePromoBatch,
  apiDeletePromoItems,
  apiGetKampanyeTemplates,
  apiSaveKampanyeTemplate,
  apiUpdateKampanyeTemplate,
  apiDeleteKampanyeTemplate,
  apiGetPromoShopeeValues,
  apiUploadPromoShopeeProducts,
  apiSavePromoShopeeBatch,
  apiDeletePromoShopeeItems
} from '../api';

const SHOPEE_HEADER_ROW0 = ['Nama Produk','Kode Produk','Nama Variasi','Kode Variasi','Harga Diskon (Tidak Wajib)','Stok Promo (Tidak Wajib)','Harga Diskon (Wajib)','Periode Mulai','Periode Selesai','Nama Promo','Harga Diskon','Diskon (%)','Stok Saat Ini','Stok Promo','Batas Pembelian'];
const SHOPEE_HEADER_ROW1 = ['Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Wajib','Tidak Wajib','Referensi','Wajib','Wajib'];
const SHOPEE_HEADER_ROW2 = ['','','','','','','','','','','Masukkan harga diskon produk','','','Aktifkan promo dengan mengisi stok promo','Batas pembelian per pembeli per hari, min 1'];

function Kampanye() {
  const { activeStore } = useStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [selectedErrors, setSelectedErrors] = useState(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedSkus, setExpandedSkus] = useState(new Set());
  const [bulkInputs, setBulkInputs] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [failedReasons, setFailedReasons] = useState(new Map());
  const [activePlatform, setActivePlatform] = useState('tiktok');
  const [editedValues, setEditedValues] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [imAlert, setImAlert] = useState({ show: false, message: '', type: 'info', onConfirm: null });
  const showAlert = (msg, type = 'info') => setImAlert({ show: true, message: msg, type, onConfirm: null });
  const showConfirm = (msg, onConfirm) => setImAlert({ show: true, message: msg, type: 'confirm', onConfirm });

  const loadData = useCallback(async () => {
    if (!activeStore) return;
    try {
      setLoading(true);
      const [res, tpls] = await Promise.all([
        activePlatform === 'shopee' ? apiGetPromoShopeeValues(activeStore.id) : apiGetPromoValues(activeStore.id),
        apiGetKampanyeTemplates(activeStore.id, activePlatform)
      ]);
      setData(res);
      setTemplates(tpls);
      setEditedValues({});
      setIsDirty(false);
      setSelectedIds(new Set());
      setFailedReasons(new Map());
      setFilterMode('all');
      setSelectedErrors(new Set());
      setIsDropdownOpen(false);
      setIsTemplateDropdownOpen(false);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, [activeStore, activePlatform]);

  useEffect(() => { loadData(); }, [loadData]);

  const buildPayloadFromCurrent = () => {
    const hasSelections = selectedIds.size > 0;
    const payload = [];
    data.forEach(item => {
      const edited = editedValues[item.id] || {};
      const hp = edited.harga_promo !== undefined ? edited.harga_promo : (item.harga_promo || null);
      const sp = edited.stok_promo !== undefined ? edited.stok_promo : (item.stok_promo || null);
      const bp = edited.batas_pembelian !== undefined ? edited.batas_pembelian : (item.batas_pembelian || null);
      const include = hasSelections ? selectedIds.has(item.id) : (hp || sp || bp);
      if (include) {
        payload.push({
          sku_id: String(item.sku_id),
          product_id: item.product_id,
          product_name: item.product_name,
          seller_sku: item.seller_sku,
          variation_value: item.variation_value,
          harga_promo: hp,
          stok_promo: sp,
          batas_pembelian: bp,
        });
      }
    });
    return payload;
  };

  const handleSaveTemplate = async () => {
    const payload = buildPayloadFromCurrent();
    if (payload.length === 0) {
      showAlert('Tidak ada data yang dicentang atau terisi untuk disimpan.', 'error');
      return;
    }
    try {
      await apiSaveKampanyeTemplate({ store_id: activeStore.id, platform: activePlatform, name: templateName || `Settingan ${new Date().toLocaleDateString('id-ID')}`, payload });
      setShowTemplateModal(false);
      setTemplateName('');
      showAlert('Settingan berhasil disimpan!', 'success');
      loadData();
    } catch (err) {
      showAlert('Gagal menyimpan: ' + err.message, 'error');
    }
  };

  const handleLoadTemplate = async (tpl) => {
    setIsTemplateDropdownOpen(false);
    let payload = [];
    try {
      payload = typeof tpl.payload === 'string' ? JSON.parse(tpl.payload) : (tpl.payload || []);
    } catch (e) { showAlert('Gagal membaca data template.', 'error'); return; }

    const missingItems = payload.filter(p => !data.find(d => String(d.sku_id) === String(p.sku_id)));
    let currentData = data;
    if (missingItems.length > 0) {
      setLoading(true);
      try {
        if (activePlatform === 'shopee') {
          await apiUploadPromoShopeeProducts(missingItems, activeStore.id);
        } else {
          await apiUploadPromoProducts(missingItems, activeStore.id);
        }
        const res = activePlatform === 'shopee' ? await apiGetPromoShopeeValues(activeStore.id) : await apiGetPromoValues(activeStore.id);
        setData(res);
        currentData = res;
      } catch (err) {
        console.error('Failed to restore missing products', err);
      } finally { setLoading(false); }
    }

    const newEdited = {};
    payload.forEach(p => {
      const match = currentData.find(d => String(d.sku_id) === String(p.sku_id));
      if (match) {
        newEdited[match.id] = {
          harga_promo: p.harga_promo !== undefined ? p.harga_promo : null,
          stok_promo: p.stok_promo !== undefined ? p.stok_promo : null,
          batas_pembelian: p.batas_pembelian !== undefined ? p.batas_pembelian : null,
        };
      }
    });
    setEditedValues(newEdited);
    setIsDirty(true);
    showAlert(`Berhasil memuat ${Object.keys(newEdited).length} item dari "${tpl.name}". Periksa dan klik Simpan.`, 'success');
  };

  const handleUpdateTemplate = async (id, name, e) => {
    e.stopPropagation();
    const payload = buildPayloadFromCurrent();
    if (payload.length === 0) { showAlert('Belum ada data untuk diupdate.', 'error'); return; }
    showConfirm(`Timpa settingan "${name}" dengan data saat ini?`, async () => {
      try {
        await apiUpdateKampanyeTemplate(id, { payload });
        showAlert('Settingan berhasil diupdate!', 'success');
        loadData();
      } catch (err) { showAlert('Gagal mengupdate.', 'error'); }
    });
  };

  const handleDeleteTemplate = (id, e) => {
    e.stopPropagation();
    showConfirm('Yakin ingin menghapus settingan ini?', async () => {
      try { await apiDeleteKampanyeTemplate(id); loadData(); }
      catch (err) { showAlert('Gagal menghapus.', 'error'); }
    });
  };

  const handleProductUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeStore) return;
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = xlsx.read(arrayBuffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      if (firstSheet['!ref']) {
        const range = xlsx.utils.decode_range(firstSheet['!ref']);
        range.e.r = 50000;
        firstSheet['!ref'] = xlsx.utils.encode_range(range);
      }
      const rows = xlsx.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      const parsedProducts = [];
      if (activePlatform === 'shopee') {
        const headers = rows[0] || [];
        const namaIdx = headers.indexOf('Nama Produk'), kodeIdx = headers.indexOf('Kode Produk');
        const namaVarIdx = headers.indexOf('Nama Variasi'), kodeVarIdx = headers.indexOf('Kode Variasi');
        const stokIdx = headers.indexOf('Stok'), rekoIdx = headers.indexOf('Rekomendasi Harga Diskon');
        for (let i = 3; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const kode = String(row[kodeIdx] || '').trim();
          if (!kode || !/^\d+$/.test(kode)) continue;
          const rawStok = stokIdx > -1 ? Number(String(row[stokIdx] ?? '').replace(/[^0-9]/g, '') || NaN) : NaN;
          const rawReko = rekoIdx > -1 ? Number(String(row[rekoIdx] ?? '').replace(/[^0-9]/g, '') || NaN) : NaN;
          parsedProducts.push({ product_id: kode, sku_id: String(row[kodeVarIdx] || '').trim(), product_name: String(row[namaIdx] || '').trim(), variation_value: String(row[namaVarIdx] || '').trim(), stok_saat_ini: isNaN(rawStok) ? null : rawStok, saran_harga: isNaN(rawReko) || rawReko === 0 ? null : rawReko });
        }
      } else {
        const keys = (rows[0] || []).map(k => String(k).toLowerCase().trim());
        const pidIdx = keys.findIndex(k => k === 'product id' || k === 'product_id');
        const sidIdx = keys.findIndex(k => k === 'sku id' || k === 'sku_id');
        const pnameIdx = keys.findIndex(k => k === 'product name' || k === 'title');
        const sskuIdx = keys.findIndex(k => k === 'seller sku' || k === 'seller_sku');
        const varIdx = keys.findIndex(k => k === 'variation name' || k === 'variation_value' || k === 'sku_name' || k === 'variation');
        const stokIdx = keys.findIndex(k => k === 'available stock' || k === 'quantity' || k === 'stok' || k === 'kuantitas');

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          let p = {};
          if (pidIdx > -1) p.product_id = String(row[pidIdx] || '').trim();
          if (sidIdx > -1) p.sku_id = String(row[sidIdx] || '').trim();
          if (pnameIdx > -1) p.product_name = String(row[pnameIdx] || '').trim();
          if (sskuIdx > -1) p.seller_sku = String(row[sskuIdx] || '').trim();
          if (varIdx > -1) p.variation_value = String(row[varIdx] || '').trim();
          if (stokIdx > -1) {
            const raw = String(row[stokIdx] || '').replace(/[^0-9]/g, '');
            p.stok_saat_ini = raw ? parseInt(raw, 10) : null;
          }

          if (p.product_id && /^\d+$/.test(p.product_id)) {
            parsedProducts.push(p);
          }
        }
      }
      if (parsedProducts.length > 0) {
        if (activePlatform === 'shopee') {
          await apiUploadPromoShopeeProducts(parsedProducts, activeStore.id);
        } else {
          await apiUploadPromoProducts(parsedProducts, activeStore.id);
        }
        await loadData();
      }
    } catch (err) { showAlert('Gagal upload: ' + err.message, 'error'); }
    finally { setLoading(false); e.target.value = null; }
  };

  const handleFailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = xlsx.read(arrayBuffer, { type: 'array' });
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const headers = rows[0] || [];
      const skuIdx = headers.findIndex(h => /sku|id/i.test(String(h)));
      const reasonIdx = headers.findIndex(h => /reason|alasan|keterangan|status/i.test(String(h)));
      const map = new Map();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const sku = skuIdx > -1 ? String(row[skuIdx] || '').trim() : '';
        const reason = reasonIdx > -1 ? String(row[reasonIdx] || '').trim() : 'Gagal';
        if (sku) map.set(sku, reason);
      }
      setFailedReasons(map);
    } catch (err) { showAlert('Gagal baca file: ' + err.message, 'error'); }
    finally { e.target.value = null; }
  };

  const handleDeleteChecked = () => {
    if (selectedIds.size === 0) return;
    showConfirm(`Hapus ${selectedIds.size} produk?`, async () => {
      setLoading(true);
      try {
        if (activePlatform === 'shopee') {
          await apiDeletePromoShopeeItems(Array.from(selectedIds), activeStore.id);
        } else {
          await apiDeletePromoItems(Array.from(selectedIds), activeStore.id);
        }
        await loadData();
      }
      catch (err) { showAlert('Gagal hapus: ' + err.message, 'error'); }
      finally { setLoading(false); }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.keys(editedValues).map(id => {
        const ed = editedValues[id];
        const upd = { id: parseInt(id, 10) };
        if (ed.harga_promo !== undefined) upd.harga_promo = ed.harga_promo;
        if (ed.stok_promo !== undefined) upd.stok_promo = ed.stok_promo;
        if (ed.batas_pembelian !== undefined) upd.batas_pembelian = ed.batas_pembelian;
        return upd;
      });
      if (updates.length > 0) {
        if (activePlatform === 'shopee') {
          await apiSavePromoShopeeBatch(updates, activeStore.id);
        } else {
          await apiSavePromoBatch(updates, activeStore.id);
        }
        await loadData();
      }
    } catch (err) { showAlert('Gagal simpan: ' + err.message, 'error'); }
    finally { setSaving(false); }
  };

  const groupedData = useMemo(() => {
    const map = new Map();
    data.forEach(item => {
      const key = item.seller_sku || ('__P__' + item.product_id);
      if (!map.has(key)) map.set(key, { key, product_id: item.product_id, product_name: item.product_name, seller_sku: item.seller_sku, variations: [], ids: [] });
      const entry = map.get(key);
      entry.variations.push(item);
      entry.ids.push(item.id);
    });
    return Array.from(map.values()).sort((a, b) => (a.seller_sku || a.product_name || '').localeCompare(b.seller_sku || b.product_name || ''));
  }, [data]);

  const getDisplayValue = (id, field) => {
    if (editedValues[id] && editedValues[id][field] !== undefined) return editedValues[id][field];
    const item = data.find(d => d.id === id);
    return item ? item[field] : null;
  };

  const handleInputChange = (id, field, val) => {
    const numeric = val.replace(/[^0-9]/g, '');
    setEditedValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: numeric === '' ? null : parseInt(numeric, 10) } }));
    setIsDirty(true);
  };

  const toggleSelectGroup = (group) => {
    const allSelected = group.ids.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    group.ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelectedIds(next);
  };

  const toggleSelectId = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const getVariationTypes = (variations) => {
    if (variations.length === 0) return [];
    const firstVar = variations[0].variation_value || '';
    const splitChar = firstVar.includes(' / ') ? ' / ' : firstVar.includes(',') ? ',' : '';
    if (!splitChar) return ['Tipe 1'];
    return Array.from({ length: firstVar.split(splitChar).length }, (_, i) => `Tipe ${i + 1}`);
  };

  const getVariationOptions = (variations, typeIndex) => {
    const options = new Set();
    const firstVar = variations[0]?.variation_value || '';
    const splitChar = firstVar.includes(' / ') ? ' / ' : firstVar.includes(',') ? ',' : '';
    variations.forEach(v => {
      const val = v.variation_value || '';
      if (splitChar) { const parts = val.split(splitChar).map(s => s.trim()); if (parts[typeIndex]) options.add(parts[typeIndex]); }
      else if (typeIndex === 0) options.add(val.trim());
    });
    return Array.from(options).filter(Boolean);
  };

  const handleBulkDropdownChange = (groupKey, index, value) => {
    setBulkInputs(prev => {
      const prevEntry = prev[groupKey] || { harga: '', stok: '', selections: [] };
      const newSelections = [...(prevEntry.selections || [])];
      newSelections[index] = value;
      return { ...prev, [groupKey]: { ...prevEntry, selections: newSelections } };
    });
  };

  const applyBulkEdit = (groupKey, variations, applyHarga, applyStok, applyBatas = '') => {
    if (applyHarga === '' && applyStok === '' && applyBatas === '') return;
    const parsedHarga = applyHarga.replace(/[^0-9]/g, '') === '' ? null : parseInt(applyHarga.replace(/[^0-9]/g, ''), 10);
    const parsedStok = applyStok.replace(/[^0-9]/g, '') === '' ? null : parseInt(applyStok.replace(/[^0-9]/g, ''), 10);
    const parsedBatas = applyBatas.replace(/[^0-9]/g, '') === '' ? null : parseInt(applyBatas.replace(/[^0-9]/g, ''), 10);
    const bulk = bulkInputs[groupKey] || {};
    const selections = bulk.selections || [];
    const firstVar = variations[0]?.variation_value || '';
    const splitChar = firstVar.includes(' / ') ? ' / ' : firstVar.includes(',') ? ',' : '';
    const types = getVariationTypes(variations);
    setEditedValues(prev => {
      const next = { ...prev };
      variations.forEach(v => {
        if (selectedIds.size > 0 && !selectedIds.has(v.id)) return;
        let match = true;
        if (types.length > 0) {
          const parts = splitChar ? (v.variation_value || '').split(splitChar).map(s => s.trim()) : [(v.variation_value || '').trim()];
          for (let i = 0; i < types.length; i++) { const sel = selections[i] || 'Semua'; if (sel !== 'Semua' && sel !== parts[i]) { match = false; break; } }
        }
        if (match) {
          next[v.id] = { ...next[v.id] };
          if (applyHarga !== '') next[v.id].harga_promo = parsedHarga;
          if (applyStok !== '') next[v.id].stok_promo = parsedStok;
          if (applyBatas !== '') next[v.id].batas_pembelian = parsedBatas;
        }
      });
      return next;
    });
    setIsDirty(true);
  };

  const uniqueReasons = useMemo(() => { const r = new Set(); failedReasons.forEach(v => { if (v) r.add(v); }); return Array.from(r); }, [failedReasons]);

  const filteredGroups = useMemo(() => {
    const result = [];
    groupedData.forEach(group => {
      let vars = group.variations;
      if (searchQuery) { const q = searchQuery.toLowerCase(); vars = vars.filter(v => (v.sku_id||'').toLowerCase().includes(q)||(v.product_name||'').toLowerCase().includes(q)||(v.seller_sku||'').toLowerCase().includes(q)||(v.variation_value||'').toLowerCase().includes(q)); if (vars.length === 0) return; }
      if (filterMode === 'filled') { vars = vars.filter(v => getDisplayValue(v.id, 'harga_promo')); if (vars.length === 0) return; }
      else if (filterMode === 'unfilled') { vars = vars.filter(v => !getDisplayValue(v.id, 'harga_promo')); if (vars.length === 0) return; }
      if (selectedErrors.size > 0) { vars = vars.filter(v => selectedErrors.has(failedReasons.get(v.sku_id))); if (vars.length === 0) return; }
      result.push({ ...group, variations: vars, ids: vars.map(v => v.id) });
    });
    return result;
  }, [groupedData, searchQuery, filterMode, selectedErrors, editedValues, failedReasons]);

  const stats = useMemo(() => {
    let filled = 0;
    data.forEach(item => { if (getDisplayValue(item.id, 'harga_promo')) filled++; });
    return { total: data.length, filled, unfilled: data.length - filled };
  }, [data, editedValues]);

  const progressPercent = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;
  const getSelectedDataForExport = () => selectedIds.size > 0 ? data.filter(item => selectedIds.has(item.id)) : data;
  const exportExcelAoA = (aoa, name) => { const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(aoa), 'Sheet1'); xlsx.writeFile(wb, `${name}.xlsx`); };
  const fmtRp = (val) => val ? `Rp${Number(val).toLocaleString('id-ID')}` : null;

  const dlWithoutStock = () => {
    const list = getSelectedDataForExport();
    if (activePlatform === 'shopee') {
      const aoa = [SHOPEE_HEADER_ROW0, SHOPEE_HEADER_ROW1, SHOPEE_HEADER_ROW2];
      let skipped = 0;
      list.forEach(item => { const hp = getDisplayValue(item.id, 'harga_promo'); if (hp) { const bp = getDisplayValue(item.id, 'batas_pembelian'); aoa.push([item.product_name||'', item.product_id, item.variation_value||'', item.sku_id||'', '','','','','','', hp, '', item.stok_saat_ini||'', '', bp||'']); } else { skipped++; } });
      if (aoa.length === 3) { showAlert('Tidak ada data untuk diekspor.', 'error'); return; }
      if (skipped > 0) showAlert(`${skipped} item dilewati.`, 'info');
      exportExcelAoA(aoa, 'SHOPEE_KAMPANYE_TANPA_STOK');
    } else {
      const aoa = [['Kiat: Periksa persyaratan kampanye sebelum mengunggah file'],['Product ID','SKU ID','Campaign price']];
      let skipped = 0;
      list.forEach(item => { const hp = getDisplayValue(item.id, 'harga_promo'); if (hp) { aoa.push([item.product_id, item.sku_id||'', hp]); } else { skipped++; } });
      if (aoa.length === 2) { showAlert('Tidak ada data untuk diekspor.', 'error'); return; }
      if (skipped > 0) showAlert(`${skipped} item dilewati.`, 'info');
      exportExcelAoA(aoa, 'PROMO_TANPA_STOK');
    }
  };

  const dlWithStock = () => {
    const list = getSelectedDataForExport();
    if (activePlatform === 'shopee') {
      const aoa = [SHOPEE_HEADER_ROW0, SHOPEE_HEADER_ROW1, SHOPEE_HEADER_ROW2];
      let skipped = 0;
      list.forEach(item => { const hp = getDisplayValue(item.id, 'harga_promo'); const sp = getDisplayValue(item.id, 'stok_promo'); if (hp && sp) { const bp = getDisplayValue(item.id, 'batas_pembelian'); aoa.push([item.product_name||'', item.product_id, item.variation_value||'', item.sku_id||'', '','','','','','', hp, '', item.stok_saat_ini||'', sp, bp||'']); } else { skipped++; } });
      if (aoa.length === 3) { showAlert('Pastikan Harga & Stok terisi.', 'error'); return; }
      if (skipped > 0) showAlert(`${skipped} item dilewati.`, 'info');
      exportExcelAoA(aoa, 'SHOPEE_KAMPANYE_DENGAN_STOK');
    } else {
      const aoa = [['Kiat: Periksa persyaratan kampanye sebelum mengunggah file'],['Product ID','SKU ID','Campaign price','Campaign stock']];
      let skipped = 0;
      list.forEach(item => { const hp = getDisplayValue(item.id, 'harga_promo'); const sp = getDisplayValue(item.id, 'stok_promo'); if (hp && sp) { aoa.push([item.product_id, item.sku_id||'', hp, sp]); } else { skipped++; } });
      if (aoa.length === 2) { showAlert('Tidak ada data untuk diekspor.', 'error'); return; }
      if (skipped > 0) showAlert(`${skipped} item dilewati.`, 'info');
      exportExcelAoA(aoa, 'PROMO_DENGAN_STOK');
    }
  };

  if (!activeStore) return <div className="im-container"><h2 className="im-title">Pilih toko aktif terlebih dahulu.</h2></div>;

  return (
    <div className="im-container">
      <div className="im-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div className="im-header-left">
            <div className="im-icon-box"><Package size={22}/></div>
            <div><h2 className="im-title">Kampanye</h2><p className="im-subtitle">{stats.total} Variasi Produk</p></div>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            <button onClick={() => setActivePlatform('tiktok')} style={{ border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: activePlatform === 'tiktok' ? 'var(--accent-primary)' : 'transparent', color: activePlatform === 'tiktok' ? '#fff' : 'var(--text-secondary)' }}>TikTok</button>
            <button onClick={() => setActivePlatform('shopee')} style={{ border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: activePlatform === 'shopee' ? '#ee4d2d' : 'transparent', color: activePlatform === 'shopee' ? '#fff' : 'var(--text-secondary)' }}>Shopee</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="im-header-stats" style={{ flex: 1 }}>
            <div className="im-stat-chip im-stat-filled"><CheckCircle2 size={14}/> <span>{stats.filled} terisi</span></div>
            <div className="im-stat-chip im-stat-unfilled"><Circle size={14}/> <span>{stats.unfilled} belum</span></div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input type="file" id="upload-products" accept=".xlsx" onChange={handleProductUpload} style={{ display: 'none' }}/>
            <label htmlFor="upload-products" className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Upload size={13}/> Upload Produk</label>
            <input type="file" id="upload-fails" accept=".xlsx" onChange={handleFailUpload} style={{ display: 'none' }}/>
            <label htmlFor="upload-fails" className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={13}/> Fail</label>
            {selectedIds.size > 0 && (
              <button className="btn-danger" onClick={handleDeleteChecked} style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={13}/> Hapus ({selectedIds.size})</button>
            )}
            <button className="btn-secondary" onClick={dlWithoutStock} style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Download size={13}/> DL Tanpa Stok</button>
            <button className="btn-secondary" onClick={dlWithStock} style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Download size={13}/> DL + Stok</button>
            <div style={{ position: 'relative' }}>
              <button className="btn-secondary" onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)} style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Bookmark size={13}/> Template <ChevronDown size={11}/>
              </button>
              {isTemplateDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsTemplateDropdownOpen(false)}/>
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, padding: '0.4rem', minWidth: '230px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <button onClick={() => { setIsTemplateDropdownOpen(false); setShowTemplateModal(true); }} style={{ textAlign: 'left', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-primary)' }}>+ Simpan Settingan Saat Ini</button>
                    {templates.length > 0 && <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.3rem 0' }}/>}
                    {templates.map(tpl => (
                      <div key={tpl.id} onClick={() => handleLoadTemplate(tpl)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tpl.name}>{tpl.name}</span>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button onClick={e => handleUpdateTemplate(tpl.id, tpl.name, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', padding: '2px' }} title="Update settingan ini"><Save size={13}/></button>
                          <button onClick={e => handleDeleteTemplate(tpl.id, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)', display: 'flex', padding: '2px' }} title="Hapus"><Trash2 size={13}/></button>
                        </div>
                      </div>
                    ))}
                    {templates.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '0.4rem 0.6rem', margin: 0 }}>Belum ada settingan tersimpan.</p>}
                  </div>
                </>
              )}
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !isDirty} style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> : <Save size={13}/>} Simpan {isDirty ? '*' : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="im-progress-wrapper"><div className="im-progress-bar"><div className="im-progress-fill" style={{ width: `${progressPercent}%` }}/></div></div>

      <div className="im-toolbar">
        <div className="im-search-box">
          <Search size={16} className="im-search-icon"/>
          <input type="text" placeholder="Cari SKU atau Produk..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="im-search-input"/>
          {searchQuery && <button className="im-search-clear" onClick={() => setSearchQuery('')}><X size={14}/></button>}
        </div>
        <div className="im-filter-tabs">
          <button className={`im-filter-tab ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>Semua</button>
          <button className={`im-filter-tab ${filterMode === 'filled' ? 'active' : ''}`} onClick={() => setFilterMode('filled')}>Terisi</button>
          <button className={`im-filter-tab ${filterMode === 'unfilled' ? 'active' : ''}`} onClick={() => setFilterMode('unfilled')}>Belum</button>
          {uniqueReasons.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button className={`im-filter-tab ${selectedErrors.size > 0 ? 'active' : ''}`} onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={12}/> Gagal {selectedErrors.size > 0 ? `(${selectedErrors.size})` : ''} <ChevronDown size={11}/>
              </button>
              {isDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsDropdownOpen(false)}/>
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, padding: '0.5rem', minWidth: '200px' }}>
                    {uniqueReasons.map(reason => (
                      <label key={reason} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '0.3rem 0.2rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                        <input type="checkbox" checked={selectedErrors.has(reason)} onChange={() => { const next = new Set(selectedErrors); next.has(reason) ? next.delete(reason) : next.add(reason); setSelectedErrors(next); }}/>
                        <span style={{ color: 'var(--text-secondary)' }}>{reason}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }}/></div>
      ) : (
        <div className="im-cards-grid">
          {filteredGroups.length === 0 ? (
            <div className="im-empty"><Filter size={40}/><p>Tidak ada produk yang cocok.</p></div>
          ) : filteredGroups.map(group => {
            const isExpanded = expandedSkus.has(group.key);
            const allSelected = group.ids.every(id => selectedIds.has(id));
            const someSelected = group.ids.some(id => selectedIds.has(id));
            const bulk = bulkInputs[group.key] || { harga: '', stok: '', batas: '' };
            return (
              <div key={group.key} className="im-card">
                <div className="im-card-header" style={{ gap: '0.5rem', cursor: 'pointer' }} onClick={() => { const next = new Set(expandedSkus); next.has(group.key) ? next.delete(group.key) : next.add(group.key); setExpandedSkus(next); }}>
                  <div onClick={e => { e.stopPropagation(); toggleSelectGroup(group); }} style={{ color: allSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)', cursor: 'pointer' }}>
                    {allSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                  </div>
                  <div className="im-card-left" style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{group.seller_sku || group.product_id || group.product_name}</div>
                    {(group.seller_sku || group.product_id) && group.product_name && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{group.product_name}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '4px' }}>⊙ {group.variations.length} variasi</span>
                    <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}/>
                  </div>
                </div>

                {isExpanded && (
                  <div className="im-variations" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="im-bulk-wrap">
                      <div className="im-bulk-row">
                        <Zap size={12} className="im-bulk-icon" style={{ flexShrink: 0 }}/>
                        <span className="im-bulk-label" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}>Isi Masal{someSelected ? ` (${Array.from(selectedIds).filter(id => group.ids.includes(id)).length})` : ''}:</span>
                        {(() => {
                          const types = getVariationTypes(group.variations);
                          if (types.length === 0) return <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Semua variasi</span>;
                          return types.map((t, idx) => {
                            const options = getVariationOptions(group.variations, idx);
                            if (options.length <= 1) return null;
                            return <select key={idx} className="im-input im-input-sm" style={{ width: 'auto', minWidth: '70px', maxWidth: '110px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} value={(bulk.selections && bulk.selections[idx]) || 'Semua'} onChange={e => handleBulkDropdownChange(group.key, idx, e.target.value)}><option value="Semua">Semua</option>{options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>;
                          });
                        })()}
                      </div>
                      <div className="im-bulk-row im-bulk-row-2">
                        <input type="text" placeholder="Harga Promo" className="im-bulk-input" value={bulk.harga || ''} onChange={e => setBulkInputs({...bulkInputs, [group.key]: {...bulk, harga: e.target.value}})} style={{ flex: '1 1 75px', minWidth: '60px', maxWidth: '110px', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}/>
                        <input type="text" placeholder="Stok" className="im-bulk-input" value={bulk.stok || ''} onChange={e => setBulkInputs({...bulkInputs, [group.key]: {...bulk, stok: e.target.value}})} style={{ flex: '1 1 50px', minWidth: '40px', maxWidth: '65px', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}/>
                        {activePlatform === 'shopee' && <input type="text" placeholder="Batas Beli" className="im-bulk-input" value={bulk.batas || ''} onChange={e => setBulkInputs({...bulkInputs, [group.key]: {...bulk, batas: e.target.value}})} style={{ flex: '1 1 65px', minWidth: '50px', maxWidth: '80px', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}/>}
                        <button className="im-bulk-apply" onClick={() => applyBulkEdit(group.key, group.variations, bulk.harga||'', bulk.stok||'', bulk.batas||'')} style={{ padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}><Save size={11}/> Terapkan</button>
                        {activePlatform === 'shopee' && (
                          <button className="im-bulk-apply" title="Isi dari Rekomendasi Shopee"
                            onClick={() => { setEditedValues(prev => { const next = {...prev}; group.variations.forEach(v => { if (v.saran_harga) next[v.id] = {...next[v.id], harga_promo: v.saran_harga}; }); return next; }); setIsDirty(true); }}
                            style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Reko</button>
                        )}
                      </div>
                    </div>
                    <div className="im-var-list">
                      {group.variations.map(item => {
                        const hp = getDisplayValue(item.id, 'harga_promo');
                        const sp = getDisplayValue(item.id, 'stok_promo');
                        const isChecked = selectedIds.has(item.id);
                        const reason = failedReasons.get(item.sku_id);
                        const isEdited = editedValues[item.id] !== undefined;
                        return (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', minHeight: '40px' }}>
                            <div onClick={() => toggleSelectId(item.id)} style={{ color: isChecked ? 'var(--accent-primary)' : 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}>
                              {isChecked ? <CheckSquare size={16}/> : <Square size={16}/>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.variation_value || '-'}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                {item.sku_id} {(item.stok_saat_ini != null || item.quantity != null) ? `· ${item.stok_saat_ini ?? item.quantity} stk` : ''}
                                {item.saran_harga && activePlatform === 'shopee' && <span style={{ marginLeft: '4px', color: '#16a34a' }} title={`Rekomendasi: ${fmtRp(item.saran_harga)}`}>★ {fmtRp(item.saran_harga)}</span>}
                              </div>
                              {reason && <div style={{ fontSize: '0.68rem', color: 'var(--accent-danger)', background: 'rgba(239,68,68,0.08)', padding: '2px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }} title={reason}>✗ {reason.length > 40 ? reason.slice(0,40)+'…' : reason}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
                              <input type="text" className="im-input" value={hp != null ? String(hp) : ''} onChange={e => handleInputChange(item.id, 'harga_promo', e.target.value)} placeholder="Hrg Promo" style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.75rem', border: isEdited && editedValues[item.id]?.harga_promo !== undefined ? '1.5px solid var(--accent-primary)' : undefined }}/>
                              <input type="text" className="im-input" value={sp != null ? String(sp) : ''} onChange={e => handleInputChange(item.id, 'stok_promo', e.target.value)} placeholder="Stok" style={{ width: '55px', padding: '0.3rem 0.5rem', fontSize: '0.75rem', border: isEdited && editedValues[item.id]?.stok_promo !== undefined ? '1.5px solid var(--accent-primary)' : undefined }}/>
                              {activePlatform === 'shopee' && <input type="text" className="im-input" value={getDisplayValue(item.id, 'batas_pembelian') != null ? String(getDisplayValue(item.id, 'batas_pembelian')) : ''} onChange={e => handleInputChange(item.id, 'batas_pembelian', e.target.value)} placeholder="Batas" style={{ width: '55px', padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}/>}
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
      )}

      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', width: '340px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Simpan Settingan Harga</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Menyimpan produk yang dicentang (atau semua yang terisi jika tidak ada centang).</p>
            <input type="text" placeholder="Nama settingan, misal: Promo 12.12" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} autoFocus/>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => { setShowTemplateModal(false); setTemplateName(''); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>Batal</button>
              <button className="btn-primary" onClick={handleSaveTemplate} style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {imAlert.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: imAlert.type === 'error' ? 'var(--accent-danger)' : imAlert.type === 'confirm' ? '#eab308' : 'var(--accent-primary)' }}>
              <AlertCircle size={22}/>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{imAlert.type === 'error' ? 'Pesan Kesalahan' : imAlert.type === 'confirm' ? 'Konfirmasi' : 'Informasi'}</h3>
            </div>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>{imAlert.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {imAlert.type === 'confirm' && <button className="btn-secondary" onClick={() => setImAlert({ ...imAlert, show: false })} style={{ padding: '0.5rem 1rem' }}>Batal</button>}
              <button className={imAlert.type === 'error' ? 'btn-danger' : 'btn-primary'} onClick={() => { if (imAlert.onConfirm) imAlert.onConfirm(); setImAlert({ ...imAlert, show: false }); }} style={{ padding: '0.5rem 1rem' }}>
                {imAlert.type === 'confirm' ? 'Ya, Lanjutkan' : 'Mengerti'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Kampanye;
