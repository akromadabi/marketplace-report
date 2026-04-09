import React, { useState, useEffect } from 'react';
import { Calculator, Settings, Plus, Trash2, X, Settings2, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fmtRp, toRawNum } from '../utils';

function PricingCalculator() {
  const [showSettings, setShowSettings] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  
  // Config Default State
  const [adminFeePct, setAdminFeePct] = useState(() => Number(localStorage.getItem('sc_admin') || 8.5));
  const [affiliateFeePct, setAffiliateFeePct] = useState(() => Number(localStorage.getItem('sc_affil') || 5.0));
  const [adSpend, setAdSpend] = useState(() => Number(localStorage.getItem('sc_ad') || 0));
  const [markupPct, setMarkupPct] = useState(() => Number(localStorage.getItem('sc_markup') || 60));
  const [targetMarginMode, setTargetMarginMode] = useState(() => localStorage.getItem('sc_tmode') || 'nominal');
  const [targetMarginValue, setTargetMarginValue] = useState(() => Number(localStorage.getItem('sc_tval') || 15000));

  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rows, setRows] = useState([]);

  // Fetch from DB on mount
  useEffect(() => {
    if (!user?.id) return;
    fetch(`http://localhost:8000/api/pricing-simulations?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setRows(data.map(d => ({
            id: d.id,
            name: d.name,
            platform: d.platform,
            hpp: d.hpp,
            hargaJual: d.harga_jual,
            hargaAwal: d.harga_awal,
            r_adminFeePct: Number(d.admin_fee_pct),
            r_affiliateFeePct: Number(d.affiliate_fee_pct),
            r_adSpend: d.ad_spend,
            r_markupPct: Number(d.markup_pct),
            r_targetMarginMode: d.target_margin_mode,
            r_targetMarginValue: d.target_margin_value
          })));
        } else {
          // Fallback if empty database
          setRows([{ 
            id: Date.now(), name: 'Produk 1', platform: 'Shopee', hpp: 0, hargaJual: 0, hargaAwal: 0,
            r_adminFeePct: adminFeePct, r_affiliateFeePct: affiliateFeePct, r_adSpend: adSpend, r_markupPct: markupPct, r_targetMarginMode: targetMarginMode, r_targetMarginValue: targetMarginValue
          }]);
        }
        setIsLoading(false);
      })
      .catch(err => {
         console.error("Failed to fetch simulations:", err);
         setIsLoading(false);
      });
  }, []); // eslint-disable-line

  // Save to Config LocalStorage on Change (Global Defaults only)
  useEffect(() => {
    localStorage.setItem('sc_admin', adminFeePct);
    localStorage.setItem('sc_affil', affiliateFeePct);
    localStorage.setItem('sc_ad', adSpend);
    localStorage.setItem('sc_markup', markupPct);
    localStorage.setItem('sc_tmode', targetMarginMode);
    localStorage.setItem('sc_tval', targetMarginValue);
  }, [adminFeePct, affiliateFeePct, adSpend, markupPct, targetMarginMode, targetMarginValue]);

  const handleSaveToDB = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await fetch('http://localhost:8000/api/pricing-simulations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ user_id: user.id, rows })
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save failed", err);
    }
    setIsSaving(false);
  };

  const addRow = () => {
    setRows([...rows, { 
      id: Date.now(), name: `Produk ${rows.length + 1}`, platform: 'Shopee', hpp: 0, hargaJual: 0, hargaAwal: 0,
      r_adminFeePct: adminFeePct, r_affiliateFeePct: affiliateFeePct, r_adSpend: adSpend, r_markupPct: markupPct, r_targetMarginMode: targetMarginMode, r_targetMarginValue: targetMarginValue
    }]);
  };

  const removeRow = (id) => setRows(rows.filter(r => r.id !== id));
  
  const updateRow = (id, field, value) => {
    setRows(prevRows => prevRows.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: value };
      
      // Auto-calculate hargaJual & hargaAwal if relevant fields change
      const triggerFields = ['hpp', 'r_adminFeePct', 'r_affiliateFeePct', 'r_adSpend', 'r_markupPct', 'r_targetMarginMode', 'r_targetMarginValue'];
      if (triggerFields.includes(field)) {
        const hpp = next.hpp || 0;
        if (hpp > 0) {
          const F = ((Number(next.r_adminFeePct) || 0) + (Number(next.r_affiliateFeePct) || 0)) / 100;
          const safeF = F >= 1 ? 0.99 : F;
          const profitTarget = next.r_targetMarginMode === 'nominal' ? (Number(next.r_targetMarginValue) || 0) : (hpp * (Number(next.r_targetMarginValue) || 0) / 100);
          
          let rawHargaPromo = (hpp + profitTarget + (Number(next.r_adSpend) || 0)) / (1 - safeF);
          next.hargaJual = Math.ceil(rawHargaPromo / 100) * 100;
          
          let rawHargaCoret = next.hargaJual / (1 - (Math.min(99, Number(next.r_markupPct) || 0) / 100));
          next.hargaAwal = Math.ceil(rawHargaCoret / 100) * 100;
        } else {
          next.hargaJual = 0;
          next.hargaAwal = 0;
        }
      }
      return next;
    }));
  };

  // The modal info for the currently edited row
  const editingRow = rows.find(r => r.id === editingRowId);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--gradient-primary)', color: 'white', padding: '0.625rem', borderRadius: '0.625rem', boxShadow: '0 4px 15px rgba(108,92,231,0.2)' }}>
            <Calculator size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.125rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Kalkulator Simulasi Bebas</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Input manual HPP untuk meracik harga jual platform secara instan.</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
           {saveSuccess && <span style={{ fontSize: '0.8125rem', color: 'var(--accent-success)', fontWeight: 600, animation: 'fadeIn 0.3s ease' }}>✓ Tersimpan</span>}
           <button onClick={() => setShowSettings(true)} className="btn-secondary">
             <Settings size={16} /> Pengaturan
           </button>
           <button onClick={handleSaveToDB} disabled={isSaving} className="btn-primary">
             <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Tabel'}
           </button>
        </div>
      </div>

      <div className="modern-table-wrapper" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
        <table className="modern-table" style={{ minWidth: '950px' }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Nama Produk/Catatan</th>
              <th style={{ width: '10%' }}>Platform</th>
              <th style={{ textAlign: 'right', width: '12%' }}>HPP (Modal)</th>
              <th style={{ textAlign: 'right', width: '12%' }}>Harga Jual</th>
              <th style={{ textAlign: 'right' }}>Harga Coret</th>
              <th style={{ textAlign: 'right' }}>Beban Platform</th>
              <th style={{ textAlign: 'right' }}>Profit Biasa</th>
              <th style={{ textAlign: 'right' }}>Profit Afiliasi</th>
              <th style={{ textAlign: 'center', width: '4rem' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hargaAwal = r.hargaAwal || (r.hargaJual > 0 ? Math.ceil((r.hargaJual / (1 - (r.r_markupPct/100)))/100)*100 : 0);
              
              const fAdmin = (r.hargaJual * (Number(r.r_adminFeePct) || 0) / 100);
              const fAffiliate = (r.hargaJual * (Number(r.r_affiliateFeePct) || 0) / 100);
              const fIklan = (Number(r.r_adSpend) || 0);

              const bebanNormal = Math.round(fAdmin + fIklan);
              const bebanAffiliate = Math.round(fAdmin + fAffiliate + fIklan);
              
              const profitNormal = r.hargaJual > 0 ? Math.round(r.hargaJual - (r.hpp || 0) - bebanNormal) : 0;
              const profitAffiliate = r.hargaJual > 0 ? Math.round(r.hargaJual - (r.hpp || 0) - bebanAffiliate) : 0;

              return (
                <tr key={r.id}>
                  <td style={{ verticalAlign: 'middle', padding: '0.5rem' }}>
                    <input type="text" className="form-input" value={r.name} onChange={e => updateRow(r.id, 'name', e.target.value)} placeholder="Contoh: Kemeja Pria" style={{ width: '100%', padding: '0.4rem 0.6rem', background: 'transparent', border: '1px solid transparent' }} onFocus={e => e.currentTarget.style.border = '1px solid var(--accent-primary)'} onBlur={e => e.currentTarget.style.border = '1px solid transparent'} />
                  </td>
                  <td style={{ verticalAlign: 'middle', padding: '0.5rem' }}>
                      <select className="custom-select" value={r.platform} onChange={e => updateRow(r.id, 'platform', e.target.value)} style={{ padding: '0.4rem 1.5rem 0.4rem 0.6rem', color: r.platform === 'Shopee' ? '#e04d2d' : 'inherit', borderColor: 'transparent', background: 'transparent' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--border-medium)'} onBlur={e => e.currentTarget.style.borderColor = 'transparent'}>
                        <option value="Shopee">Shopee</option>
                        <option value="TikTok">TikTok</option>
                      </select>
                  </td>
                  <td style={{ verticalAlign: 'middle', padding: '0.5rem' }}>
                    <input type="text" inputMode="numeric" className="form-input" value={r.hpp ? fmtRp(r.hpp) : ''} onChange={e => updateRow(r.id, 'hpp', toRawNum(e.target.value))} placeholder="Rp " style={{ width: '100%', textAlign: 'right', padding: '0.4rem 0.6rem', background: 'var(--bg-glass)' }} />
                  </td>
                  <td style={{ verticalAlign: 'middle', padding: '0.5rem' }}>
                    <input type="text" inputMode="numeric" className="form-input" value={r.hargaJual ? fmtRp(r.hargaJual) : ''} onChange={e => updateRow(r.id, 'hargaJual', toRawNum(e.target.value))} placeholder="Rp " style={{ width: '100%', textAlign: 'right', padding: '0.4rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', border: r.hargaJual > 0 ? '1px solid var(--border-subtle)' : '1px dashed var(--border-medium)', background: '#fff' }} />
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                     {r.hargaJual > 0 ? (
                       <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{fmtRp(hargaAwal)}</span>
                          <span className="badge badge-danger" style={{ padding: '0.125rem 0.375rem', fontSize: '0.625rem' }}>
                            -{Math.round(((hargaAwal - r.hargaJual)/hargaAwal)*100)}%
                          </span>
                       </div>
                     ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                     {r.hargaJual > 0 ? (
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                          <span style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>{fmtRp(bebanAffiliate)}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Admin {r.r_adminFeePct}%+Afil {r.r_affiliateFeePct}%</span>
                       </div>
                     ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                     {r.hargaJual > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: profitNormal > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{fmtRp(profitNormal)}</span>
                          <span style={{ fontSize: '0.6875rem', color: profitNormal > 0 ? 'var(--accent-success)' : 'var(--accent-danger)', opacity: 0.8 }}>{((profitNormal / r.hargaJual) * 100).toFixed(1)}% margin</span>
                        </div>
                     ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                     {r.hargaJual > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: profitAffiliate > 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>{fmtRp(profitAffiliate)}</span>
                          <span style={{ fontSize: '0.6875rem', color: profitAffiliate > 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)', opacity: 0.8 }}>{((profitAffiliate / r.hargaJual) * 100).toFixed(1)}% margin</span>
                        </div>
                     ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                     <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                       <button onClick={() => setEditingRowId(r.id)} className="btn-secondary" style={{ padding: '0.375rem', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }} title="Pengaturan Lanjut Baris Ini">
                          <Settings2 size={16} />
                       </button>
                       <button onClick={() => removeRow(r.id)} className="btn-secondary" style={{ padding: '0.375rem', border: 'none', background: 'transparent', color: 'var(--accent-danger)' }} title="Hapus Baris">
                          <Trash2 size={16} />
                       </button>
                     </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-medium)', background: 'rgba(108,92,231,0.03)', display: 'flex', justifyContent: 'center' }}>
          <button onClick={addRow} className="btn-secondary" style={{ borderStyle: 'dashed' }}>
            <Plus size={16} /> Tambah Label Kosong
          </button>
        </div>
      </div>

      {/* GLOBAL Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '420px', maxWidth: '90%', padding: '1.5rem', position: 'relative', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
             <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Settings size={20} color="#6c5ce7" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Pengaturan Nilai Bawaan (Default)</h3>
             </div>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>Nilai ini hanya akan dipakai sebagai *template* awal saat menambahkan baris baru.</p>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Biaya Admin (%)</label>
                    <input type="number" className="im-input" value={adminFeePct} onChange={e => setAdminFeePct(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Komisi Afiliasi (%)</label>
                    <input type="number" className="im-input" value={affiliateFeePct} onChange={e => setAffiliateFeePct(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Biaya Iklan (Rp) / Pcs</label>
                  <input type="text" className="im-input" value={fmtRp(adSpend)} onChange={e => setAdSpend(toRawNum(e.target.value))} style={{ width: '100%', padding: '0.5rem' }} />
                </div>
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.25rem 0' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Target Margin Minimum</label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <select className="im-input" value={targetMarginMode} onChange={e => setTargetMarginMode(e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                       <option value="nominal">Rp</option>
                       <option value="percent">% (HPP)</option>
                    </select>
                    <input type="text" className="im-input" value={targetMarginMode === 'nominal' ? fmtRp(targetMarginValue) : targetMarginValue} onChange={e => setTargetMarginValue(toRawNum(e.target.value))} style={{ width: '100%', flex: 1, padding: '0.5rem' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Target Markup Harga (% Coret)</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" className="im-input" value={markupPct} onChange={e => setMarkupPct(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '0.75rem', pointerEvents: 'none' }}>% Mark-up</span>
                  </div>
                </div>
             </div>
             <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSettings(false)} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}>Simpan Pengaturan Utama</button>
             </div>
          </div>
        </div>
      )}

      {/* ROW Specific Settings Modal */}
      {editingRowId && editingRow && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '400px', maxWidth: '90%', padding: '1.5rem', position: 'relative', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
             <button onClick={() => setEditingRowId(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Settings2 size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Pengaturan Lanjut Baris</h3>
             </div>
             <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem', fontWeight: 600 }}>{editingRow.name}</p>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Penentuan Kategori Berdasarkan Platform</label>
                  <select 
                    className="im-input" 
                    onChange={e => {
                      if (e.target.value !== "") updateRow(editingRow.id, 'r_adminFeePct', Number(e.target.value));
                    }}
                    style={{ width: '100%', padding: '0.4rem', background: 'rgba(108,92,231,0.05)', borderColor: 'rgba(108,92,231,0.2)', color: '#6c5ce7', fontWeight: 600, fontSize: '0.8125rem' }}
                  >
                     <option value="" disabled selected>Pilih Kategori untuk isi otomatis...</option>
                     <option value="">Kustom / Isi Manual</option>
                     {editingRow.platform === 'Shopee' ? (
                       <optgroup label="━━ Shopee ━━">
                         <option value="8.5">Kategori A (Fashion, Pakaian, Kosmetik) - 8.5%</option>
                         <option value="8.0">Kategori B/C (Tas, Sepatu, Rumah Tangga) - 8.0%</option>
                         <option value="6.5">Kategori D (Aksesoris Gadget, Elektronik) - 6.5%</option>
                         <option value="5.5">Kategori E (HP, Laptop, Kamera) - 5.5%</option>
                       </optgroup>
                     ) : (
                       <optgroup label="━━ TikTok Shop ━━">
                         <option value="6.5">Grup 1 (Fashion, Baju, Sepatu) - 6.5%</option>
                         <option value="5.5">Grup 2 (Skin Care, Makeup, Makanan) - 5.5%</option>
                         <option value="4.0">Grup 3 (Alat Dapur, Dekorasi, Olahraga) - 4.0%</option>
                         <option value="3.1">Grup 4 (Elektronik Besar, Mesin Cuci, dll) - 3.1%</option>
                         <option value="2.0">Grup 5 (Handphone, PC, Tablet, Konsol) - 2.0%</option>
                       </optgroup>
                     )}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Nilai Biaya Admin (%)</label>
                    <input type="number" className="im-input" value={editingRow.r_adminFeePct} onChange={e => updateRow(editingRow.id, 'r_adminFeePct', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: '#f8fafc' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Override Komisi Afiliasi (%)</label>
                    <input type="number" className="im-input" value={editingRow.r_affiliateFeePct} onChange={e => updateRow(editingRow.id, 'r_affiliateFeePct', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: '#f8fafc' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Override Biaya Iklan (Rp) / Pcs</label>
                  <input type="text" className="im-input" value={fmtRp(editingRow.r_adSpend)} onChange={e => updateRow(editingRow.id, 'r_adSpend', toRawNum(e.target.value))} style={{ width: '100%', padding: '0.5rem', background: '#f8fafc' }} />
                </div>
                
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.25rem 0' }} />
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Margin Auto-Calculate</label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <select className="im-input" value={editingRow.r_targetMarginMode} onChange={e => updateRow(editingRow.id, 'r_targetMarginMode', e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                       <option value="nominal">Rp</option>
                       <option value="percent">% (HPP)</option>
                    </select>
                    <input type="text" className="im-input" value={editingRow.r_targetMarginMode === 'nominal' ? fmtRp(editingRow.r_targetMarginValue) : editingRow.r_targetMarginValue} onChange={e => updateRow(editingRow.id, 'r_targetMarginValue', toRawNum(e.target.value))} style={{ width: '100%', flex: 1, padding: '0.5rem' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Target Markup Harga (% Coret)</label>
                  <input type="number" className="im-input" value={editingRow.r_markupPct} onChange={e => updateRow(editingRow.id, 'r_markupPct', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                </div>
             </div>
             
             <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingRowId(null)} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}>Tutup & Hitung Baris</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PricingCalculator;
