import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import FileInputList from "./FileInputList";
import { Upload as UploadIcon, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, Trash2, Clock, Database, Store, Search, X, Layers, RefreshCw, Sparkles } from "lucide-react";
import { apiUploadFilesSequentially, apiGetUploadHistory, apiDeleteUpload, apiAssignOrphanUploads } from '../api';
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
  const { activeStore, activeStoreId, stores, loading: storesLoading } = useStore();
  const { invalidateAll } = useDataCache();
  const { addNotification, updateNotification } = useNotification();
  const navigate = useNavigate();
  const [allFiles, setAllFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [fileCategoryMap, setFileCategoryMap] = useState({});
  const [fileRowCountMap, setFileRowCountMap] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const historyCacheKey = `marketplace_upload_history_${user?.id || '0'}_${activeStoreId || 'all'}`;
  const [uploadHistory, setUploadHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(historyCacheKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [historyLoading, setHistoryLoading] = useState(() => {
    try {
      return !localStorage.getItem(historyCacheKey);
    } catch { return true; }
  });
  const [historySearch, setHistorySearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [migratingOrphans, setMigratingOrphans] = useState(false);
  const [orphanMigrated, setOrphanMigrated] = useState(null);
  // uploadProgress: array of { fileName, pct, done } — one per file being uploaded
  const [uploadProgress, setUploadProgress] = useState([]);
  const inputRef = useRef(null);
  const progressRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    let hasCached = false;
    try {
      const raw = localStorage.getItem(historyCacheKey);
      if (raw) {
        setUploadHistory(JSON.parse(raw));
        hasCached = true;
      }
    } catch { /* ignore */ }
    if (!hasCached) {
      setHistoryLoading(true);
      setUploadHistory([]);
    }
    try {
      const data = await apiGetUploadHistory(user?.id, activeStoreId);
      setUploadHistory(data);
      try { localStorage.setItem(historyCacheKey, JSON.stringify(data)); } catch { /* ignore */ }
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, [user?.id, activeStoreId, historyCacheKey]);

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
      setUploadHistory(prev => {
        const next = prev.filter(u => u.id !== id);
        try { localStorage.setItem(historyCacheKey, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
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

  const tiktokHeaderMap = {
    // Payments / Income
    "order/adjustment id": "Order/adjustment ID",
    "id pesanan/penyesuaian": "Order/adjustment ID",
    "total settlement amount": "Total settlement amount",
    "jumlah penyelesaian pembayaran": "Total settlement amount",
    "total revenue": "Total revenue",
    "total pendapatan": "Total revenue",
    "pendapatan total": "Total revenue",
    "subtotal after seller discounts": "Subtotal after seller discounts",
    "subtotal setelah diskon penjual": "Subtotal after seller discounts",
    "customer payment": "Customer payment",
    "pembayaran pelanggan": "Customer payment",
    "order created time": "Order created time",
    "waktu pemesanan": "Order created time",
    "waktu pembuatan pesanan": "Order created time",
    "order settled time": "Order settled time",
    "waktu pembayaran pesanan": "Order settled time",
    "waktu penyelesaian pesanan": "Order settled time",
    "affiliate commission": "Affiliate commission",
    "komisi affiliate": "Affiliate commission",
    "komisi afiliasi": "Affiliate commission",
    "biaya komisi platform": "Affiliate commission",
    "return shipping costs (passed on to the customer)": "Return shipping costs (passed on to the customer)",
    "ongkos kirim pengembalian (dibebankan kepada pelanggan)": "Return shipping costs (passed on to the customer)",
    "ongkos kirim pengembalian": "Return shipping costs (passed on to the customer)",
    "tanggal dana dilepaskan": "Tanggal Dana Dilepaskan",
    "waktu dana dilepaskan": "Tanggal Dana Dilepaskan",
    "waktu pelepasan dana": "Tanggal Dana Dilepaskan",
    "metode pembayaran pembeli": "Metode pembayaran pembeli",
    "biaya layanan": "Biaya Layanan",
    "biaya administrasi": "Biaya Administrasi",
    "biaya proses pesanan": "Biaya Proses Pesanan",

    // Orders
    "order id": "Order ID",
    "id pesanan": "Order ID",
    "order status": "Order Status",
    "status pesanan": "Order Status",
    "order substatus": "Order Substatus",
    "substatus pesanan": "Order Substatus",
    "sub-status pesanan": "Order Substatus",
    "cancelation/return type": "Cancelation/Return Type",
    "tipe pembatalan/pengembalian": "Cancelation/Return Type",
    "tipe pembatalan": "Cancelation/Return Type",
    "normal or pre-order": "Normal or Pre-order",
    "normal atau pre-order": "Normal or Pre-order",
    "sku id": "SKU ID",
    "id sku": "SKU ID",
    "seller sku": "Seller SKU",
    "sku penjual": "Seller SKU",
    "product name": "Product Name",
    "nama produk": "Product Name",
    "variation": "Variation",
    "variasi": "Variation",
    "sku name": "Variation",
    "nama sku": "Variation",
    "quantity": "Quantity",
    "jumlah": "Quantity",
    "kuantitas": "Quantity",
    "jumlah produk": "Quantity",
    "cancel reason": "Cancel Reason",
    "alasan pembatalan": "Cancel Reason",
    "tracking id": "Tracking ID",
    "id pelacakan": "Tracking ID",
    "no. resi": "Tracking ID",
    "resi": "Tracking ID",
    "buyer username": "Buyer Username",
    "nama pembeli": "Buyer Username",
    "username pembeli": "Buyer Username",
    "recipient": "Nama Penerima",
    "nama penerima": "Nama Penerima",
    "penerima": "Nama Penerima",
    "phone #": "Phone #",
    "nomor telepon": "Phone #",
    "no. telp": "Phone #",
    "province": "Province",
    "provinsi": "Province",
    "regency and city": "Regency and City",
    "kota dan kabupaten": "Regency and City",
    "kota/kabupaten": "Regency and City",
    "detail address": "Detail Address",
    "alamat detail": "Detail Address",
    "alamat": "Detail Address",
    "payment method": "Payment Method",
    "created time": "Created Time",
    "waktu dibuat": "Created Time",
    "waktu pembuatan": "Created Time",
    "waktu pesanan dibuat": "Created Time",
    "shipped time": "Shipped Time",
    "waktu dikirim": "Shipped Time",
    "waktu pengiriman": "Shipped Time",
    "delivered time": "Delivered Time",
    "waktu diterima": "Delivered Time",
    "waktu pesanan selesai": "Delivered Time",
    "cancelled time": "Cancelled Time",
    "waktu dibatalkan": "Cancelled Time",

    // Returns
    "return order id": "Return Order ID",
    "id pengembalian": "Return Order ID",
    "id pesanan pengembalian": "Return Order ID",
    "order amount": "Order Amount",
    "jumlah pesanan": "Order Amount",
    "nominal pesanan": "Order Amount",
    "return status": "Return Status",
    "status pengembalian": "Return Status",
    "return logistics tracking id": "Return Logistics Tracking ID",
    "resi pengembalian": "Return Logistics Tracking ID",
    "no. resi pengembalian": "Return Logistics Tracking ID",
    "nomor pelacakan logistik pengembalian": "Return Logistics Tracking ID",
    "return type": "Return Type",
    "tipe pengembalian": "Return Type",
    "return reason": "Return Reason",
    "alasan pengembalian": "Return Reason",
    "refund amount": "Refund Amount",
    "jumlah pengembalian dana": "Refund Amount",
    "total pengembalian dana": "Refund Amount",
  };

  function detectPlatformAndCategory(headers, sheetNames) {
    const normalized = headers.map((h) => h.toString().trim().toLowerCase());
    
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

    // TikTok Payments
    const isTiktokPaymentsSheet = sheetNames && (sheetNames.includes('Order details') || sheetNames.includes('Detail pesanan'));
    const hasTiktokPaymentsCore = ["order/adjustment id", "id pesanan/penyesuaian"].some(h => normalized.some(fh => fh.startsWith(h)))
      && ["total settlement amount", "jumlah penyelesaian pembayaran"].some(h => normalized.some(fh => fh.startsWith(h)));
    
    const hasTiktokPaymentsFlex = ["order created time", "waktu pemesanan", "waktu pembuatan pesanan"].some(h => normalized.some(fh => fh.startsWith(h)))
      && ["order settled time", "waktu pembayaran pesanan", "waktu penyelesaian pesanan"].some(h => normalized.some(fh => fh.startsWith(h)));
    
    const hasTiktokPaymentsRevenue = ["total revenue", "total pendapatan", "pendapatan total"].some(h => normalized.some(fh => fh.startsWith(h)))
      && ["subtotal after seller discounts", "subtotal setelah diskon penjual"].some(h => normalized.some(fh => fh.startsWith(h)));

    if (hasTiktokPaymentsCore && (isTiktokPaymentsSheet || (hasTiktokPaymentsFlex && hasTiktokPaymentsRevenue))) {
      return { platform: "tiktok", category: "payments" };
    }

    // TikTok Orders
    const hasTiktokOrders = ["order id", "id pesanan"].some(h => normalized.includes(h))
      && ["order status", "status pesanan"].some(h => normalized.includes(h))
      && ["sku id", "id sku"].some(h => normalized.includes(h))
      && ["seller sku", "sku penjual"].some(h => normalized.includes(h))
      && ["product name", "nama produk"].some(h => normalized.includes(h));
      
    if (hasTiktokOrders) {
      return { platform: "tiktok", category: "orders" };
    }

    // TikTok Returns
    const hasTiktokReturn = ["return order id", "id pengembalian", "id pesanan pengembalian"].some(h => normalized.includes(h))
      && ["order id", "id pesanan"].some(h => normalized.includes(h))
      && ["sku id", "id sku"].some(h => normalized.includes(h));
      
    if (hasTiktokReturn) {
      return { platform: "tiktok", category: "return" };
    }

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

  function mapTiktokHeadersToStandard(data) {
    return data.map((row) => {
      const newRow = {};
      Object.entries(row).forEach(([key, value]) => {
        const lowerKey = key.toString().trim().toLowerCase();
        if (tiktokHeaderMap[lowerKey]) {
          newRow[tiktokHeaderMap[lowerKey]] = value;
        } else {
          newRow[key] = value;
        }
      });
      return newRow;
    });
  }

  function mapShopeeIncomeToStandard(data) {
    return data.map((row) => ({
      'Order/adjustment ID': row['No. Pesanan'] ?? '',
      'Total settlement amount': Number(String(row['Total Penghasilan'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0,
      'Customer payment': Number(String(row['Harga Asli Produk'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0,
      'Affiliate commission': 0,
      'Return shipping costs (passed on to the customer)': Number(String(row['Ongkos Kirim Pengembalian Barang'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0,
      'Tanggal Dana Dilepaskan': row['Tanggal Dana Dilepaskan'] ?? '',
      'Waktu Pesanan Dibuat': row['Waktu Pesanan Dibuat'] ?? '',
      'Metode pembayaran pembeli': row['Metode pembayaran pembeli'] ?? '',
      'Biaya Layanan': Number(String(row['Biaya Layanan'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0,
      'Biaya Administrasi': Number(String(row['Biaya Administrasi'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0,
      'Biaya Proses Pesanan': Number(String(row['Biaya Proses Pesanan'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0,
      'Channel Marketplace': 'Shopee',
    }));
  }

  function mapShopeeReturnToStandard(data) {
    const statusMap = {
      'dana dikembalikan ke pembeli': 'Completed',
      'sedang diproses': 'In Process',
      'ditolak': 'Rejected',
      'selesai': 'Completed',
    };
    return data.map((row) => {
      const statusRaw = (row['Status Pembatalan/ Pengembalian'] ?? '').toString().trim().toLowerCase();
      return {
        'Order ID': row['No. Pesanan'] ?? '',
        'Return Order ID': row['No. Pengembalian'] ?? '',
        'Return Status': statusMap[statusRaw] ?? (row['Status Pembatalan/ Pengembalian'] ?? ''),
        'Return Logistics Tracking ID': row['No. Resi Pengembalian Barang'] ?? '',
        'Product Name': row['Nama Produk'] ?? '',
        'Return Type': row['Tipe Pengembalian'] ?? '',
        'Return Reason': row['Alasan Pengembalian'] ?? '',
        'Refund Amount': row['Total Pengembalian Dana'] ?? '',
        'Channel Marketplace': 'Shopee',
      };
    });
  }

  const ORDER_WHITELIST = new Set([
    'order id', 'order status', 'product name', 'seller sku', 'sku id',
    'variation', 'quantity', 'cancel reason', 'tracking id', 'pembeli',
    'nama penerima', 'recipient', 'username (buyer)', 'buyer username',
    'phone #', 'city', 'kota / kabupaten', 'kota/kabupaten', 'regency and city',
    'districts', 'province', 'provinsi', 'alamat', 'detail address',
    'payment method', 'shipping provider name', 'opsi pengiriman',
    'delivered time', 'cancelled time', 'waktu pesanan dibuat', 'created time',
    'shipped time', 'channel marketplace', 'order amount', 'total pembayaran',
    'harga asli produk'
  ]);

  const PAYMENT_WHITELIST = new Set([
    'order/adjustment id', 'no. pesanan', 'total settlement amount',
    'total penghasilan', 'customer payment', 'total pembayaran pembeli',
    'affiliate commission', 'komisi affiliate',
    'return shipping costs (passed on to the customer)',
    'tanggal dana dilepaskan', 'waktu pesanan dibuat', 'order created time',
    'order settled time', 'metode pembayaran pembeli', 'biaya layanan',
    'biaya administrasi', 'biaya proses pesanan', 'channel marketplace'
  ]);

  const RETURN_WHITELIST = new Set([
    'order id', 'return order id', 'return status', 'return sub status',
    'return logistics tracking id', 'product name', 'sku id', 'seller sku',
    'sku name', 'buyer username', 'return type', 'return reason',
    'return quantity', 'return unit price', 'refund amount', 'order amount',
    'order status', 'order substatus', 'payment method', 'time requested',
    'refund time', 'dispute status', 'appeal status', 'compensation status',
    'compensation amount', 'buyer note', 'channel marketplace'
  ]);

  function pruneClientData(rows, category) {
    let whitelist = null;
    if (category === 'orders') whitelist = ORDER_WHITELIST;
    else if (category === 'payments') whitelist = PAYMENT_WHITELIST;
    else if (category === 'return' || category === 'returns') whitelist = RETURN_WHITELIST;
    if (!whitelist) return rows;

    return rows.map((row) => {
      const pruned = {};
      for (const [k, v] of Object.entries(row)) {
        const trimmed = k.trim();
        if (whitelist.has(trimmed.toLowerCase())) {
          pruned[trimmed] = v;
        }
      }
      return pruned;
    });
  }

  function quickDetectFile(file) {
    return new Promise((resolve, reject) => {
      // Fast path for CSV files
      if (file.name.toLowerCase().endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target.result;
            let rowCount = 0;
            let firstLine = '';
            for (let i = 0; i < text.length; i++) {
              if (text.charCodeAt(i) === 10) {
                if (!firstLine) firstLine = text.slice(0, i).trim();
                rowCount++;
              }
            }
            if (!firstLine && text.length > 0) firstLine = text.trim();
            const headers = firstLine.split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
            const { platform, category } = detectPlatformAndCategory(headers, ['Sheet1']);
            resolve({ platform, category, rowCount: Math.max(0, rowCount) });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Gagal membaca file CSV.'));
        reader.readAsText(file);
        return;
      }

      // Fast path for Excel (.xlsx, .xls) files:
      // sheetRows: 10 reads ONLY the first 10 rows into memory!
      // This finishes in ~100ms even for 150k+ row workbooks.
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: 'array',
            sheetRows: 10,
            cellFormula: false,
            cellHTML: false,
            cellText: false,
          });

          const sheetNames = workbook.SheetNames || [];
          const isShopeeIncome = sheetNames.includes('Income');
          const isTiktokIncome = sheetNames.includes('Order details') || sheetNames.includes('Detail pesanan');

          let targetSheetName = sheetNames[0];
          let headerRowIdx = 0;

          if (isShopeeIncome) {
            targetSheetName = 'Income';
            headerRowIdx = 5;
          } else if (isTiktokIncome) {
            targetSheetName = sheetNames.includes('Order details') ? 'Order details' : 'Detail pesanan';
            headerRowIdx = 0;
          }

          const ws = workbook.Sheets[targetSheetName] || workbook.Sheets[sheetNames[0]];
          const headers = [];
          let rowCount = 0;

          if (ws) {
            const fullRef = ws['!fullref'] || ws['!ref'];
            if (fullRef) {
              const range = XLSX.utils.decode_range(fullRef);
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: headerRowIdx });
                const cell = ws[cellRef];
                if (cell && cell.v !== undefined) headers.push(cell.v.toString().trim());
              }

              // Fallback: if row 0 was blank, inspect row 1..4
              if (headers.length === 0) {
                for (let r = 1; r <= Math.min(4, range.e.r); r++) {
                  const fallbackHeaders = [];
                  for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cRef = XLSX.utils.encode_cell({ c: C, r });
                    const cCell = ws[cRef];
                    if (cCell && cCell.v !== undefined) fallbackHeaders.push(cCell.v.toString().trim());
                  }
                  if (fallbackHeaders.length > 0) {
                    headers.push(...fallbackHeaders);
                    headerRowIdx = r;
                    break;
                  }
                }
              }
            }
          }

          const detected = detectPlatformAndCategory(headers, sheetNames);
          const platform = detected.platform;
          const category = detected.category;

          if (ws) {
            const fullRef = ws['!fullref'] || ws['!ref'];
            if (fullRef) {
              const range = XLSX.utils.decode_range(fullRef);
              if (platform === 'shopee' && category === 'payments') {
                rowCount = Math.max(0, range.e.r - 5);
              } else if (platform === 'tiktok' && category === 'orders') {
                rowCount = Math.max(0, range.e.r - 1);
              } else {
                rowCount = Math.max(0, range.e.r - range.s.r);
              }
            }
          }

          resolve({ platform, category, rowCount });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function parseFullFile(file, platform, category) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: 'array',
            cellFormula: false,
            cellHTML: false,
            cellText: false,
          });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Quick ref fix only if !ref is missing or indicates single cell
          const fixRangeIfNeeded = (ws) => {
            if (!ws) return;
            if (ws['!ref']) {
              const cur = XLSX.utils.decode_range(ws['!ref']);
              if (cur.e.r > 2) return; // Already has multi-row valid range!
            }
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
              const cur = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { e: { c: 0 } };
              ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR - 1, c: Math.max(maxC - 1, cur.e.c || 0) } });
            }
          };
          fixRangeIfNeeded(worksheet);

          let jsonData;
          // Special handling for TikTok Income format baru
          if (platform === 'tiktok' && category === 'payments' && (workbook.SheetNames.includes('Order details') || workbook.SheetNames.includes('Detail pesanan'))) {
            const targetSheetName = workbook.SheetNames.includes('Order details') ? 'Order details' : 'Detail pesanan';
            const orderDetailsSheet = workbook.Sheets[targetSheetName];
            jsonData = XLSX.utils.sheet_to_json(orderDetailsSheet || worksheet, { defval: '' });
          // Special handling for Shopee Income
          } else if (platform === 'shopee' && category === 'payments') {
            const incomeSheet = workbook.Sheets['Income'];
            if (incomeSheet) {
              fixRangeIfNeeded(incomeSheet);
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
              jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            }
          } else {
            jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          }

          if (category === 'orders' && platform === 'tiktok') jsonData = jsonData.slice(1);

          if (category === 'pengembalian') {
            jsonData = jsonData.map((row) => {
              const newRow = { ...row };
              Object.keys(newRow).forEach((key) => {
                if (/tanggal|date/i.test(key)) {
                  const val = newRow[key];
                  if (val) {
                    let dateObj = null;
                    if (val instanceof Date) dateObj = val;
                    else if (typeof val === 'number') {
                      const d = XLSX.SSF.parse_date_code(val);
                      if (d) dateObj = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S));
                    } else if (typeof val === 'string') {
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

          if (platform === 'shopee' && category === 'orders') jsonData = mapShopeeHeadersToStandard(jsonData);
          if (platform === 'shopee' && category === 'payments') jsonData = mapShopeeIncomeToStandard(jsonData);
          if (platform === 'shopee' && category === 'return') jsonData = mapShopeeReturnToStandard(jsonData);
          if (platform === 'tiktok') jsonData = mapTiktokHeadersToStandard(jsonData);

          jsonData = pruneClientData(jsonData, category);
          resolve(jsonData);
        } catch (err) {
          reject(new Error('Gagal membaca file: ' + (err.message || 'Pastikan file valid.')));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file dari penyimpanan.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function addFiles(newFiles) {
    setError('');
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
      setFileRowCountMap((p) => { const m = { ...p }; delete m[keyToRemove]; return m; });
      return newArr;
    });
  }

  const [filePlatformCache, setFilePlatformCache] = useState({});

  useEffect(() => {
    async function detectAll() {
      const newCache = { ...filePlatformCache };
      const newCategoryMap = { ...fileCategoryMap };
      const newRowCountMap = { ...fileRowCountMap };
      let changed = false;
      for (const file of allFiles) {
        const key = file.name + file.size;
        if (!(key in newCache)) {
          changed = true;
          try {
            const { platform, category, rowCount } = await quickDetectFile(file);
            newCache[key] = platform;
            newCategoryMap[key] = category;
            newRowCountMap[key] = rowCount;
          } catch {
            newCache[key] = 'unknown';
            newCategoryMap[key] = 'unknown';
            newRowCountMap[key] = 0;
          }
        }
      }
      if (changed) {
        setFilePlatformCache(newCache);
        setFileCategoryMap(newCategoryMap);
        setFileRowCountMap(newRowCountMap);
      }
    }
    if (allFiles.length > 0) detectAll();
    else {
      setFilePlatformCache({});
      setFileCategoryMap({});
      setFileRowCountMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFiles]);

  function getIconForFile(file, category) {
    const key = file.name + file.size;
    const platform = filePlatformCache[key] || "unknown";
    if (category === "pengembalian") return platformIcons.pengembalian;
    return platformIcons[platform] || platformIcons.unknown;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(null);
    if (allFiles.length === 0) { setError('Harap unggah minimal satu file.'); return; }
    setUploading(true);

    // Initialise progress entries for all files
    setUploadProgress(allFiles.map((f) => ({ fileName: f.name, pct: 0, done: false, active: false, stage: 'waiting' })));
    const notifId = addNotification({
      type: 'loading',
      message: `Memproses ${allFiles.length} file... Anda bisa berpindah halaman, proses tetap berjalan.`,
      persistent: true,
    });

    try {
      const result = await apiUploadFilesSequentially(
        allFiles,
        filePlatformCache,
        fileCategoryMap,
        parseFullFile,
        user?.id,
        activeStoreId,
        ({ fileIdx, pct, done, stage }) => {
          setUploadProgress((prev) => prev.map((entry, idx) => {
            if (idx === fileIdx) return { ...entry, pct, done, active: !done, stage };
            if (idx < fileIdx) return { ...entry, done: true, pct: 100, active: false, stage: 'done' };
            return entry;
          }));
        }
      );

      setSuccess({ ...result.results, skipped: result.skipped, totalSkipped: result.totalSkipped || 0 });
      setAllFiles([]);
      setFileCategoryMap({});
      setFileRowCountMap({});
      setFilePlatformCache({});
      setUploadProgress([]);
      fetchHistory();
      invalidateAll();

      const parts = [];
      if (result.results.orders > 0) parts.push(`${result.results.orders.toLocaleString('id-ID')} pesanan`);
      if (result.results.payments > 0) parts.push(`${result.results.payments.toLocaleString('id-ID')} pembayaran`);
      if (result.results.returns > 0) parts.push(`${result.results.returns.toLocaleString('id-ID')} retur`);
      if (result.results.pengembalian > 0) parts.push(`${result.results.pengembalian.toLocaleString('id-ID')} pengembalian`);
      const skipText = (result.totalSkipped || 0) > 0 ? ` (${result.totalSkipped.toLocaleString('id-ID')} duplikat dilewati)` : '';

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
    } finally {
      setUploading(false);
    }
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

  const filteredHistory = useMemo(() => {
    return uploadHistory.filter((item) => {
      if (activeFilter !== 'all') {
        const p = (item.platform || '').toLowerCase();
        const c = (item.category || '').toLowerCase();
        if (activeFilter === 'tiktok' && !p.includes('tiktok')) return false;
        if (activeFilter === 'shopee' && !p.includes('shopee')) return false;
        if (activeFilter === 'payments' && !c.includes('payment') && !c.includes('pembayaran') && !c.includes('income')) return false;
        if (activeFilter === 'orders' && !c.includes('order') && !c.includes('pesanan')) return false;
        if (activeFilter === 'return' && !c.includes('return') && !c.includes('retur') && !c.includes('pengembalian')) return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const f = (item.filename || '').toLowerCase();
        const c = (item.category || '').toLowerCase();
        const p = (item.platform || '').toLowerCase();
        const u = (item.uploaded_by || '').toLowerCase();
        if (!f.includes(q) && !c.includes(q) && !p.includes(q) && !u.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [uploadHistory, activeFilter, historySearch]);

  // Gate: harus ada store dulu sebelum upload
  const noStore = !storesLoading && stores.length === 0;
  const currentStore = activeStore || stores.find(s => String(s.id) === String(activeStoreId));

  return (
    <div className="upload-page-wrapper">
      {/* ── Top Header Toolbar ── */}
      <div className="upload-header-bar">
        <div className="upload-header-left">
          <div className="upload-header-icon-box">
            <UploadIcon size={16} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="upload-header-title">Upload File Excel</h2>
            <p className="upload-header-subtitle">
              Format TikTok Shop &amp; Shopee dideteksi otomatis (.xlsx, .xls)
            </p>
          </div>
        </div>

        {/* Right side: Active store indicator & count */}
        <div className="upload-header-right">
          {currentStore && (
            <span className="upload-store-pill">
              <Store size={12} style={{ flexShrink: 0 }} />
              <span>{currentStore.name}</span>
            </span>
          )}
          <span className="upload-count-pill">
            <Database size={12} style={{ flexShrink: 0 }} />
            <span>{uploadHistory.length} file tersimpan</span>
          </span>
        </div>
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
          marginBottom: '1rem',
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

      {/* ── Box 1 (Atas): Upload Station Card ── */}
      <div className="upload-station-card">
        <form onSubmit={handleSubmit} style={{ opacity: noStore ? 0.4 : 1, pointerEvents: noStore ? 'none' : 'auto' }}>
          <div className="upload-station-grid">
            {/* Left: Modern Dropzone */}
            <div
              className={`upload-dropzone-modern ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="upload-dropzone-icon-modern">
                <UploadIcon size={24} strokeWidth={2.4} />
              </div>
              <div className="upload-dropzone-text-modern">
                <p className="upload-dropzone-title-modern">
                  Tarik &amp; lepas file Excel di sini
                </p>
                <p className="upload-dropzone-desc-modern">
                  atau klik untuk memilih file dari komputer
                </p>
              </div>
              <button type="button" className="upload-btn-secondary" tabIndex={-1}>
                <FileSpreadsheet size={15} />
                <span>Pilih File Excel</span>
              </button>
              <span className="upload-dropzone-format-hint">
                Format didukung: <strong>.xlsx</strong>, <strong>.xls</strong> • Otomatis deteksi &amp; multi-file
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Right: Panduan Format Box ("Notif Kanan") */}
            <div className="upload-info-box">
              <div className="upload-info-header">
                <div className="upload-info-icon-badge">
                  <Sparkles size={14} />
                </div>
                <div>
                  <span className="upload-info-header-title">Panduan Format File</span>
                  <span className="upload-info-header-sub">Otomatis dideteksi sistem</span>
                </div>
              </div>

              <div className="upload-info-list">
                <div className="upload-info-item">
                  <span className="upload-info-tag tiktok">TikTok Shop</span>
                  <div>
                    <p className="upload-info-text-bold">Laporan Pesanan &amp; Settlement</p>
                    <p className="upload-info-text-sub">Laporan pesanan atau rincian penyelesaian dana (.xlsx)</p>
                  </div>
                </div>

                <div className="upload-info-item">
                  <span className="upload-info-tag shopee">Shopee</span>
                  <div>
                    <p className="upload-info-text-bold">Laporan Pesanan &amp; Penghasilan</p>
                    <p className="upload-info-text-sub">Laporan pesanan atau rincian saldo penjual/income (.xlsx)</p>
                  </div>
                </div>
              </div>

              <div className="upload-info-footer">
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>Header kolom tervalidasi otomatis &amp; baris duplikat akan dilewati.</span>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginTop: '0.65rem',
              color: '#ef4444',
              fontSize: '0.8125rem',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {success && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              background: 'rgba(16, 185, 129, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              marginTop: '0.65rem',
              color: '#059669',
              fontSize: '0.8125rem',
            }}>
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>
                Upload berhasil!
                {success.orders > 0 && ` ${success.orders} pesanan`}
                {success.payments > 0 && ` • ${success.payments} pembayaran`}
                {success.returns > 0 && ` • ${success.returns} return`}
                {success.pengembalian > 0 && ` • ${success.pengembalian} pengembalian`}
                {' '}tersimpan di database.
                {success.totalSkipped > 0 && (
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {' '}({success.totalSkipped} duplikat dilewati)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Selected File Queue List */}
          {allFiles.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <FileSpreadsheet size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Antrean File ({allFiles.length})
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

          {/* Category summary boxes */}
          {allFiles.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.5rem',
              marginTop: '0.65rem',
            }}>
              {categoryBoxes.map(({ key, label, files, gradient, borderColor }) => (
                <div
                  key={key}
                  className="glass-card"
                  style={{
                    padding: '0.65rem 0.75rem',
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
                    fontSize: '0.785rem',
                    fontWeight: 700,
                    marginBottom: '0.25rem',
                    background: gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {label}
                  </h3>
                  {files.length === 0 ? (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>
                      Belum ada file
                    </p>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {files.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.15rem 0',
                        }}>
                          <FileSpreadsheet size={11} />
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

          {/* Submit Action Button */}
          {allFiles.length > 0 && (
            <button
              type="submit"
              disabled={uploading}
              className="upload-submit-btn"
              style={{
                marginTop: '0.75rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#ffffff',
                cursor: uploading ? 'wait' : 'pointer',
                boxShadow: '0 3px 10px rgba(99, 102, 241, 0.25)',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Memproses {allFiles.length} File ke Database...</span>
                </>
              ) : (
                <>
                  <UploadIcon size={16} />
                  <span>Proses &amp; Simpan {allFiles.length} File Data</span>
                </>
              )}
            </button>
          )}
        </form>
      </div>

      {/* ── Riwayat File Tersimpan Section ── */}
      <div className="upload-section-card">
        {/* Section Header with Tools */}
        <div className="upload-section-header">
          <div className="upload-section-title-wrap">
            <div className="upload-section-icon">
              <Database size={16} />
            </div>
            <div>
              <h3 className="upload-section-title">Riwayat File Tersimpan</h3>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '2px 8px',
                borderRadius: '9999px',
                whiteSpace: 'nowrap',
              }}
            >
              {filteredHistory.length === uploadHistory.length
                ? `${uploadHistory.length} file`
                : `${filteredHistory.length} dari ${uploadHistory.length}`}
            </span>
          </div>

          <div className="upload-section-tools">
            {/* Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`upload-filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('tiktok')}
                className={`upload-filter-tab ${activeFilter === 'tiktok' ? 'active' : ''}`}
              >
                TikTok
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('shopee')}
                className={`upload-filter-tab ${activeFilter === 'shopee' ? 'active' : ''}`}
              >
                Shopee
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('payments')}
                className={`upload-filter-tab ${activeFilter === 'payments' ? 'active' : ''}`}
              >
                Pembayaran
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('orders')}
                className={`upload-filter-tab ${activeFilter === 'orders' ? 'active' : ''}`}
              >
                Pesanan
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('return')}
                className={`upload-filter-tab ${activeFilter === 'return' ? 'active' : ''}`}
              >
                Retur
              </button>
            </div>

            {/* Search Input */}
            <div className="upload-search-wrap">
              <Search size={12} color="#94a3b8" style={{ position: 'absolute', left: '0.5rem', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Cari nama file..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="upload-search-input"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  style={{
                    position: 'absolute', right: '0.35rem', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, color: '#94a3b8', display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="upload-filter-tab"
              title="Muat ulang riwayat"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', padding: 0 }}
            >
              <RefreshCw size={12} style={{ animation: historyLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Section Body */}
        {historyLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.8125rem' }}>Memuat riwayat tersimpan...</p>
          </div>
        ) : uploadHistory.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <UploadIcon size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.35 }} />
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Belum ada file yang diupload</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>File Excel yang diupload akan otomatis tercatat dan tersimpan di sini</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Search size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <p style={{ fontSize: '0.8125rem' }}>Tidak ada file yang sesuai dengan filter/pencarian</p>
            <button
              type="button"
              onClick={() => { setHistorySearch(''); setActiveFilter('all'); }}
              style={{
                marginTop: '0.5rem', background: 'none', border: 'none', color: '#6366f1',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reset Filter
            </button>
          </div>
        ) : (
          /* Cards Grid */
          <div className="upload-cards-grid">
            {filteredHistory.map((item) => {
              const categoryConfig = {
                orders: { label: 'Pesanan', className: 'upload-badge-orders' },
                payments: { label: 'Pembayaran', className: 'upload-badge-payments' },
                return: { label: 'Retur', className: 'upload-badge-return' },
                pengembalian: { label: 'Pengembalian', className: 'upload-badge-pengembalian' },
              };
              const cat = categoryConfig[item.category] || { label: item.category || 'File', className: 'upload-badge-platform' };
              const platformName = item.platform ? (item.platform.toLowerCase() === 'tiktok' ? 'TikTok' : item.platform.charAt(0).toUpperCase() + item.platform.slice(1)) : '-';
              const isTikTok = (item.platform || '').toLowerCase().includes('tiktok');
              const isShopee = (item.platform || '').toLowerCase().includes('shopee');
              const dateStr = item.created_at ? new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

              return (
                <div key={item.id} className="upload-grid-card">
                  {/* Card Header: Platform Icon, Filename, Date & Delete Button */}
                  <div className="upload-card-header">
                    <div className="upload-card-title-group">
                      <div
                        className="upload-card-icon"
                        style={{
                          background: isTikTok ? '#000000' : isShopee ? '#fff7ed' : '#f8fafc',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={platformIcons[item.platform] || platformIcons[item.category] || platformIcons.unknown}
                          alt={platformName}
                          loading="lazy"
                        />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="upload-card-filename-text" title={item.filename}>
                          {item.filename}
                        </p>
                        <p className="upload-card-date-sub">
                          <Clock size={11} style={{ opacity: 0.6, marginRight: '3px', verticalAlign: '-1px', display: 'inline-block' }} />
                          <span>{dateStr}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="upload-card-del-btn"
                      disabled={deletingId === item.id}
                      onClick={() => handleDeleteUpload(item.id)}
                      title="Hapus upload dan seluruh datanya"
                      aria-label={`Hapus upload ${item.filename}`}
                    >
                      {deletingId === item.id
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>

                  {/* Card Badges Row: Platform + Category */}
                  <div className="upload-card-badges-row">
                    {item.platform && item.platform !== 'none' && item.platform !== 'unknown' && (
                      <span className={`upload-badge upload-badge-platform ${isTikTok ? 'tiktok' : isShopee ? 'shopee' : ''}`}>
                        {platformName}
                      </span>
                    )}
                    <span className={`upload-badge ${cat.className}`}>
                      {cat.label}
                    </span>
                  </div>

                  {/* Card Meta Grid: Rows, Duplicates, Store */}
                  <div className="upload-card-meta-grid">
                    <span className="upload-meta-chip">
                      <Layers size={11} style={{ opacity: 0.7 }} />
                      <span>{item.row_count?.toLocaleString('id-ID') || 0} baris</span>
                    </span>

                    {item.skipped_rows > 0 && (
                      <span className="upload-meta-chip warn" title={`${item.skipped_rows.toLocaleString('id-ID')} baris data duplikat dilewati`}>
                        <AlertCircle size={11} />
                        <span>+{item.skipped_rows.toLocaleString('id-ID')} duplikat</span>
                      </span>
                    )}

                    {item.uploaded_by && (
                      <span className="upload-meta-chip" title={`Diupload oleh ${item.uploaded_by}`}>
                        <Store size={11} style={{ opacity: 0.7 }} />
                        <span>{item.uploaded_by}</span>
                      </span>
                    )}
                  </div>
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