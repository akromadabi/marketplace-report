import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, Plus, Pencil, Trash2, Save, X, Search, DollarSign, Calendar, Tag, ChevronDown, Check } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ nama: '', kategori: '', tanggal: '', biaya: '' });
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ nama: '', kategori: '', tanggal: new Date().toISOString().slice(0, 10), biaya: '' });
    const [saving, setSaving] = useState(false);
    const [filterMonth, setFilterMonth] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/operasional`);
            const rows = await res.json();
            setData(rows);
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
        <div>
            {/* Focus style override for subtle borders */}
            <style>{`
                .op-input:focus {
                    border-color: rgba(124,58,237,0.4) !important;
                    box-shadow: 0 0 0 2px rgba(124,58,237,0.1) !important;
                }
            `}</style>

            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Receipt size={24} style={{ color: '#7c3aed' }} />
                        Operasional
                    </h2>
                    <p>{filtered.length} pengeluaran tercatat</p>
                </div>
                <div style={{ position: 'relative', maxWidth: '20rem', flex: '1' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input type="text" placeholder="Cari operasional..." value={search}
                        onChange={(e) => setSearch(e.target.value)} className="search-input" />
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={20} style={{ color: '#ef4444' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Biaya</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>{formatRupiah(totalBiaya)}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calendar size={20} style={{ color: '#a78bfa' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jumlah Entri</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a78bfa' }}>{filtered.length}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Tag size={20} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kategori</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{uniqueKategori.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                    <Plus size={14} /> Tambah Pengeluaran
                </button>
                <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    className="op-input"
                    style={{
                        ...inputStyle, width: 'auto', padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                    }}
                />
                {filterMonth && (
                    <button onClick={() => setFilterMonth('')}
                        style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: '6px', padding: '0.375rem 0.75rem', cursor: 'pointer', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600 }}>
                        Reset Filter
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="modern-table-wrapper">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>No</th>
                                <th style={thStyle}>Nama</th>
                                <th style={thStyle}>Kategori</th>
                                <th style={thStyle}>Tanggal</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Biaya</th>
                                <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Add row */}
                            {showAdd && (
                                <tr style={{ background: 'rgba(124,58,237,0.05)' }}>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-tertiary)' }}>—</td>
                                    <td style={tdStyle}>
                                        <input value={addForm.nama} onChange={e => setAddForm(p => ({ ...p, nama: e.target.value }))}
                                            placeholder="Nama pengeluaran" className="op-input" style={inputStyle} autoFocus />
                                    </td>
                                    <td style={{ ...tdStyle, overflow: 'visible' }}>
                                        <KategoriDropdown
                                            value={addForm.kategori}
                                            onChange={v => setAddForm(p => ({ ...p, kategori: v }))}
                                            allKategori={allKategori}
                                            onDeleteKategori={handleDeleteKategori}
                                            onRenameKategori={handleRenameKategori}
                                        />
                                    </td>
                                    <td style={tdStyle}>
                                        <input type="date" value={addForm.tanggal} onChange={e => setAddForm(p => ({ ...p, tanggal: e.target.value }))}
                                            className="op-input" style={inputStyle} />
                                    </td>
                                    <td style={tdStyle}>
                                        <input value={addForm.biaya} onChange={e => setAddForm(p => ({ ...p, biaya: e.target.value }))}
                                            placeholder="Biaya" className="op-input" style={{ ...inputStyle, textAlign: 'right' }} />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                            <button onClick={handleAdd} disabled={saving}
                                                style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: '6px', padding: '0.375rem', cursor: 'pointer', color: '#10b981' }}>
                                                <Save size={14} />
                                            </button>
                                            <button onClick={() => setShowAdd(false)}
                                                style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '3rem 1rem' }}>
                                        Belum ada data operasional. Klik "Tambah Pengeluaran" untuk mulai.
                                    </td>
                                </tr>
                            ) : filtered.map((row, idx) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 700 }}>{idx + 1}</td>
                                    {editingId === row.id ? (
                                        <>
                                            <td style={tdStyle}>
                                                <input value={editForm.nama} onChange={e => setEditForm(p => ({ ...p, nama: e.target.value }))}
                                                    className="op-input" style={inputStyle} />
                                            </td>
                                            <td style={{ ...tdStyle, overflow: 'visible' }}>
                                                <KategoriDropdown
                                                    value={editForm.kategori}
                                                    onChange={v => setEditForm(p => ({ ...p, kategori: v }))}
                                                    allKategori={allKategori}
                                                    onDeleteKategori={handleDeleteKategori}
                                                    onRenameKategori={handleRenameKategori}
                                                />
                                            </td>
                                            <td style={tdStyle}>
                                                <input type="date" value={editForm.tanggal} onChange={e => setEditForm(p => ({ ...p, tanggal: e.target.value }))}
                                                    className="op-input" style={inputStyle} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input value={editForm.biaya} onChange={e => setEditForm(p => ({ ...p, biaya: e.target.value }))}
                                                    className="op-input" style={{ ...inputStyle, textAlign: 'right' }} />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                    <button onClick={handleSave} disabled={saving}
                                                        style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: '6px', padding: '0.375rem', cursor: 'pointer', color: '#10b981' }}>
                                                        <Save size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)}
                                                        style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{row.nama}</td>
                                            <td style={tdStyle}>
                                                {row.kategori ? (
                                                    <span style={{
                                                        padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 700,
                                                        background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
                                                    }}>{row.kategori}</span>
                                                ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                                            </td>
                                            <td style={tdStyle}>{formatDate(row.tanggal)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                                {formatRupiah(row.biaya)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                    <button onClick={() => handleEdit(row)}
                                                        style={{ background: 'rgba(124,58,237,0.12)', border: 'none', borderRadius: '6px', padding: '0.375rem', cursor: 'pointer', color: '#a78bfa' }}>
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)}
                                                        style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: '6px', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}>
                                                        <Trash2 size={14} />
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
            </div>
        </div>
    );
}

export default OperasionalTable;
