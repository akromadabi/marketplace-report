import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import FileInputList from "./FileInputList";
import { Upload as UploadIcon, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, Trash2, Clock, Database, Store } from "lucide-react";
import { apiUploadFiles, apiUploadParsedFiles, apiGetUploadHistory, apiDeleteUpload, apiAssignOrphanUploads } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { useDataCache } from '../contexts/DataContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

function formatDateIndo(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dayName}, ${day} ${monthName} ${year} (${hours}:${minutes})`;
}

// Banner: tampil jika ada file upload lama tanpa store_id
function MigrateOrphanBanner({ userId, storeId, onMigrated, migratingOrphans, setMigratingOrphans, uploadHistory, historyLoading }) {
  // Cek apakah ada item di history yang store_id-nya NULL (orphan)
  // Server sudah include orphan di query setelah fix, tapi kita cek dari history yang sudah ada
  // Kita tampilkan banner selama history belum di-load atau saat pertama kali
  const [checked, setChecked] = useState(false);
  const [hasOrphans, setHasOrphans] = useState(false);

  useEffect(() => {
    if (!historyLoading && !checked) {
      setChecked(true);
      // Jika history kosong padahal ada userId, mungkin ada orphan
      // Kita cek dengan hit endpoint assign-store dengan dry-run approach
      // Karena kita tidak punya dry-run, kita tampilkan banner selektif:
      // Tampilkan jika history === 0 (kemungkinan data orphan belum terlink ke store)
      setHasOrphans(uploadHistory.length === 0);
    }
  }, [historyLoading, uploadHistory, checked]);

  if (!hasOrphans || historyLoading) return null;

  async function handleMigrate() {
    setMigratingOrphans(true);
    try {
      const res = await apiAssignOrphanUploads(userId, storeId);
      onMigrated(res.updated || 0);
    } catch (e) {
      /* ignore */
    }
    setMigratingOrphans(false);
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.875rem 1rem',
      background: 'rgba(6, 182, 212, 0.06)',
      border: '1px solid rgba(6, 182, 212, 0.2)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: '1.25rem',
      flexWrap: 'wrap',
    }}>
      <Database size={18} color="#06b6d4" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.125rem' }}>
          Data Sebelumnya Terdeteksi
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Anda mungkin memiliki file yang diupload sebelum toko dibuat. Klik tombol untuk mengaitkan data tersebut ke toko aktif.
        </p>
      </div>
      <button
        type="button"
        onClick={handleMigrate}
        disabled={migratingOrphans}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
          background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)',
          color: '#06b6d4', fontWeight: 600, fontSize: '0.8125rem', cursor: migratingOrphans ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        {migratingOrphans
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /><span>Memproses...</span></>
          : <><CheckCircle2 size={14} /><span>Tautkan Data Lama</span></>
        }
      </button>
    </div>
  );
}

function UploadFile() {
  const { user } = useAuth();
  const { activeStoreId, stores, loading: storesLoading } = useStore();
  const { invalidateAll } = useDataCache();
  const { addNotification, updateNotification } = useNotification();
  const navigate = useNavigate();
  const [allFiles, setAllFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [fileCategoryMap, setFileCategoryMap] = useState({});
  const [fileParsedDataMap, setFileParsedDataMap] = useState({});
  const [fileRowCountMap, setFileRowCountMap] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [migratingOrphans, setMigratingOrphans] = useState(false);
  const [orphanMigrated, setOrphanMigrated] = useState(null);
  // uploadProgress: array of { fileName, pct, done } — one per file being uploaded
  const [uploadProgress, setUploadProgress] = useState([]);
  const inputRef = useRef(null);
  const progressRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setUploadHistory([]); // reset dulu agar tidak ada duplikat
    try {
      const data = await apiGetUploadHistory(user?.id, activeStoreId);
      setUploadHistory(data);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, [user?.id, activeStoreId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Cegah refresh / tutup tab saat upload sedang berjalan
  useEffect(() => {
    if (!uploading) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Upload sedang berjalan. Jika Anda refresh atau meninggalkan halaman, proses upload akan berhenti dan data mungkin tidak tersimpan.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  // Auto-scroll ke progress panel saat upload mulai
  useEffect(() => {
    if (uploading && progressRef.current) {
      progressRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [uploading]);

  async function handleDeleteUpload(id) {
    if (!window.confirm('Hapus upload ini beserta semua datanya?')) return;
    setDeletingId(id);
    try {
      await apiDeleteUpload(id);
      setUploadHistory(prev => prev.filter(u => u.id !== id));
      invalidateAll(); // Clear data cache since data was removed
    } catch (err) {
      setError(err.message || 'Gagal menghapus');
    }
    setDeletingId(null);
  }

  const platformIcons = {
    tiktok: "https://static.vecteezy.com/system/resources/previews/023/986/939/non_2x/tiktok-logo-tiktok-logo-transparent-tiktok-icon-transparent-free-free-png.png",
    shopee: "https://static.vecteezy.com/system/resources/previews/053/407/516/non_2x/shopee-logo-shopee-icon-transparent-social-media-icons-free-png.png",
    lazada: "https://static.cdnlogo.com/logos/l/48/lazada-icon800x800.png",
    tokopedia: "https://freelogopng.com/images/all_img/1691990957tokopedia-icon-png.png",
    pengembalian: "https://png.pngtree.com/png-clipart/20231220/original/pngtree-refund-icon-rebate-photo-png-image_13884984.png",
    unknown: "https://icons.iconarchive.com/icons/custom-icon-design/flatastic-1/512/delete-icon.png",
  };

  const shopeeOrdersHeaders = ["no. pesanan", "status pesanan", "status pembatalan/ pengembalian", "no. resi", "opsi pengiriman", "antar ke counter/ pick-up"];
  const shopeeHeaderMap = {
    "no. pesanan": "Order ID",
    "status pesanan": "Order Status",
    "nomor referensi sku": "SKU ID",
    "sku induk": "Seller SKU",
    "nama produk": "Product Name",
    "nama variasi": "Variation",
    "jumlah produk di pesan": "Quantity",
    "total pembayaran": "Order Amount",
    "waktu pesanan dibuat": "Created Time",
    "waktu pengiriman diatur": "Shipped Time",
    "waktu pesanan selesai": "Delivered Time",
    "alasan pembatalan": "Cancel Reason",
    "no. resi": "Tracking ID",
    "opsi pengiriman": "Shipping Provider Name",
    "catatan dari pembeli": "Buyer Message",
    "username (pembeli)": "Buyer Username",
    "no. telepon": "Phone #",
    "provinsi": "Province",
    "kota/kabupaten": "Regency and City",
    "alamat pengiriman": "Detail Address",
    "metode pembayaran": "Payment Method",
  };

  const shopeeReturnHeaders = ["no. pengembalian", "no. pesanan", "solusi pengembalian barang/dana", "tipe pengembalian", "status pembatalan/ pengembalian"];

  function detectPlatformAndCategory(headers, sheetNames) {
    const normalized = headers.map((h) => h.toString().trim().toLowerCase());
    const tiktokOrdersHeaders = ["order id", "order status", "order substatus", "cancelation/return type", "normal or pre-order", "sku id", "seller sku", "product name", "variation"];
    // Core TikTok payments headers (required)
    const tiktokPaymentsCoreHeaders = ["order/adjustment id", "total settlement amount"];
    // Extended headers — one group must match (old vs new format)
    const tiktokPaymentsOldHeaders = ["total revenue", "subtotal after seller discounts", "customer payment"];
    const tiktokPaymentsNewHeaders = ["total revenue", "subtotal after seller discounts"];
    const tiktokPaymentsFlexHeaders = ["order created time", "order settled time"];
    const tiktokReturnHeaders = ["return order id", "order id", "order amount", "order status", "order substatus", "payment method", "sku id"];
    // TikTok Income format baru: sheet "Order details" dengan kolom settlement
    if (sheetNames && sheetNames.includes('Order details')) {
      const hasCore = tiktokPaymentsCoreHeaders.every((h) => normalized.some(fh => fh.startsWith(h)));
      if (hasCore) return { platform: "tiktok", category: "payments" };
    }
    // Shopee Income (payments): multi-sheet file with "Income" sheet — check first
    if (sheetNames && sheetNames.includes('Income')) return { platform: "shopee", category: "payments" };
    // Shopee return/refund — must come before generic pengembalian (both have tanggal+resi)
    if (shopeeReturnHeaders.every((h) => normalized.includes(h))) return { platform: "shopee", category: "return" };
    // Shopee orders — must come before generic pengembalian (failed_delivery has tanggal+resi too)
    const hasShopeeHeaders = shopeeOrdersHeaders.every((h) => normalized.includes(h));
    if (hasShopeeHeaders) return { platform: "shopee", category: "orders" };
    const hasTanggal = normalized.some((h) => h.includes("tanggal"));
    const hasResi = normalized.some((h) => h.includes("resi"));
    if (hasTanggal && hasResi) return { platform: "none", category: "pengembalian" };
    if (tiktokOrdersHeaders.every((h) => normalized.includes(h)) && normalized.length >= tiktokOrdersHeaders.length) return { platform: "tiktok", category: "orders" };
    // TikTok payments: core headers + either old or new extended headers + flex date headers
    const hasCore = tiktokPaymentsCoreHeaders.every((h) => normalized.some(fh => fh.startsWith(h)));
    const hasFlex = tiktokPaymentsFlexHeaders.every((prefix) => normalized.some((h) => h.startsWith(prefix)));
    const hasOldFormat = tiktokPaymentsOldHeaders.every((h) => normalized.some(fh => fh.startsWith(h)));
    const hasNewFormat = tiktokPaymentsNewHeaders.every((h) => normalized.some(fh => fh.startsWith(h)));
    if (hasCore && hasFlex && (hasOldFormat || hasNewFormat)) return { platform: "tiktok", category: "payments" };
    if (tiktokReturnHeaders.every((h) => normalized.includes(h)) && normalized.length >= tiktokReturnHeaders.length) return { platform: "tiktok", category: "return" };
    return { platform: "unknown", category: "unknown" };
  }

  function mapShopeeHeadersToStandard(data) {
    return data.map((row) => {
      const newRow = {};
      Object.entries(row).forEach(([key, value]) => {
        const lowerKey = key.toString().trim().toLowerCase();
        if (shopeeHeaderMap[lowerKey]) newRow[shopeeHeaderMap[lowerKey]] = value;
      });
      return newRow;
    });
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // Fix incorrect !ref in xlsx sheets by scanning actual cell keys
          const fixRange = (ws) => {
            if (!ws || !ws['!ref']) return;
            let maxR = 0, maxC = 0;
            for (const key of Object.keys(ws)) {
              if (key.startsWith('!')) continue;
              const m = key.match(/^([A-Z]+)(\d+)$/);
              if (!m) continue;
              const r = parseInt(m[2], 10);
              let c = 0;
              for (let i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64);
              if (r > maxR) maxR = r;
              if (c > maxC) maxC = c;
            }
            if (maxR > 0) {
              const cur = XLSX.utils.decode_range(ws['!ref']);
              if (maxR - 1 > cur.e.r || maxC - 1 > cur.e.c) {
                ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR - 1, c: Math.max(maxC - 1, cur.e.c) } });
              }
            }
          };
          fixRange(worksheet);
          const headers = [];
          const range = XLSX.utils.decode_range(worksheet["!ref"]);
          const firstRow = range.s.r;
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ c: C, r: firstRow });
            const cell = worksheet[cellRef];
            if (cell && cell.v !== undefined) headers.push(cell.v.toString());
          }
          const { platform, category } = detectPlatformAndCategory(headers, workbook.SheetNames);
          let jsonData;
          // Special handling for TikTok Income format baru (sheet: "Order details")
          if (platform === 'tiktok' && category === 'payments' && workbook.SheetNames.includes('Order details')) {
            const orderDetailsSheet = workbook.Sheets['Order details'];
            if (orderDetailsSheet) {
              // Read directly — format baru sudah punya header di baris pertama
              jsonData = XLSX.utils.sheet_to_json(orderDetailsSheet, { defval: '' });
            } else {
              jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            }
          // Special handling for Shopee Income (payments)
          } else if (platform === 'shopee' && category === 'payments') {
            const incomeSheet = workbook.Sheets['Income'];
            if (incomeSheet) {
              const incomeRange = XLSX.utils.decode_range(incomeSheet['!ref']);
              const incomeHeaders = [];
              for (let C = incomeRange.s.c; C <= incomeRange.e.c; ++C) {
                const cell = incomeSheet[XLSX.utils.encode_cell({ c: C, r: 5 })];
                incomeHeaders.push(cell && cell.v !== undefined ? cell.v.toString().trim() : '');
              }
              const rows = [];
              for (let R = 6; R <= incomeRange.e.r; R++) {
                const row = {};
                let hasData = false;
                for (let C = 0; C < incomeHeaders.length; C++) {
                  const cell = incomeSheet[XLSX.utils.encode_cell({ c: C, r: R })];
                  const val = cell && cell.v !== undefined ? cell.v : '';
                  if (incomeHeaders[C]) row[incomeHeaders[C]] = val;
                  if (val !== '' && val !== 0) hasData = true;
                }
                if (hasData && row['No. Pesanan']) rows.push(row);
              }
              jsonData = rows;
            } else {
              jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            }
          } else {
            jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          }
          if (category === "orders" && platform === "tiktok") jsonData = jsonData.slice(1);
          if (category === "pengembalian") {
            jsonData = jsonData.map((row) => {
              const newRow = { ...row };
              Object.keys(newRow).forEach((key) => {
                if (/tanggal|date/i.test(key)) {
                  const val = newRow[key];
                  if (val) {
                    let dateObj = null;
                    if (val instanceof Date) dateObj = val;
                    else if (typeof val === "number") {
                      const d = XLSX.SSF.parse_date_code(val);
                      if (d) dateObj = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S));
                    } else if (typeof val === "string") {
                      let parsedDate = new Date(val);
                      if (!isNaN(parsedDate)) dateObj = parsedDate;
                      else {
                        const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
                        if (m) {
                          const mm = parseInt(m[1], 10);
                          const dd = parseInt(m[2], 10);
                          const yyyy = parseInt(m[3], 10);
                          const hh = m[4] ? parseInt(m[4], 10) : 0;
                          const min = m[5] ? parseInt(m[5], 10) : 0;
                          const ss = m[6] ? parseInt(m[6], 10) : 0;
                          dateObj = new Date(yyyy, mm - 1, dd, hh, min, ss);
                        }
                      }
                    }
                    if (dateObj && !isNaN(dateObj)) newRow[key] = formatDateIndo(dateObj);
                  }
                }
              });
              return newRow;
            });
          }
          if (platform === "shopee" && category === "orders") jsonData = mapShopeeHeadersToStandard(jsonData);
          resolve({ file, platform, category, data: jsonData });
        } catch {
          reject("Gagal membaca salah satu file. Pastikan file valid.");
        }
      };
      reader.onerror = () => reject("Gagal membaca salah satu file. Pastikan file valid.");
      reader.readAsArrayBuffer(file);
    });
  }

  function addFiles(newFiles) {
    setError("");
    setAllFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => f.name + f.size));
      const filteredNew = newFiles.filter((f) => !existingKeys.has(f.name + f.size));
      return [...prev, ...filteredNew];
    });
  }

  function onFileChange(e) {
    addFiles(Array.from(e.target.files));
    e.target.value = null;
  }

  function removeFile(index) {
    setAllFiles((prev) => {
      const newArr = [...prev];
      const keyToRemove = prev[index].name + prev[index].size;
      newArr.splice(index, 1);
      setFileCategoryMap((p) => { const m = { ...p }; delete m[keyToRemove]; return m; });
      setFileParsedDataMap((p) => { const m = { ...p }; delete m[keyToRemove]; return m; });
      setFileRowCountMap((p) => { const m = { ...p }; delete m[keyToRemove]; return m; });
      return newArr;
    });
  }

  const [filePlatformCache, setFilePlatformCache] = useState({});

  useEffect(() => {
    async function detectAll() {
      const newCache = { ...filePlatformCache };
      const newCategoryMap = { ...fileCategoryMap };
      const newParsedDataMap = { ...fileParsedDataMap };
      const newRowCountMap = { ...fileRowCountMap };
      for (const file of allFiles) {
        const key = file.name + file.size;
        if (!(key in newCache)) {
          try {
            const { platform, category, data } = await parseFile(file);
            newCache[key] = platform;
            newCategoryMap[key] = category;
            newParsedDataMap[key] = data;
            newRowCountMap[key] = data.length;
            setFilePlatformCache({ ...newCache });
            setFileCategoryMap({ ...newCategoryMap });
            setFileParsedDataMap({ ...newParsedDataMap });
            setFileRowCountMap({ ...newRowCountMap });
          } catch {
            newCache[key] = "unknown";
            newCategoryMap[key] = "unknown";
            newParsedDataMap[key] = [];
            newRowCountMap[key] = 0;
            setFilePlatformCache({ ...newCache });
            setFileCategoryMap({ ...newCategoryMap });
            setFileParsedDataMap({ ...newParsedDataMap });
            setFileRowCountMap({ ...newRowCountMap });
          }
        }
      }
    }
    if (allFiles.length > 0) detectAll();
    else {
      setFilePlatformCache({});
      setFileCategoryMap({});
      setFileParsedDataMap({});
      setFileRowCountMap({});
    }
  }, [allFiles]);

  function getIconForFile(file, category) {
    const key = file.name + file.size;
    const platform = filePlatformCache[key] || "unknown";
    if (category === "pengembalian") return platformIcons.pengembalian;
    return platformIcons[platform] || platformIcons.unknown;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    if (allFiles.length === 0) { setError("Harap unggah minimal satu file."); return; }
    setUploading(true);
    // Initialise progress entries for all files
    const payloadData = allFiles.map((file) => {
      const key = file.name + file.size;
      return {
        filename: file.name,
        platform: filePlatformCache[key],
        category: fileCategoryMap[key],
        jsonData: fileParsedDataMap[key] || [],
      };
    });
    setUploadProgress(payloadData.map(f => ({ fileName: f.filename, pct: 0, done: false, active: false })));
    const notifId = addNotification({
      type: 'loading',
      message: `Memproses ${allFiles.length} file... Anda bisa berpindah halaman, proses tetap berjalan.`,
      persistent: true,
    });
    try {
      const result = await apiUploadParsedFiles(payloadData, user?.id, activeStoreId, ({ fileIdx, pct, done }) => {
        setUploadProgress(prev => prev.map((entry, idx) => {
          if (idx === fileIdx) return { ...entry, pct, done, active: !done };
          if (idx < fileIdx) return { ...entry, done: true, pct: 100, active: false };
          return entry;
        }));
      });
      setSuccess({ ...result.results, skipped: result.skipped, totalSkipped: result.totalSkipped || 0 });
      setAllFiles([]);
      setFileCategoryMap({});
      setFileParsedDataMap({});
      setFileRowCountMap({});
      setFilePlatformCache({});
      setUploadProgress([]);
      fetchHistory();
      invalidateAll();
      const parts = [];
      if (result.results.orders > 0) parts.push(`${result.results.orders} pesanan`);
      if (result.results.payments > 0) parts.push(`${result.results.payments} pembayaran`);
      if (result.results.returns > 0) parts.push(`${result.results.returns} retur`);
      if (result.results.pengembalian > 0) parts.push(`${result.results.pengembalian} pengembalian`);
      const skipText = (result.totalSkipped || 0) > 0 ? ` (${result.totalSkipped} duplikat dilewati)` : '';
      updateNotification(notifId, {
        type: 'success',
        message: `Upload selesai! ${parts.join(', ')} tersimpan.${skipText}`,
        persistent: false,
        duration: 6000,
      });
    } catch (err) {
      setError(err.message || 'Gagal mengupload file');
      updateNotification(notifId, {
        type: 'error',
        message: `Upload gagal: ${err.message || 'Terjadi kesalahan'}`,
        persistent: false,
        duration: 8000,
      });
    }
    setUploading(false);
  }

  // Drag and drop handlers
  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (files.length > 0) addFiles(files);
  }

  const filesByCategory = useMemo(() => {
    const ordersFiles = [], paymentsFiles = [], returnFiles = [], pengembalianFiles = [];
    allFiles.forEach((file) => {
      const key = file.name + file.size;
      const category = fileCategoryMap[key];
      if (category === "orders") ordersFiles.push(file);
      else if (category === "payments") paymentsFiles.push(file);
      else if (category === "return") returnFiles.push(file);
      else if (category === "pengembalian") pengembalianFiles.push(file);
    });
    return { ordersFiles, paymentsFiles, returnFiles, pengembalianFiles };
  }, [allFiles, fileCategoryMap]);

  const categoryBoxes = [
    { key: 'orders', label: 'Pesanan', files: filesByCategory.ordersFiles, gradient: 'var(--gradient-primary)', borderColor: 'rgba(124, 58, 237, 0.3)' },
    { key: 'payments', label: 'Pembayaran', files: filesByCategory.paymentsFiles, gradient: 'var(--gradient-success)', borderColor: 'rgba(16, 185, 129, 0.3)' },
    { key: 'return', label: 'Retur', files: filesByCategory.returnFiles, gradient: 'var(--gradient-warning)', borderColor: 'rgba(245, 158, 11, 0.3)' },
    { key: 'pengembalian', label: 'Pengembalian', files: filesByCategory.pengembalianFiles, gradient: 'var(--gradient-pink)', borderColor: 'rgba(236, 72, 153, 0.3)' },
  ];

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Gate: harus ada store dulu sebelum upload
  const noStore = !storesLoading && stores.length === 0;

  return (
    <div>
      <div className="page-header">
        <h2 className="gradient-text" style={isMobile ? { fontSize: '1.125rem' } : undefined}>Upload File Excel</h2>
        <p style={isMobile ? { fontSize: '0.6875rem' } : undefined}>Upload file data dari TikTok Shop dan Shopee, sistem akan mendeteksi otomatis</p>
      </div>

      {/* Gate: belum ada toko */}
      {noStore && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          padding: '2.5rem 1.5rem',
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: 'var(--radius-lg)',
            background: 'rgba(245, 158, 11, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Store size={24} color="#f59e0b" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              Buat Toko Terlebih Dahulu
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '380px' }}>
              Anda perlu membuat minimal satu toko sebelum bisa mengupload data. Toko digunakan untuk memisahkan data antar platform.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/stores')}
            className="btn-primary"
            style={{ padding: '0.625rem 1.5rem', fontSize: '0.875rem' }}
          >
            <Store size={16} />
            <span>Buat Toko Sekarang</span>
          </button>
        </div>
      )}

      {/* Banner: migrate data lama ke store aktif */}
      {!noStore && activeStoreId && (
        <div id="migrate-orphan-banner" style={{ display: 'none' }}>
          {/* Hidden by default, will be shown by JS below */}
        </div>
      )}

      {/* Banner: migrate data lama — tampil jika ada histori tanpa store */}
      {!noStore && activeStoreId && !orphanMigrated && (
        <MigrateOrphanBanner
          userId={user?.id}
          storeId={activeStoreId}
          onMigrated={(count) => {
            setOrphanMigrated(count);
            fetchHistory();
            invalidateAll();
          }}
          migratingOrphans={migratingOrphans}
          setMigratingOrphans={setMigratingOrphans}
          uploadHistory={uploadHistory}
          historyLoading={historyLoading}
        />
      )}

      <form onSubmit={handleSubmit} style={{ opacity: noStore ? 0.4 : 1, pointerEvents: noStore ? 'none' : 'auto' }}>
        {/* Drop Zone */}
        <div
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
          }}>
            <UploadIcon size={28} color="white" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Drag & drop file di sini
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
              atau <span style={{ color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>klik untuk browse</span> • .xlsx, .xls
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* File List */}
        {allFiles.length > 0 && (
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {allFiles.length} File Dipilih
                </span>
              </div>
            </div>
            <FileInputList
              label=""
              files={allFiles}
              onRemove={removing => !uploading && removeFile(removing)}
              iconSrcGetter={getIconForFile}
              fileCategoryMap={fileCategoryMap}
              fileRowCountMap={fileRowCountMap}
              uploadProgress={uploadProgress}
              uploading={uploading}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: '1rem',
            color: '#f87171',
            fontSize: '0.875rem',
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            marginBottom: '1rem',
            color: '#10b981',
            fontSize: '0.875rem',
          }}>
            <CheckCircle2 size={16} />
            <span>
              Upload berhasil!
              {success.orders > 0 && ` ${success.orders} pesanan`}
              {success.payments > 0 && ` • ${success.payments} pembayaran`}
              {success.returns > 0 && ` • ${success.returns} return`}
              {success.pengembalian > 0 && ` • ${success.pengembalian} pengembalian`}
              {' '}tersimpan di database.
              {success.totalSkipped > 0 && (
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                  {' '}({success.totalSkipped} data duplikat dilewati)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading || allFiles.length === 0}
          className="btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '0.875rem',
            fontSize: '0.9375rem',
            opacity: allFiles.length === 0 ? 0.4 : 1,
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <UploadIcon size={18} />
              <span>Proses Data</span>
            </>
          )}
        </button>
      </form>

      {/* Category summary boxes */}
      {allFiles.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '2rem',
        }}>
          {categoryBoxes.map(({ key, label, files, gradient, borderColor }) => (
            <div
              key={key}
              className="glass-card"
              style={{
                padding: '1rem',
                borderColor: borderColor,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: gradient,
              }} />
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
                background: gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {label}
              </h3>
              {files.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Belum ada file
                </p>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.25rem 0',
                    }}>
                      <FileSpreadsheet size={12} />
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}>
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Upload History ─────────────────────────────────────── */}
      <div style={{ marginTop: isMobile ? '1.5rem' : '2.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? '0.375rem' : '0.625rem',
          marginBottom: isMobile ? '0.75rem' : '1.25rem',
        }}>
          <div style={{
            width: isMobile ? '1.75rem' : '2.25rem', height: isMobile ? '1.75rem' : '2.25rem', borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', opacity: 0.85,
          }}>
            <Database size={isMobile ? 13 : 16} color="white" />
          </div>
          <div>
            <h3 style={{
              fontSize: isMobile ? '0.875rem' : '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0,
            }}>Riwayat Upload</h3>
            <p style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
              {uploadHistory.length} file tersimpan di database
            </p>
          </div>
        </div>

        {historyLoading ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.8125rem' }}>Memuat riwayat...</p>
          </div>
        ) : uploadHistory.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <UploadIcon size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <p style={{ fontSize: '0.875rem' }}>Belum ada file yang diupload</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.375rem' : '0.5rem' }}>
            {uploadHistory.map((item) => {
              const categoryColors = {
                orders: { bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.2)', text: '#7c3aed', label: 'Pesanan' },
                payments: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', text: '#10b981', label: 'Pembayaran' },
                return: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b', label: 'Retur' },
                pengembalian: { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.2)', text: '#ec4899', label: 'Pengembalian' },
              };
              const cat = categoryColors[item.category] || { bg: 'rgba(99,110,114,0.08)', border: 'rgba(99,110,114,0.15)', text: '#636e72', label: item.category };
              const platformLabel = item.platform ? item.platform.charAt(0).toUpperCase() + item.platform.slice(1) : '-';
              // Append 'Z' to treat MySQL UTC string as UTC properly in Javascript
              const dateStr = item.created_at ? new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
              return (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    padding: isMobile ? '0.5rem 0.625rem' : '0.875rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0.5rem' : '0.75rem',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Platform Icon */}
                  <div style={{
                    width: isMobile ? '1.75rem' : '2.25rem', height: isMobile ? '1.75rem' : '2.25rem', borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src={platformIcons[item.platform] || platformIcons[item.category] || platformIcons.unknown}
                      alt={item.platform}
                      style={{ width: isMobile ? '1.25rem' : '1.75rem', height: isMobile ? '1.25rem' : '1.75rem', objectFit: 'contain' }}
                    />
                  </div>

                  {/* File Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: isMobile ? '0.25rem' : '0.5rem',
                      marginBottom: isMobile ? '0.125rem' : '0.25rem', flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontSize: isMobile ? '0.6875rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: isMobile ? '160px' : '300px',
                      }}>
                        {item.filename}
                      </span>
                      <span style={{
                        fontSize: isMobile ? '0.5625rem' : '0.6875rem', fontWeight: 600, padding: isMobile ? '0.0625rem 0.375rem' : '0.125rem 0.5rem',
                        borderRadius: '999px', background: cat.bg, color: cat.text,
                        border: `1px solid ${cat.border}`,
                      }}>
                        {cat.label}
                      </span>
                      {item.platform && item.platform !== 'none' && item.platform !== 'unknown' && (
                        <span style={{
                          fontSize: isMobile ? '0.5625rem' : '0.6875rem', fontWeight: 500, padding: isMobile ? '0.0625rem 0.375rem' : '0.125rem 0.5rem',
                          borderRadius: '999px', background: 'rgba(255,255,255,0.04)',
                          color: 'var(--text-secondary)', border: '1px solid var(--border-primary)',
                        }}>
                          {platformLabel}
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: isMobile ? '0.375rem' : '0.75rem',
                      fontSize: isMobile ? '0.5625rem' : '0.75rem', color: 'var(--text-tertiary)',
                    }}>
                      <span>{item.row_count?.toLocaleString() || 0} baris</span>
                      {item.skipped_rows > 0 && (
                        <span style={{
                          fontSize: isMobile ? '0.5rem' : '0.6875rem',
                          color: '#f59e0b',
                          fontWeight: 500,
                        }}>
                          {item.skipped_rows.toLocaleString()} duplikat dilewati
                        </span>
                      )}
                      {item.uploaded_by && <span>oleh {item.uploaded_by}</span>}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                        <Clock size={isMobile ? 9 : 11} />
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => handleDeleteUpload(item.id)}
                    style={{
                      flexShrink: 0, width: isMobile ? '1.5rem' : '2rem', height: isMobile ? '1.5rem' : '2rem',
                      borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)',
                      background: deletingId === item.id ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.06)',
                      color: '#f87171', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: deletingId === item.id ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (deletingId !== item.id) { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; } }}
                    onMouseLeave={(e) => { if (deletingId !== item.id) { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'; } }}
                    title="Hapus upload dan datanya"
                  >
                    {deletingId === item.id
                      ? <Loader2 size={isMobile ? 11 : 14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Trash2 size={isMobile ? 11 : 14} />
                    }
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadFile;