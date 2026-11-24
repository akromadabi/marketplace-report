import React, { useState, useMemo, useRef, useEffect, useCallback, useDeferredValue } from 'react';
import * as XLSX from 'xlsx';
import { Search, PackageCheck, Undo2, Package, AlertTriangle, Calendar, Download, ChevronLeft, ChevronRight, Camera, Trash2, Loader, XCircle, ArrowUpDown, ArrowUp, ArrowDown, X, ExternalLink, RotateCcw } from 'lucide-react';
import { useProcessedOrders } from '../hooks/useProcessedOrders';
import { useDataCache } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import BarcodeScanner from './BarcodeScanner';

function PengembalianTable() {
  const { activeStoreId } = useStore();
  const { rangkumanData, returnData, pengembalianData, scanData, loading } = useProcessedOrders(activeStoreId);
  const { setCacheData, fetchData } = useDataCache();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  useEffect(() => {
    function handleResize() { setWindowWidth(window.innerWidth); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isMobile = windowWidth < 768;

  const hasAnyFilter = Boolean(filterStartDate || filterEndDate || search.trim() || filterStatus !== 'all');
  const handleResetAllFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setSearch('');
    setFilterStatus('all');
    setCurrentPage(1);
  };

  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const datePickerRef = useRef(null);

  // ─── Filter & Sort state ──────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // ─── Detail popup state ───────────────────────────────────────
  const [selectedResi, setSelectedResi] = useState(null);

  // ─── Scanner state ────────────────────────────────────────────
  const [showScanner, setShowScanner] = useState(false);
  const [scanDeleting, setScanDeleting] = useState(null);

  const scannedResiSet = useMemo(() => new Set(scanData.map(s => s.resi)), [scanData]);

  const handleScanResi = useCallback(async (resi) => {
    const body = { resi, user_id: user?.id || null };
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server belum siap. Restart backend server terlebih dahulu.');
    }
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error || 'Gagal menyimpan');
      err.duplicate = json.duplicate;
      throw err;
    }
    const newItem = { id: json.id, resi: json.resi, scanned_at: new Date().toISOString(), scanned_by_name: user?.name || '-', store_id: null, notes: null };
    setCacheData('scan', null, [newItem, ...scanData]);
  }, [user, scanData, setCacheData]);

  const handleDeleteScan = useCallback(async (id, resi) => {
    if (!window.confirm(`Hapus resi "${resi}"?`)) return;
    setScanDeleting(id);
    try {
      await fetch(`/api/scan/${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      setCacheData('scan', null, scanData.filter(s => s.id !== id));
    } catch (err) { console.error('Delete scan error:', err); }
    setScanDeleting(null);
  }, [scanData, setCacheData]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) setShowDateRangePicker(false);
    }
    if (showDateRangePicker) document.addEventListener('mousedown', handleClickOutside);
    else document.removeEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDateRangePicker]);

  const columns = useMemo(() => {
    if (pengembalianData.length === 0) return [];
    const keysSet = new Set();
    pengembalianData.forEach(row => Object.keys(row).forEach(k => keysSet.add(k)));
    return Array.from(keysSet);
  }, [pengembalianData]);

  const [removeDuplicateResi, setRemoveDuplicateResi] = useState(false);

  const { returnResiSet, returnByTrackingId } = useMemo(() => {
    const set = new Set();
    const map = new Map();
    for (let i = 0; i < returnData.length; i++) {
      const row = returnData[i];
      const rawVal = row['Return Logistics Tracking ID'] ?? row['return logistics tracking id'];
      const val = rawVal ? rawVal.toString().trim() : '';
      if (!val) continue;
      set.add(val);
      let arr = map.get(val);
      if (!arr) { arr = []; map.set(val, arr); }
      arr.push(row);
    }
    return { returnResiSet: set, returnByTrackingId: map };
  }, [returnData]);

  // ─── Single-pass over rangkumanData for Tracking ID maps & sets (uses cached snapshot!) ────
  const { ordersByTrackingId, cancelTrackingSet, returnRefundTrackingSet, normalTrackingSet } = useMemo(() => {
    const map = new Map();
    const cancelSet = new Set();
    const returnSet = new Set();
    const normalSet = new Set();
    for (let i = 0; i < rangkumanData.length; i++) {
      const r = rangkumanData[i];
      const trackingVal = r.trackingId || '';
      if (!trackingVal || trackingVal === '-') continue;

      map.set(trackingVal, r);

      const orderStatus = r._rawStatusLower || r.statusLower || '';
      const crt = r._crt || '';
      if (orderStatus.includes('batal') || orderStatus.includes('cancel') || crt === 'cancel') cancelSet.add(trackingVal);
      else if (crt.includes('return') || crt.includes('refund')) returnSet.add(trackingVal);
      else normalSet.add(trackingVal);
    }
    return { ordersByTrackingId: map, cancelTrackingSet: cancelSet, returnRefundTrackingSet: returnSet, normalTrackingSet: normalSet };
  }, [rangkumanData]);

  const resiKey = columns.find(col => col.toLowerCase().includes('resi'));
  const tanggalKey = columns.find(col => col.toLowerCase().includes('tanggal') || col.toLowerCase().includes('date'));

  const getStatusKey = useCallback((resiVal) => {
    if (!resiVal || resiVal.trim() === '') return 'unknown';
    if (returnResiSet.has(resiVal)) return 'retur_pembeli';
    if (cancelTrackingSet.has(resiVal)) return 'cancel';
    if (returnRefundTrackingSet.has(resiVal)) return 'retur_refund';
    if (normalTrackingSet.has(resiVal)) return 'pengembalian';
    return 'unknown';
  }, [returnResiSet, cancelTrackingSet, returnRefundTrackingSet, normalTrackingSet]);

  const STATUS_MAP = {
    retur_pembeli: { text: 'Retur Pembeli', icon: <Undo2 size={14} />, color: '#34d399' },
    cancel: { text: 'Dibatalkan', icon: <XCircle size={14} />, color: '#fbbf24' },
    retur_refund: { text: 'Retur/Refund', icon: <Undo2 size={14} />, color: '#a78bfa' },
    pengembalian: { text: 'Pengembalian Paket', icon: <Package size={14} />, color: '#60a5fa' },
    unknown: { text: 'Tidak Dikenal', icon: <AlertTriangle size={14} />, color: '#f87171' },
  };

  const parseDateStr = (dateStr) => {
    if (!dateStr) return null;
    const str = dateStr.toString().trim();
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) { const [datePart] = str.split(' '); return datePart; }
    if (str.match(/^\d{2}\/\d{2}\/\d{4}/)) { const [datePart] = str.split(' '); const [day, month, year] = datePart.split('/'); return `${year}-${month}-${day}`; }
    if (str.match(/^\d{2}-\d{2}-\d{4}/)) { const [datePart] = str.split(' '); const [day, month, year] = datePart.split('-'); return `${year}-${month}-${day}`; }
    return null;
  };

  // ─── Merge upload + scan into one unified list ────────────────
  const mergedData = useMemo(() => {
    let uploadRows = pengembalianData;
    if ((filterStartDate || filterEndDate) && tanggalKey) {
      uploadRows = uploadRows.filter(row => {
        const dateKey = parseDateStr(row[tanggalKey]);
        if (!dateKey) return false;
        if (filterStartDate && dateKey < filterStartDate) return false;
        if (filterEndDate && dateKey > filterEndDate) return false;
        return true;
      });
    }
    const uploadProcessed = uploadRows.map(row => {
      const resiVal = resiKey ? (row[resiKey] || '').toString().trim() : '';
      const statusKey = getStatusKey(resiVal);
      return {
        _source: 'upload', _id: null, tanggal: tanggalKey ? row[tanggalKey] || '' : '',
        resi: resiVal, statusKey, resiStatus: STATUS_MAP[statusKey],
        scannedBy: null, _sortDate: parseDateStr(tanggalKey ? row[tanggalKey] : '') || '0000-00-00',
      };
    });
    let finalUpload = uploadProcessed;
    if (removeDuplicateResi && resiKey) {
      const seenResi = new Set();
      finalUpload = [];
      for (const row of uploadProcessed) {
        if (row.resi === '') finalUpload.push(row);
        else if (!seenResi.has(row.resi)) { seenResi.add(row.resi); finalUpload.push(row); }
      }
    }
    const scanProcessed = scanData.map(item => {
      const statusKey = getStatusKey(item.resi);
      const scanDate = new Date(item.scanned_at);
      return {
        _source: 'scan', _id: item.id,
        tanggal: scanDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + scanDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        resi: item.resi, statusKey, resiStatus: STATUS_MAP[statusKey],
        scannedBy: item.scanned_by_name || '-', _sortDate: item.scanned_at,
      };
    });
    return [...scanProcessed, ...finalUpload];
  }, [pengembalianData, scanData, filterStartDate, filterEndDate, tanggalKey, resiKey, removeDuplicateResi, getStatusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Status counts for filters ────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = { all: 0, retur_pembeli: 0, cancel: 0, retur_refund: 0, pengembalian: 0, unknown: 0 };
    mergedData.forEach(row => { counts.all++; counts[row.statusKey] = (counts[row.statusKey] || 0) + 1; });
    return counts;
  }, [mergedData]);

  // ─── Apply filters ────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = mergedData;
    if (filterStatus !== 'all') data = data.filter(r => r.statusKey === filterStatus);
    if (deferredSearch.trim()) {
      const s = deferredSearch.toLowerCase();
      data = data.filter(row =>
        row.resi.toLowerCase().includes(s) ||
        row.tanggal.toLowerCase().includes(s) ||
        (row.resiStatus?.text || '').toLowerCase().includes(s) ||
        (row.scannedBy || '').toLowerCase().includes(s)
      );
    }
    return data;
  }, [mergedData, filterStatus, deferredSearch]);

  // ─── Apply sort ───────────────────────────────────────────────
  const displayData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case 'tanggal': valA = a._sortDate || ''; valB = b._sortDate || ''; break;
        case 'resi': valA = a.resi; valB = b.resi; break;
        case 'status': valA = a.resiStatus?.text || ''; valB = b.resiStatus?.text || ''; break;
        default: return 0;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (col) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else { setSortColumn(null); setSortDirection('asc'); }
    } else { setSortColumn(col); setSortDirection('asc'); }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortColumn !== col) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const handleDownloadExcel = () => {
    if (!displayData || displayData.length === 0) return;
    const wsData = displayData.map((row, i) => ({
      'No': i + 1, 'Tanggal': row.tanggal, 'Resi': row.resi, 'Status': row.resiStatus?.text || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pengembalian');
    XLSX.writeFile(wb, 'Pengembalian_Data.xlsx');
  };

  const formatRupiah = (num) => {
    if (!num && num !== 0) return '-';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  const thSortStyle = { cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' };

  // ─── Helper: check if resi has linked order or return data ────
  const hasLinkedData = useCallback((resi) => {
    return ordersByTrackingId.has(resi) || returnByTrackingId.has(resi);
  }, [ordersByTrackingId, returnByTrackingId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: isMobile ? 'calc(100vh - 8.35rem)' : 'calc(100vh - 1.3rem)',
      overflow: 'hidden',
    }}>
      {/* ── Top Header Toolbar (Separate Card) ── */}
      <div
        style={{
          flexShrink: 0,
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
          padding: isMobile ? '0.55rem 0.65rem' : '0.55rem 0.85rem',
          marginBottom: '0.5rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '0.5rem' : '0.85rem',
        }}
      >
        {/* Left: Icon + Title + Count Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '0.65rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div
              style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.22)',
              }}
            >
              <PackageCheck size={isMobile ? 15 : 17} strokeWidth={2.3} />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? '0.925rem' : '1.025rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Pengembalian
            </h2>
          </div>
          <span
            style={{
              fontSize: isMobile ? '0.675rem' : '0.725rem',
              fontWeight: 600,
              color: '#475569',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
            }}
          >
            {displayData.length.toLocaleString('id-ID')} data
          </span>
        </div>

        {/* Right: Search Box (Pepet Kanan) + Filters + Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          width: isMobile ? '100%' : 'auto',
          justifyContent: isMobile ? 'stretch' : 'flex-end',
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: isMobile ? '100%' : '180px', flexShrink: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: search ? '#6366f1' : '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Cari resi..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 1.8rem 0 2.2rem',
                borderRadius: '8px',
                border: search ? '1px solid #6366f1' : '1px solid #e2e8f0',
                background: search ? '#f5f3ff' : '#f8fafc',
                color: '#0f172a',
                fontSize: '0.775rem',
                fontWeight: 500,
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCurrentPage(1); }}
                style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.15rem', display: 'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date Range Picker */}
          <div style={{ position: 'relative', flex: isMobile ? 1 : 'none' }} ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDateRangePicker(!showDateRangePicker)}
              style={{
                width: isMobile ? '100%' : 'auto',
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0 0.75rem',
                borderRadius: '8px',
                border: (filterStartDate || filterEndDate) ? '1px solid #6366f1' : '1px solid #e2e8f0',
                background: (filterStartDate || filterEndDate) ? '#f5f3ff' : '#ffffff',
                color: (filterStartDate || filterEndDate) ? '#6366f1' : '#334155',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Calendar size={13} style={{ color: (filterStartDate || filterEndDate) ? '#6366f1' : '#64748b' }} />
              <span>{(filterStartDate && filterEndDate) ? (`${filterStartDate} — ${filterEndDate}`) : 'Tanggal'}</span>
              {(filterStartDate || filterEndDate) && (
                <span
                  onClick={(e) => { e.stopPropagation(); setFilterStartDate(''); setFilterEndDate(''); setCurrentPage(1); }}
                  title="Hapus filter tanggal"
                  style={{ marginLeft: '2px', display: 'inline-flex', color: '#6366f1', padding: '1px' }}
                >
                  <X size={11} />
                </span>
              )}
            </button>
            {showDateRangePicker && (
              <div style={{ position: 'absolute', top: '105%', left: isMobile ? 0 : 'auto', right: isMobile ? 'auto' : 0, zIndex: 120 }}>
                <DateRangePicker startDate={filterStartDate || null} endDate={filterEndDate || null} onChange={({ startDate, endDate }) => {
                  setFilterStartDate(startDate); setFilterEndDate(endDate); setCurrentPage(1);
                }} onClose={() => setShowDateRangePicker(false)} />
              </div>
            )}
          </div>

          {/* Status Filter */}
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            style={{
              height: '34px',
              padding: '0 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: filterStatus !== 'all' ? '1px solid #6366f1' : '1px solid #e2e8f0',
              background: filterStatus !== 'all' ? '#f5f3ff' : '#ffffff',
              color: filterStatus !== 'all' ? '#6366f1' : '#334155',
              cursor: 'pointer',
              outline: 'none',
            }}>
            <option value="all">Semua Status ({statusCounts.all})</option>
            <option value="retur_pembeli">Retur Pembeli ({statusCounts.retur_pembeli})</option>
            <option value="cancel">Cancel ({statusCounts.cancel})</option>
            <option value="retur_refund">Retur/Refund ({statusCounts.retur_refund})</option>
            <option value="pengembalian">Pengembalian Paket ({statusCounts.pengembalian})</option>
            <option value="unknown">Tidak Dikenal ({statusCounts.unknown})</option>
          </select>

          {/* Remove Duplicate Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', color: '#475569', fontWeight: 500, margin: '0 0.2rem', whiteSpace: 'nowrap' }}>
            <input type="checkbox" id="removeDuplicateResi" checked={removeDuplicateResi}
              onChange={e => setRemoveDuplicateResi(e.target.checked)}
              style={{ accentColor: '#6366f1', width: '0.85rem', height: '0.85rem' }} />
            <span>Hapus Ganda</span>
          </label>

          {/* Reset Button */}
          {hasAnyFilter && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              title="Reset semua filter"
              style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0 0.65rem',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                background: '#fff1f2',
                color: '#e11d48',
                fontSize: '0.725rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}

          {!isMobile && <div style={{ height: '20px', width: '1px', background: '#e2e8f0', margin: '0 2px' }} />}

          {/* Scan Button */}
          <button onClick={() => setShowScanner(true)} type="button"
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            <Camera size={13} />
            <span>Scan Resi</span>
          </button>

          {/* Download Button */}
          <button onClick={handleDownloadExcel} type="button"
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.28)',
              whiteSpace: 'nowrap',
            }}>
            <Download size={13} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* ── Table Container (Separate Card Filling All Remaining Space) ── */}
      <div
        className="modern-table-wrapper"
        style={{
          flex: 1,
          minHeight: 0,
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table className="modern-table compact-table" style={{ width: '100%', minWidth: isMobile ? '700px' : '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '3rem' }}>No</th>
                  <th onClick={() => handleSort('tanggal')}>
                    <span style={thSortStyle}>Tanggal <SortIcon col="tanggal" /></span>
                  </th>
                  <th onClick={() => handleSort('resi')}>
                    <span style={thSortStyle}>Resi <SortIcon col="resi" /></span>
                  </th>
                  <th onClick={() => handleSort('status')}>
                    <span style={thSortStyle}>Status <SortIcon col="status" /></span>
                  </th>
                  <th style={{ width: '4rem' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '1rem', width: j === 0 ? '1.5rem' : '70%' }}>&nbsp;</div></td>
                      ))}
                    </tr>
                  ))
                ) : displayData.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                      Tidak ada data untuk ditampilkan.
                    </td>
                  </tr>
                ) : (() => {
                  const totalPages = Math.ceil(displayData.length / rowsPerPage);
                  const safePage = Math.min(currentPage, totalPages || 1);
                  const startIdx = (safePage - 1) * rowsPerPage;
                  const pageData = displayData.slice(startIdx, startIdx + rowsPerPage);
                  return pageData.map((row, i) => (
                    <tr key={`${row._source}-${row._id || startIdx + i}`}>
                      <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{startIdx + i + 1}</td>
                      <td title={row.tanggal}>{row.tanggal}</td>
                      <td>
                        {hasLinkedData(row.resi) ? (
                          <button
                            onClick={() => setSelectedResi(row.resi)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              fontWeight: 600, fontSize: '0.8125rem', color: '#a78bfa',
                              fontFamily: row._source === 'scan' ? 'monospace' : 'inherit',
                              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            }}
                            title="Klik untuk lihat detail order"
                          >
                            {row.resi}
                            <ExternalLink size={11} style={{ opacity: 0.6 }} />
                          </button>
                        ) : (
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem', fontFamily: row._source === 'scan' ? 'monospace' : 'inherit' }} title={row.resi}>
                            {row.resi}
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: row.resiStatus?.color || 'var(--text-primary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {row.resiStatus?.icon}
                          <span>{row.resiStatus?.text || '-'}</span>
                        </span>
                      </td>
                      <td>
                        {row._source === 'scan' && (
                          <button onClick={() => handleDeleteScan(row._id, row.resi)} disabled={scanDeleting === row._id}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                              color: scanDeleting === row._id ? 'var(--text-tertiary)' : '#f87171',
                              opacity: scanDeleting === row._id ? 0.5 : 1,
                            }} title="Hapus">
                            {scanDeleting === row._id ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* ── Compact Pagination Integrated Footer ── */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(displayData.length / rowsPerPage));
            const safePage = Math.min(currentPage, totalPages);
            const startIdx = (safePage - 1) * rowsPerPage;
            const endIdx = Math.min(startIdx + rowsPerPage, displayData.length);
            const maxButtons = isMobile ? 3 : 7;
            let startPage = Math.max(1, safePage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) startPage = Math.max(1, endPage - maxButtons + 1);
            const pageButtons = [];
            for (let p = startPage; p <= endPage; p++) pageButtons.push(p);

            return (
              <div style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.4rem',
                padding: isMobile ? '0.35rem 0.6rem' : '0.4rem 0.85rem',
                background: '#fcfdfe',
                borderTop: '1px solid #eef0f6',
                fontSize: isMobile ? '0.7rem' : '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Tampilkan</span>
                  <select
                    value={rowsPerPage}
                    onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    style={{
                      padding: '2px 5px',
                      height: '25px',
                      fontSize: '0.735rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    | {displayData.length > 0 ? `${startIdx + 1}–${endIdx}` : '0'} dari <strong style={{ color: 'var(--text-primary)' }}>{displayData.length.toLocaleString('id-ID')}</strong>
                  </span>
                </div>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}
                      style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}>
                      «
                    </button>
                    <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}>
                      ‹
                    </button>
                    {pageButtons.map(p => (
                      <button key={p} type="button" onClick={() => setCurrentPage(p)}
                        style={{
                          height: 25, minWidth: 25, padding: '0 5px', fontSize: '0.725rem', fontWeight: 700,
                          borderRadius: '5px',
                          border: p === safePage ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                          background: p === safePage ? '#7c3aed' : '#ffffff',
                          color: p === safePage ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}>
                        {p}
                      </button>
                    ))}
                    <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}>
                      ›
                    </button>
                    <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}
                      style={{ height: 25, minWidth: 25, padding: '0 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '5px', border: '1px solid #e2e8f0', background: '#ffffff', color: safePage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}>
                      »
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

      {/* ── Order Detail Popup Modal ──────────────────────────────── */}
      {selectedResi && (() => {
        const matchedOrder = ordersByTrackingId.get(selectedResi) || null;
        const orderRows = matchedOrder ? (matchedOrder.orders || []) : [];
        const returnRows = returnByTrackingId.get(selectedResi) || [];
        const hasOrder = orderRows.length > 0;
        const hasReturn = returnRows.length > 0;

        const orderId = matchedOrder ? matchedOrder.orderId : '';

        // Determine header style based on status
        const statusKey = getStatusKey(selectedResi);
        const statusInfo = STATUS_MAP[statusKey];
        let headerBg = 'transparent';
        let headerBorder = '1px solid var(--border-subtle)';
        if (statusKey === 'cancel') { headerBg = 'rgba(251, 191, 36, 0.15)'; headerBorder = '1px solid rgba(251, 191, 36, 0.3)'; }
        else if (statusKey === 'retur_pembeli' || statusKey === 'retur_refund') { headerBg = 'rgba(167, 139, 250, 0.15)'; headerBorder = '1px solid rgba(167, 139, 250, 0.3)'; }
        else if (statusKey === 'pengembalian') { headerBg = 'rgba(96, 165, 250, 0.15)'; headerBorder = '1px solid rgba(96, 165, 250, 0.3)'; }
        else { headerBg = 'rgba(248, 113, 113, 0.15)'; headerBorder = '1px solid rgba(248, 113, 113, 0.3)'; }

        const orderInfoItems = matchedOrder ? [
          { label: 'Order ID', val: matchedOrder.orderId },
          { label: 'Status Order', val: matchedOrder.statusOrder },
          { label: 'Tracking ID', val: matchedOrder.trackingId },
          { label: 'Waktu Pesanan Dibuat', val: matchedOrder.waktuPesananDibuat },
          { label: 'Waktu Pengiriman', val: matchedOrder.waktuPengiriman },
          { label: 'Metode Pembayaran', val: matchedOrder.metode },
          { label: 'Penerima', val: matchedOrder.customerName },
          { label: 'Username Pembeli', val: matchedOrder.buyerUsername },
          { label: 'Kota / Kabupaten', val: matchedOrder.regencyAndCity },
          { label: 'Provinsi', val: matchedOrder.province },
          { label: 'Alasan Pembatalan', val: matchedOrder.paketGagalKirim },
          { label: 'Penerimaan Dana', val: matchedOrder.pencairanDisplay },
        ] : [];

        return (
          <div onClick={() => setSelectedResi(null)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '780px', maxHeight: '85vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: headerBorder, background: headerBg }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Detail Resi</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#a78bfa', fontWeight: 700, fontFamily: 'monospace' }}>{selectedResi}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.5rem', borderRadius: '99px', fontSize: '0.6875rem', fontWeight: 700, background: `${statusInfo.color}22`, color: statusInfo.color }}>
                      {statusInfo.icon} {statusInfo.text}
                    </span>
                  </div>
                  {orderId && <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Order ID: {orderId}</span>}
                </div>
                <button type="button" onClick={() => setSelectedResi(null)} style={{
                  background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                  padding: '0.375rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex',
                }}><X size={16} /></button>
              </div>

              {/* Body */}
              <div style={{ overflow: 'auto', padding: '1.25rem', flex: 1 }}>
                {/* Products from orders */}
                {hasOrder && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Produk ({orderRows.length} item)
                    </h4>
                    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <table className="modern-table" style={{ fontSize: '0.75rem' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>No</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem', textAlign: 'left' }}>Product Name</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>Seller SKU</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>Variation</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.6875rem' }}>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderRows.map((p, idx) => {
                            const productName = p['Product Name'] || p['product_name'] || '';
                            const sellerSku = p['Seller SKU'] || p['seller_sku'] || '';
                            const variation = (p['Variation'] || p['variation'] || '').toString().trim();
                            const qty = p['Quantity'] || p['quantity'] || 0;
                            return (
                              <tr key={idx}>
                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'left', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productName}>{productName || '-'}</td>
                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center' }}>{sellerSku || '-'}</td>
                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center' }}>{variation || '-'}</td>
                                <td style={{ padding: '0.375rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Order Info Grid */}
                {hasOrder && orderInfoItems.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Informasi Order
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                      {orderInfoItems.map(({ label, val }) => (
                        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.5rem 0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
                            {val !== null && val !== undefined && val !== '' ? String(val) : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Return Data */}
                {hasReturn && (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#34d399' }}>
                      Data Return
                    </h4>
                    {returnRows.map((ret, rIdx) => {
                      const retCols = Object.keys(ret);
                      return (
                        <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem', marginBottom: rIdx < returnRows.length - 1 ? '0.75rem' : 0 }}>
                          {retCols.map(col => {
                            let val = ret[col];
                            if (typeof val === 'object' && val !== null && 'text' in val) val = val.text;
                            return (
                              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.5rem 0.75rem', background: 'rgba(52, 211, 153, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                <span style={{ fontSize: '0.6875rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>{col}</span>
                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
                                  {val !== null && val !== undefined && val !== '' ? String(val) : '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No linked data */}
                {!hasOrder && !hasReturn && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                    <AlertTriangle size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                    <p>Tidak ada data order atau return yang terhubung dengan resi ini.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Scanner Modal */}
      <BarcodeScanner isOpen={showScanner} onClose={() => { setShowScanner(false); fetchData('scan', null, { background: true }); }}
        onScan={handleScanResi} scannedResis={scannedResiSet} />
    </div>
  );
}

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
    else { if (date < internalStartDate) { setInternalStartDate(date); setInternalEndDate(null); } else { setInternalEndDate(date); setSelectingStart(true); } }
  }
  function generateCalendarDays(monthDate) {
    const year = monthDate.getFullYear(), month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days;
  }
  function isInRange(date) { if (!internalStartDate || !internalEndDate) return false; return date.getTime() >= internalStartDate.getTime() && date.getTime() <= internalEndDate.getTime(); }
  const isStartDate = (date) => internalStartDate && date.toDateString() === internalStartDate.toDateString();
  const isEndDate = (date) => internalEndDate && date.toDateString() === internalEndDate.toDateString();
  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  const formatMonthYear = (date) => { const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; return `${months[date.getMonth()]} ${date.getFullYear()}`; };
  const days = generateCalendarDays(calendarMonth);
  const onClear = () => { setInternalStartDate(null); setInternalEndDate(null); onChange({ startDate: '', endDate: '' }); setSelectingStart(true); setSelectedMonth(''); };
  const onApply = () => { updateInputValue(); onClose(); };
  const handleLast7Days = () => { const today = new Date(); const start = new Date(); start.setDate(today.getDate() - 6); setInternalStartDate(start); setInternalEndDate(today); setSelectingStart(true); setSelectedMonth(''); onChange({ startDate: toLocalDateStr(start), endDate: toLocalDateStr(today) }); };
  const handleThisMonth = () => { const today = new Date(); const f = new Date(today.getFullYear(), today.getMonth(), 1); setInternalStartDate(f); setInternalEndDate(today); setSelectingStart(true); setSelectedMonth(''); setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1)); onChange({ startDate: toLocalDateStr(f), endDate: toLocalDateStr(today) }); };
  const handleMonthChange = (e) => { const val = e.target.value; setSelectedMonth(val); if (!val) return; const [y, m] = val.split('-').map(Number); const f = new Date(y, m - 1, 1); const l = new Date(y, m, 0); setInternalStartDate(f); setInternalEndDate(l); setSelectingStart(true); setCalendarMonth(new Date(y, m - 1, 1)); onChange({ startDate: toLocalDateStr(f), endDate: toLocalDateStr(l) }); };
  const availableMonths = []; const now = new Date();
  const formatMonthYearOption = (monthStr) => { const [y, m] = monthStr.split('-').map(Number); const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; return `${months[m - 1]} ${y}`; };
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); availableMonths.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`); }
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '1rem', width: '320px' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleLast7Days} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>7 Hari Terakhir</button>
        <button type="button" onClick={handleThisMonth} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Bulan Ini</button>
        <select value={selectedMonth} onChange={handleMonthChange} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <option value="">Pilih Bulan</option>
          {availableMonths.map(m => <option key={m} value={m}>{formatMonthYearOption(m)}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{formatMonthYear(calendarMonth)}</span>
        <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '0.7rem' }}>
        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => <div key={d} style={{ fontWeight: 700, color: 'var(--text-tertiary)', padding: '0.25rem' }}>{d}</div>)}
        {days.map((day, i) => day ? (
          <div key={i} onClick={() => onDateClick(day)} style={{ padding: '0.375rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 600, background: isStartDate(day) || isEndDate(day) ? 'var(--accent-primary)' : isInRange(day) ? 'rgba(124, 58, 237, 0.15)' : 'transparent', color: isStartDate(day) || isEndDate(day) ? '#fff' : isInRange(day) ? '#a78bfa' : 'var(--text-primary)' }}>{day.getDate()}</div>
        ) : <div key={i} />)}
      </div>
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Clear</button>
        <button type="button" onClick={onApply} className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Close</button>
      </div>
    </div>
  );
}

export default PengembalianTable;