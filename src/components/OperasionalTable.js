import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, Plus, Pencil, Trash2, Save, X, Search, DollarSign, Calendar, Tag, ChevronDown, Check } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || '';

/* ─── Kategori Dropdown (creatable + editable + deletable) ─────── */
function KategoriDropdown({ value, onChange, allKategori, onDeleteKategori, onRenameKategori }) {
    const [open, setOpen] = useState(false);
    const [newKat, setNewKat] = useState('');
    const [editingKat, setEditingKat] = useState(null);
    const [editKatValue, setEditKatValue] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectKat = (k) => { onChange(k); setOpen(false); };

    const handleAddNew = () => {
        const trimmed = newKat.trim();
        if (!trimmed) return;
        onChange(trimmed);
        setNewKat('');
        setOpen(false);
    };

    const startEdit = (e, k) => {
        e.stopPropagation();
        setEditingKat(k);
        setEditKatValue(k);
    };

    const confirmEdit = (e, oldK) => {
        e.stopPropagation();
        const trimmed = editKatValue.trim();
        if (trimmed && trimmed !== oldK) onRenameKategori(oldK, trimmed);
        setEditingKat(null);
    };

    const handleDeleteKat = (e, k) => {
        e.stopPropagation();
        onDeleteKategori(k);
        if (value === k) onChange('');
    };

    const dropdownBase = {
        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        zIndex: 50,
    };

    const itemBase = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.325rem 0.625rem', cursor: 'pointer', fontSize: '0.8rem',
        transition: 'background 0.1s', color: 'var(--text-primary)',
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen(!open)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.375rem 0.625rem',
                    borderRadius: '6px', border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-glass)', color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: '0.8125rem', cursor: 'pointer', gap: '0.25rem',
                    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value || 'Pilih kategori'}
                </span>
                <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
            </button>

            {open && (
                <div style={dropdownBase}>
                    {/* Existing categories */}
                    {allKategori.length > 0 && allKategori.map(k => (
                        <div key={k}
                            style={{ ...itemBase, background: value === k ? 'rgba(124,58,237,0.1)' : 'transparent' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = value === k ? 'rgba(124,58,237,0.1)' : 'transparent'}
                            onClick={() => editingKat !== k && selectKat(k)}>

                            {editingKat === k ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }} onClick={e => e.stopPropagation()}>
                                    <input value={editKatValue} onChange={e => setEditKatValue(e.target.value)}
                                        autoFocus
                                        style={{
                                            flex: 1, padding: '2px 6px', fontSize: '0.8125rem',
                                            borderRadius: '4px', border: '1px solid var(--border-subtle)',
                                            background: 'var(--bg-glass)', color: 'var(--text-primary)',
                                            outline: 'none',
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') confirmEdit(e, k); if (e.key === 'Escape') setEditingKat(null); }}
                                    />
                                    <button onClick={e => confirmEdit(e, k)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '2px' }}>
                                        <Check size={13} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                        {value === k && <Check size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />}
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                        <button onClick={e => startEdit(e, k)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', borderRadius: '3px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                                            <Pencil size={12} />
                                        </button>
                                        <button onClick={e => handleDeleteKat(e, k)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', borderRadius: '3px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {/* Clear selection */}
                    {value && (
                        <div
                            style={{ ...itemBase, color: 'var(--text-tertiary)', borderTop: allKategori.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                            onClick={() => selectKat('')}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span>— Hapus pilihan —</span>
                        </div>
                    )}

                    {/* Add new */}
                    <div style={{ padding: '0.375rem 0.625rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input value={newKat} onChange={e => setNewKat(e.target.value)}
                                placeholder="Kategori baru..."
                                style={{
                                    flex: 1, minWidth: 0, padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                                    borderRadius: '5px', border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-glass)', color: 'var(--text-primary)', outline: 'none',
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }}
                            />
                            <button onClick={handleAddNew} title="Tambah kategori"
                                style={{
                                    background: 'rgba(124,58,237,0.15)', border: 'none', borderRadius: '50%',
                                    width: 22, height: 22, minWidth: 22, cursor: 'pointer', color: '#a78bfa',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                <Plus size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main Component ───────────────────────────────────────────── */
function OperasionalTable() {
    const [data, setData] = useState(() => {
        try {
            const raw = localStorage.getItem('marketplace_operasional_cache');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [loading, setLoading] = useState(() => {
        try { return !localStorage.getItem('marketplace_operasional_cache'); } catch { return true; }
    });
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ nama: '', kategori: '', tanggal: '', biaya: '' });
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ nama: '', kategori: '', tanggal: new Date().toISOString().slice(0, 10), biaya: '' });
    const [saving, setSaving] = useState(false);
    const [filterMonth, setFilterMonth] = useState('');

    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    useEffect(() => {
        function handleResize() { setWindowWidth(window.innerWidth); }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth < 768;

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/operasional`);
            const rows = await res.json();
            if (Array.isArray(rows)) {
                setData(rows);
                try { localStorage.setItem('marketplace_operasional_cache', JSON.stringify(rows)); } catch { /* ignore */ }
            }
        } catch (err) {
            console.error('Fetch operasional error:', err);
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

    const formatDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // All unique categories from data
    const allKategori = [...new Set(data.map(r => r.kategori).filter(Boolean))].sort();

    // Rename a kategori across all rows
    const handleRenameKategori = async (oldK, newK) => {
        const affected = data.filter(r => r.kategori === oldK);
        for (const row of affected) {
            try {
                await fetch(`${API}/api/operasional/${row.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nama: row.nama, kategori: newK, tanggal: row.tanggal ? new Date(row.tanggal).toISOString().slice(0, 10) : null, biaya: row.biaya }),
                });
            } catch (err) { console.error(err); }
        }
        setData(prev => prev.map(r => r.kategori === oldK ? { ...r, kategori: newK } : r));
    };

    // Delete a kategori (set to null on all affected rows)
    const handleDeleteKategori = async (k) => {
        if (!window.confirm(`Hapus kategori "${k}" dari semua entri?`)) return;
        const affected = data.filter(r => r.kategori === k);
        for (const row of affected) {
            try {
                await fetch(`${API}/api/operasional/${row.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nama: row.nama, kategori: null, tanggal: row.tanggal ? new Date(row.tanggal).toISOString().slice(0, 10) : null, biaya: row.biaya }),
                });
            } catch (err) { console.error(err); }
        }
        setData(prev => prev.map(r => r.kategori === k ? { ...r, kategori: null } : r));
    };

    const handleAdd = async () => {
        if (!addForm.nama.trim() || !addForm.tanggal) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/operasional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nama: addForm.nama.trim(),
                    kategori: addForm.kategori.trim() || null,
                    tanggal: addForm.tanggal,
                    biaya: parseNumber(addForm.biaya),
                }),
            });
            const row = await res.json();
            setData(prev => [row, ...prev]);
            setAddForm({ nama: '', kategori: '', tanggal: new Date().toISOString().slice(0, 10), biaya: '' });
            setShowAdd(false);
        } catch (err) { console.error(err); }
        setSaving(false);
    };

    const handleEdit = (row) => {
        setEditingId(row.id);
        const tgl = row.tanggal ? new Date(row.tanggal).toISOString().slice(0, 10) : '';
        setEditForm({ nama: row.nama, kategori: row.kategori || '', tanggal: tgl, biaya: String(row.biaya) });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/operasional/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nama: editForm.nama.trim(),
                    kategori: editForm.kategori.trim() || null,
                    tanggal: editForm.tanggal,
                    biaya: parseNumber(editForm.biaya),
                }),
            });
            const updated = await res.json();
            setData(prev => prev.map(r => r.id === editingId ? updated : r));
            setEditingId(null);
        } catch (err) { console.error(err); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus data operasional ini?')) return;
        try {
            await fetch(`${API}/api/operasional/${id}`, { method: 'DELETE' });
            setData(prev => prev.filter(r => r.id !== id));
        } catch (err) { console.error(err); }
    };

    // Filter by search and month
    const filtered = data.filter(r => {
        const matchSearch = r.nama.toLowerCase().includes(search.toLowerCase()) ||
            (r.kategori || '').toLowerCase().includes(search.toLowerCase());
        if (filterMonth) {
            const rowMonth = r.tanggal ? new Date(r.tanggal).toISOString().slice(0, 7) : '';
            return matchSearch && rowMonth === filterMonth;
        }
        return matchSearch;
    });

    const totalBiaya = filtered.reduce((s, r) => s + (r.biaya || 0), 0);
    const uniqueKategori = [...new Set(filtered.map(r => r.kategori).filter(Boolean))];

    const thStyle = {
        padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)',
        borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
        background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 2,
    };
    const tdStyle = { padding: '0.625rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8125rem' };
    const inputStyle = {
        padding: '0.375rem 0.625rem', borderRadius: '6px',
        border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)',
        color: 'var(--text-primary)', fontSize: '0.8125rem', width: '100%',
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
                .op-input:focus {
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
                            <Receipt size={isMobile ? 15 : 17} strokeWidth={2.3} />
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
                            Biaya Operasional
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
                        {filtered.length} pengeluaran tercatat
                    </span>
                </div>

                {/* Right: Search + Month filter + Reset + Tambah Pengeluaran Button */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: isMobile ? 'stretch' : 'flex-end',
                }}>
                    <div style={{ position: 'relative', width: isMobile ? '100%' : '180px', flexShrink: 0 }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: search ? '#6366f1' : '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Cari operasional..."
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

                    <input
                        type="month"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        style={{
                            height: '34px',
                            padding: '0 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#334155',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    />

                    {filterMonth && (
                        <button
                            type="button"
                            onClick={() => setFilterMonth('')}
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
                            <X size={13} />
                            <span>Reset Bulan</span>
                        </button>
                    )}

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
                        <span>Tambah Pengeluaran</span>
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
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                        <DollarSign size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Biaya</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{formatRupiah(totalBiaya)}</div>
                    </div>
                </div>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
                        <Calendar size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Jumlah Entri</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#7c3aed' }}>{filtered.length}</div>
                    </div>
                </div>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                        <Tag size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kategori</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{uniqueKategori.length}</div>
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
                                <th style={{ textAlign: 'left' }}>Nama Pengeluaran</th>
                                <th style={{ textAlign: 'left' }}>Kategori</th>
                                <th style={{ textAlign: 'center' }}>Tanggal</th>
                                <th style={{ textAlign: 'right' }}>Biaya</th>
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
                                            placeholder="Nama pengeluaran" className="op-input" style={inputStyle} autoFocus />
                                    </td>
                                    <td style={{ overflow: 'visible' }}>
                                        <KategoriDropdown
                                            value={addForm.kategori}
                                            onChange={v => setAddForm(p => ({ ...p, kategori: v }))}
                                            allKategori={allKategori}
                                            onDeleteKategori={handleDeleteKategori}
                                            onRenameKategori={handleRenameKategori}
                                        />
                                    </td>
                                    <td>
                                        <input type="date" value={addForm.tanggal} onChange={e => setAddForm(p => ({ ...p, tanggal: e.target.value }))}
                                            className="op-input" style={inputStyle} />
                                    </td>
                                    <td>
                                        <input value={addForm.biaya} onChange={e => setAddForm(p => ({ ...p, biaya: e.target.value }))}
                                            placeholder="Biaya" className="op-input" style={{ ...inputStyle, textAlign: 'right' }} />
                                    </td>
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
                                        Belum ada data operasional. Klik "Tambah Pengeluaran" untuk mulai.
                                    </td>
                                </tr>
                            ) : filtered.map((row, idx) => (
                                <tr key={row.id}>
                                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 600 }}>{idx + 1}</td>
                                    {editingId === row.id ? (
                                        <>
                                            <td>
                                                <input value={editForm.nama} onChange={e => setEditForm(p => ({ ...p, nama: e.target.value }))}
                                                    className="op-input" style={inputStyle} />
                                            </td>
                                            <td style={{ overflow: 'visible' }}>
                                                <KategoriDropdown
                                                    value={editForm.kategori}
                                                    onChange={v => setEditForm(p => ({ ...p, kategori: v }))}
                                                    allKategori={allKategori}
                                                    onDeleteKategori={handleDeleteKategori}
                                                    onRenameKategori={handleRenameKategori}
                                                />
                                            </td>
                                            <td>
                                                <input type="date" value={editForm.tanggal} onChange={e => setEditForm(p => ({ ...p, tanggal: e.target.value }))}
                                                    className="op-input" style={inputStyle} />
                                            </td>
                                            <td>
                                                <input value={editForm.biaya} onChange={e => setEditForm(p => ({ ...p, biaya: e.target.value }))}
                                                    className="op-input" style={{ ...inputStyle, textAlign: 'right' }} />
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
                                            <td>
                                                {row.kategori ? (
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600,
                                                        background: 'rgba(124,58,237,0.1)', color: '#7c3aed',
                                                        border: '1px solid rgba(124,58,237,0.2)',
                                                    }}>{row.kategori}</span>
                                                ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                                            </td>
                                            <td style={{ textAlign: 'center', color: '#64748b' }}>{formatDate(row.tanggal)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                                                {formatRupiah(row.biaya)}
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
                        Menampilkan {filtered.length} catatan pengeluaran
                    </span>
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>
                        Total Biaya: {formatRupiah(totalBiaya)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default OperasionalTable;
