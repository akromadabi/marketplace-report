import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Search, PackageCheck, Undo2, Package, AlertTriangle, Calendar, Download, ChevronLeft, ChevronRight, Camera, Trash2, Loader, XCircle, ArrowUpDown, ArrowUp, ArrowDown, X, ExternalLink } from 'lucide-react';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../contexts/AuthContext';
import BarcodeScanner from './BarcodeScanner';

function PengembalianTable() {
  const { data: pengembalianData, loading } = useApiData('pengembalian');
  const { data: returnData } = useApiData('returns');
  const { data: ordersData } = useApiData('orders');
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
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
  const [scanData, setScanData] = useState([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanDeleting, setScanDeleting] = useState(null);

  // ─── Fetch scanned resi data (cross-store) ─────────────────
  const fetchScanData = useCallback(async () => {
    setScanLoading(true);
    try {
      const res = await fetch('/api/scan', {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setScanData(data);
        }
      }
    } catch (err) {
      console.error('Fetch scan data error:', err);
    }
    setScanLoading(false);
  }, []);

  useEffect(() => { fetchScanData(); }, [fetchScanData]);

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
    setScanData(prev => [{ id: json.id, resi: json.resi, scanned_at: new Date().toISOString(), scanned_by_name: user?.name || '-', store_id: null, notes: null }, ...prev]);
  }, [user]);

  const handleDeleteScan = useCallback(async (id, resi) => {
    if (!window.confirm(`Hapus resi "${resi}"?`)) return;
    setScanDeleting(id);
    try {
      await fetch(`/api/scan/${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      setScanData(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error('Delete scan error:', err); }
    setScanDeleting(null);
  }, []);

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

  const returnResiSet = useMemo(() => {
    const set = new Set();
    for (const row of returnData) {
      const key = Object.keys(row).find(k => k.toLowerCase().includes('return logistics tracking id'));
      if (key) { const val = row[key]; if (val && val.toString().trim() !== '') set.add(val.toString().trim()); }
    }
    return set;
  }, [returnData]);

  // ─── Group orders by Tracking ID for detail popup ─────────────
  const ordersByTrackingId = useMemo(() => {
    const map = new Map();
    for (const row of ordersData) {
      const trackingKey = Object.keys(row).find(k => k.toLowerCase() === 'tracking id');
      if (!trackingKey) continue;
      const trackingVal = (row[trackingKey] || '').toString().trim();
      if (!trackingVal) continue;
      if (!map.has(trackingVal)) map.set(trackingVal, []);
      map.get(trackingVal).push(row);
    }
    return map;
  }, [ordersData]);

  // ─── Group return data by Return Logistics Tracking ID ────────
  const returnByTrackingId = useMemo(() => {
    const map = new Map();
    for (const row of returnData) {
      const key = Object.keys(row).find(k => k.toLowerCase().includes('return logistics tracking id'));
      if (!key) continue;
      const val = (row[key] || '').toString().trim();
      if (!val) continue;
      if (!map.has(val)) map.set(val, []);
      map.get(val).push(row);
    }
    return map;
  }, [returnData]);

  const { cancelTrackingSet, returnRefundTrackingSet, normalTrackingSet } = useMemo(() => {
    const cancelSet = new Set();
    const returnSet = new Set();
    const normalSet = new Set();
    for (const row of ordersData) {
      const trackingKey = Object.keys(row).find(k => k.toLowerCase() === 'tracking id');
      if (!trackingKey) continue;
      const trackingVal = (row[trackingKey] || '').toString().trim();
      if (!trackingVal) continue;
      const sKey = Object.keys(row).find(k => k.toLowerCase() === 'order status');
      const crtKey = Object.keys(row).find(k => k.toLowerCase() === 'cancelation/return type');
      const orderStatus = sKey ? (row[sKey] || '').toString().toLowerCase() : '';
      const crt = crtKey ? (row[crtKey] || '').toString().toLowerCase() : '';
      if (orderStatus.includes('batal') || crt === 'cancel') cancelSet.add(trackingVal);
      else if (crt.includes('return') || crt.includes('refund')) returnSet.add(trackingVal);
      else normalSet.add(trackingVal);
    }
    return { cancelTrackingSet: cancelSet, returnRefundTrackingSet: returnSet, normalTrackingSet: normalSet };
  }, [ordersData]);

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
    cancel: { text: 'Cancel', icon: <XCircle size={14} />, color: '#fbbf24' },
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
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(row =>
        row.resi.toLowerCase().includes(s) ||
        row.tanggal.toLowerCase().includes(s) ||
        (row.resiStatus?.text || '').toLowerCase().includes(s) ||
        (row.scannedBy || '').toLowerCase().includes(s)
      );
    }
    return data;
  }, [mergedData, filterStatus, search]);

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
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PackageCheck size={24} style={{ color: '#7c3aed' }} />
            Pengembalian
          </h2>
          <p>{displayData.length.toLocaleString('id-ID')} data</p>
        </div>
        <div style={{ position: 'relative', maxWidth: '20rem', flex: '1' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input type="text" placeholder="Cari resi..." value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="search-input" />
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
        {/* Date Range Filter */}
        <div style={{ position: 'relative' }} ref={datePickerRef}>
          <button type="button" onClick={() => setShowDateRangePicker(!showDateRangePicker)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              background: (filterStartDate || filterEndDate) ? 'rgba(124,58,237,0.15)' : 'var(--bg-glass)',
              color: (filterStartDate || filterEndDate) ? '#a78bfa' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
            }}>
            <Calendar size={13} />
            {(filterStartDate || filterEndDate) ? `${filterStartDate || '...'} → ${filterEndDate || '...'}` : 'Tanggal'}
          </button>
          {showDateRangePicker && (
            <div style={{ position: 'absolute', zIndex: 50, marginTop: '0.5rem' }}>
              <DateRangePicker startDate={filterStartDate || null} endDate={filterEndDate || null} onChange={({ startDate, endDate }) => {
                setFilterStartDate(startDate); setFilterEndDate(endDate); setCurrentPage(1);
              }} onClose={() => setShowDateRangePicker(false)} />
            </div>
          )}
        </div>

        {/* Status Filter */}
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          style={{
            padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            background: filterStatus !== 'all' ? 'rgba(124,58,237,0.15)' : 'var(--bg-glass)',
            color: filterStatus !== 'all' ? '#a78bfa' : 'var(--text-secondary)', cursor: 'pointer',
          }}>
          <option value="all">Semua Status ({statusCounts.all})</option>
          <option value="retur_pembeli">Retur Pembeli ({statusCounts.retur_pembeli})</option>
          <option value="cancel">Cancel ({statusCounts.cancel})</option>
          <option value="retur_refund">Retur/Refund ({statusCounts.retur_refund})</option>
          <option value="pengembalian">Pengembalian Paket ({statusCounts.pengembalian})</option>
          <option value="unknown">Tidak Dikenal ({statusCounts.unknown})</option>
        </select>

        {/* Download */}
        <button onClick={handleDownloadExcel} type="button" className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
          <Download size={13} /> Download
        </button>

        {/* Scan Button */}
        <button onClick={() => setShowScanner(true)} type="button"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.75rem',
            fontWeight: 700, borderRadius: 'var(--radius-md)', border: '2px solid #7c3aed',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', color: '#fff',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
          }}>
          <Camera size={13} /> Scan Resi
        </button>

        {/* Remove Duplicate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input type="checkbox" id="removeDuplicateResi" checked={removeDuplicateResi}
            onChange={e => setRemoveDuplicateResi(e.target.checked)}
            style={{ accentColor: 'var(--accent-primary)', width: '0.875rem', height: '0.875rem' }} />
          <label htmlFor="removeDuplicateResi" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
            Hapus Ganda
          </label>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="modern-table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="modern-table">
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
                {(loading || scanLoading) ? (
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
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────────── */}
      {(() => {
        const totalPages = Math.max(1, Math.ceil(displayData.length / rowsPerPage));
        const safePage = Math.min(currentPage, totalPages);
        const startIdx = (safePage - 1) * rowsPerPage;
        const endIdx = Math.min(startIdx + rowsPerPage, displayData.length);
        const maxButtons = 7;
        let startPage = Math.max(1, safePage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (endPage - startPage + 1 < maxButtons) startPage = Math.max(1, endPage - maxButtons + 1);
        const pageButtons = [];
        for (let p = startPage; p <= endPage; p++) pageButtons.push(p);
        const pageBtn = (label, page, disabled) => (
          <button key={label} type="button" disabled={disabled} onClick={() => setCurrentPage(page)}
            style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
            {label}
          </button>
        );
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Tampilkan</span>
              <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                | {displayData.length > 0 ? `${startIdx + 1}–${endIdx}` : '0'} dari {displayData.length.toLocaleString('id-ID')} data
              </span>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {pageBtn('«', 1, safePage <= 1)}
                {pageBtn('‹', safePage - 1, safePage <= 1)}
                {pageButtons.map(p => (
                  <button key={p} type="button" onClick={() => setCurrentPage(p)}
                    style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: p === safePage ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)', background: p === safePage ? 'var(--accent-primary)' : 'var(--bg-glass)', color: p === safePage ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                    {p}
                  </button>
                ))}
                {pageBtn('›', safePage + 1, safePage >= totalPages)}
                {pageBtn('»', totalPages, safePage >= totalPages)}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Order Detail Popup Modal ──────────────────────────────── */}
      {selectedResi && (() => {
        const orderRows = ordersByTrackingId.get(selectedResi) || [];
        const returnRows = returnByTrackingId.get(selectedResi) || [];
        const hasOrder = orderRows.length > 0;
        const hasReturn = returnRows.length > 0;

        // Get first order to extract general info
        const firstOrder = orderRows[0] || {};
        const orderId = firstOrder['Order ID'] || firstOrder['order_id'] || '';

        // Determine header style based on status
        const statusKey = getStatusKey(selectedResi);
        const statusInfo = STATUS_MAP[statusKey];
        let headerBg = 'transparent';
        let headerBorder = '1px solid var(--border-subtle)';
        if (statusKey === 'cancel') { headerBg = 'rgba(251, 191, 36, 0.15)'; headerBorder = '1px solid rgba(251, 191, 36, 0.3)'; }
        else if (statusKey === 'retur_pembeli' || statusKey === 'retur_refund') { headerBg = 'rgba(167, 139, 250, 0.15)'; headerBorder = '1px solid rgba(167, 139, 250, 0.3)'; }
        else if (statusKey === 'pengembalian') { headerBg = 'rgba(96, 165, 250, 0.15)'; headerBorder = '1px solid rgba(96, 165, 250, 0.3)'; }
        else { headerBg = 'rgba(248, 113, 113, 0.15)'; headerBorder = '1px solid rgba(248, 113, 113, 0.3)'; }

        // Columns to show in the order info grid (exclude product-level columns)
        const skipCols = new Set(['Product Name', 'product_name', 'Seller SKU', 'seller_sku', 'SKU ID', 'sku_id', 'Variation', 'variation', 'Quantity', 'quantity']);
        const orderInfoCols = hasOrder ? Object.keys(firstOrder).filter(c => !skipCols.has(c)) : [];

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
                {hasOrder && orderInfoCols.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Informasi Order
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                      {orderInfoCols.map(col => {
                        let val = firstOrder[col];
                        if (typeof val === 'object' && val !== null && 'text' in val) val = val.text;
                        return (
                          <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.5rem 0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{col}</span>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
                              {val !== null && val !== undefined && val !== '' ? String(val) : '-'}
                            </span>
                          </div>
                        );
                      })}
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
      <BarcodeScanner isOpen={showScanner} onClose={() => { setShowScanner(false); fetchScanData(); }}
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