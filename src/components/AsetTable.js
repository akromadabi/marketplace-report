import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Pencil, Trash2, Save, X, Search, DollarSign, Boxes, TrendingUp } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AsetTable() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ nama: '', harga: '', jumlah: '' });
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ nama: '', harga: '', jumlah: '' });
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/aset`);
            const rows = await res.json();
            setData(rows);
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
        if (!window.confirm('Hapus aset ini?')) return;
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
    const avgHarga = filtered.length > 0 ? Math.round(totalAset / Math.max(totalItems, 1)) : 0;

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
                .aset-input:focus {
                    border-color: rgba(124,58,237,0.4) !important;
                    box-shadow: 0 0 0 2px rgba(124,58,237,0.1) !important;
                }
            `}</style>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={24} style={{ color: '#7c3aed' }} />
                        Aset
                    </h2>
                    <p>{filtered.length} barang tercatat</p>
                </div>
                <div style={{ position: 'relative', maxWidth: '20rem', flex: '1' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input type="text" placeholder="Cari aset..." value={search}
                        onChange={(e) => setSearch(e.target.value)} className="search-input" />
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={20} style={{ color: '#a78bfa' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a78bfa' }}>{formatRupiah(totalAset)}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Boxes size={20} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Barang</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{totalItems.toLocaleString('id-ID')} pcs</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={20} style={{ color: '#f59e0b' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rata-rata / pcs</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{formatRupiah(avgHarga)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Button */}
            <div style={{ marginBottom: '1rem' }}>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                    <Plus size={14} /> Tambah Aset
                </button>
            </div>

            {/* Table */}
            <div className="modern-table-wrapper">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>No</th>
                                <th style={thStyle}>Nama</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Harga</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Jumlah</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Aset</th>
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
                                            placeholder="Nama barang" style={inputStyle} autoFocus />
                                    </td>
                                    <td style={tdStyle}>
                                        <input value={addForm.harga} onChange={e => setAddForm(p => ({ ...p, harga: e.target.value }))}
                                            placeholder="Harga" style={{ ...inputStyle, textAlign: 'right' }} />
                                    </td>
                                    <td style={tdStyle}>
                                        <input value={addForm.jumlah} onChange={e => setAddForm(p => ({ ...p, jumlah: e.target.value }))}
                                            placeholder="Qty" style={{ ...inputStyle, textAlign: 'center', maxWidth: '80px' }} />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-tertiary)' }}>—</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                            <button onClick={handleAdd} disabled={saving}
                                                style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer', color: '#10b981' }}>
                                                <Save size={14} />
                                            </button>
                                            <button onClick={() => setShowAdd(false)}
                                                style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '3rem 1rem' }}>
                                        Belum ada data aset. Klik "Tambah Aset" untuk mulai.
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
                                                    style={inputStyle} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input value={editForm.harga} onChange={e => setEditForm(p => ({ ...p, harga: e.target.value }))}
                                                    style={{ ...inputStyle, textAlign: 'right' }} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input value={editForm.jumlah} onChange={e => setEditForm(p => ({ ...p, jumlah: e.target.value }))}
                                                    style={{ ...inputStyle, textAlign: 'center', maxWidth: '80px' }} />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-tertiary)' }}>
                                                {formatRupiah(parseNumber(editForm.harga) * parseNumber(editForm.jumlah))}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                    <button onClick={handleSave} disabled={saving}
                                                        style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer', color: '#10b981' }}>
                                                        <Save size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)}
                                                        style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{row.nama}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatRupiah(row.harga)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>{row.jumlah}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#a78bfa' }}>
                                                {formatRupiah(row.harga * row.jumlah)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                    <button onClick={() => handleEdit(row)}
                                                        style={{ background: 'rgba(124,58,237,0.12)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer', color: '#a78bfa' }}>
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)}
                                                        style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}>
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

export default AsetTable;
