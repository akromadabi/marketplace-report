import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Pencil, Trash2, Save, X, Search, DollarSign, Boxes, TrendingUp } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || '';

function AsetTable() {
    const [data, setData] = useState(() => {
        try {
            const raw = localStorage.getItem('marketplace_aset_cache');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [loading, setLoading] = useState(() => {
        try { return !localStorage.getItem('marketplace_aset_cache'); } catch { return true; }
    });
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ nama: '', harga: '', jumlah: '' });
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ nama: '', harga: '', jumlah: '' });
    const [saving, setSaving] = useState(false);

    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    useEffect(() => {
        function handleResize() { setWindowWidth(window.innerWidth); }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth < 768;

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/aset`);
            const rows = await res.json();
            if (Array.isArray(rows)) {
                setData(rows);
                try { localStorage.setItem('marketplace_aset_cache', JSON.stringify(rows)); } catch { /* ignore */ }
            }
        } catch (err) {
            console.error('Fetch aset error:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const formatRupiah = (num) => {
        if (!num && num !== 0) return '-';
        return 'Rp' + Number(num).toLocaleString('id-ID');
    };

    const parseNumber = (str) => {
        if (!str) return 0;
        return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0;
    };

    const handleAdd = async () => {
        if (!addForm.nama.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/aset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nama: addForm.nama.trim(),
                    harga: parseNumber(addForm.harga),
                    jumlah: parseNumber(addForm.jumlah),
                }),
            });
            const row = await res.json();
            setData(prev => [row, ...prev]);
            setAddForm({ nama: '', harga: '', jumlah: '' });
            setShowAdd(false);
        } catch (err) { console.error(err); }
        setSaving(false);
    };

    const handleEdit = (row) => {
        setEditingId(row.id);
        setEditForm({ nama: row.nama, harga: String(row.harga), jumlah: String(row.jumlah) });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/aset/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nama: editForm.nama.trim(),
                    harga: parseNumber(editForm.harga),
                    jumlah: parseNumber(editForm.jumlah),
                }),
            });
            const updated = await res.json();
            setData(prev => prev.map(r => r.id === editingId ? updated : r));
            setEditingId(null);
        } catch (err) { console.error(err); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus data aset ini?')) return;
        try {
            await fetch(`${API}/api/aset/${id}`, { method: 'DELETE' });
            setData(prev => prev.filter(r => r.id !== id));
        } catch (err) { console.error(err); }
    };

    const filtered = data.filter(r =>
        r.nama.toLowerCase().includes(search.toLowerCase())
    );

    const totalAset = filtered.reduce((s, r) => s + (r.harga * r.jumlah), 0);
    const totalItems = filtered.reduce((s, r) => s + r.jumlah, 0);
    const avgHarga = totalItems > 0 ? Math.round(totalAset / totalItems) : 0;

    const inputStyle = {
        padding: '0.3rem 0.5rem', borderRadius: '6px',
        border: '1px solid #cbd5e1', background: '#f8fafc',
        color: '#0f172a', fontSize: '0.775rem', width: '100%',
        outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? 'calc(100vh - 8.35rem)' : 'calc(100vh - 1.3rem)',
            overflow: 'hidden',
        }}>
            {/* Focus style override for subtle borders */}
            <style>{`
                .aset-input:focus {
                    border-color: rgba(124,58,237,0.4) !important;
                    box-shadow: 0 0 0 2px rgba(124,58,237,0.1) !important;
                }
            `}</style>

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
                            <Package size={isMobile ? 15 : 17} strokeWidth={2.3} />
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
                            Aset
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
                        {filtered.length} barang tercatat
                    </span>
                </div>

                {/* Right: Search Box (Pepet Kanan) + Tambah Aset Button */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: isMobile ? 'stretch' : 'flex-end',
                }}>
                    <div style={{ position: 'relative', width: isMobile ? '100%' : '200px', flexShrink: 0 }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: search ? '#6366f1' : '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Cari aset..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
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
                            <button type="button" onClick={() => setSearch('')}
                                style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.15rem', display: 'flex' }}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setShowAdd(!showAdd)}
                        type="button"
                        style={{
                            height: '34px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
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
                        }}
                    >
                        <Plus size={14} />
                        <span>Tambah Aset</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                flexShrink: 0,
            }}>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
                        <DollarSign size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Aset</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#7c3aed' }}>{formatRupiah(totalAset)}</div>
                    </div>
                </div>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                        <Boxes size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Barang</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{totalItems.toLocaleString('id-ID')} pcs</div>
                    </div>
                </div>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                        <TrendingUp size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rata-rata / pcs</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{formatRupiah(avgHarga)}</div>
                    </div>
                </div>
            </div>

            {/* Table Container Filling Space */}
            <div
                className="modern-table-wrapper"
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: 0,
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
            >
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                    <table className="modern-table compact-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr>
                                <th style={{ width: '3rem', textAlign: 'center' }}>No</th>
                                <th style={{ textAlign: 'left' }}>Nama Barang</th>
                                <th style={{ textAlign: 'right' }}>Harga Satuan</th>
                                <th style={{ textAlign: 'center' }}>Jumlah (Qty)</th>
                                <th style={{ textAlign: 'right' }}>Total Nilai Aset</th>
                                <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Add row */}
                            {showAdd && (
                                <tr style={{ background: 'rgba(124,58,237,0.05)' }}>
                                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>—</td>
                                    <td>
                                        <input value={addForm.nama} onChange={e => setAddForm(p => ({ ...p, nama: e.target.value }))}
                                            placeholder="Nama barang" style={inputStyle} autoFocus />
                                    </td>
                                    <td>
                                        <input value={addForm.harga} onChange={e => setAddForm(p => ({ ...p, harga: e.target.value }))}
                                            placeholder="Harga" style={{ ...inputStyle, textAlign: 'right' }} />
                                    </td>
                                    <td>
                                        <input value={addForm.jumlah} onChange={e => setAddForm(p => ({ ...p, jumlah: e.target.value }))}
                                            placeholder="Qty" style={{ ...inputStyle, textAlign: 'center', maxWidth: '80px' }} />
                                    </td>
                                    <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>—</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                            <button onClick={handleAdd} disabled={saving} title="Simpan"
                                                style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: '#10b981' }}>
                                                <Save size={14} />
                                            </button>
                                            <button onClick={() => setShowAdd(false)} title="Batal"
                                                style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: '#ef4444' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '3rem 1rem' }}>
                                        Belum ada data aset. Klik "Tambah Aset" untuk mulai.
                                    </td>
                                </tr>
                            ) : filtered.map((row, idx) => (
                                <tr key={row.id}>
                                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 600 }}>{idx + 1}</td>
                                    {editingId === row.id ? (
                                        <>
                                            <td>
                                                <input value={editForm.nama} onChange={e => setEditForm(p => ({ ...p, nama: e.target.value }))}
                                                    style={inputStyle} />
                                            </td>
                                            <td>
                                                <input value={editForm.harga} onChange={e => setEditForm(p => ({ ...p, harga: e.target.value }))}
                                                    style={{ ...inputStyle, textAlign: 'right' }} />
                                            </td>
                                            <td>
                                                <input value={editForm.jumlah} onChange={e => setEditForm(p => ({ ...p, jumlah: e.target.value }))}
                                                    style={{ ...inputStyle, textAlign: 'center', maxWidth: '80px' }} />
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                                                {formatRupiah(parseNumber(editForm.harga) * parseNumber(editForm.jumlah))}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                    <button onClick={handleSave} disabled={saving} title="Simpan"
                                                        style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: '#10b981' }}>
                                                        <Save size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} title="Batal"
                                                        style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: '#ef4444' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.nama}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(row.harga)}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.jumlah}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                                                {formatRupiah(row.harga * row.jumlah)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                    <button onClick={() => handleEdit(row)} title="Edit"
                                                        style={{ background: 'rgba(124,58,237,0.1)', border: 'none', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: '#7c3aed' }}>
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)} title="Hapus"
                                                        style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: '#ef4444' }}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Summary Footer */}
                <div
                    style={{
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
                    }}
                >
                    <span style={{ color: '#64748b', fontWeight: 500 }}>
                        Menampilkan {filtered.length} aset barang
                    </span>
                    <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                        Total Nilai Aset: {formatRupiah(totalAset)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default AsetTable;
