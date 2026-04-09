import React, { useState, useEffect } from 'react';
import { Calculator, X, Save, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { toRawNum, fmtRp } from '../utils';

function PriceCalculatorModal({
    isOpen,
    onClose,
    productInfo, // { name, skuId, variation }
    initialHpp,
    platform,
    feeProfiles, // Array of { id, name, platform, admin_fee_pct, affiliate_fee_pct, markup_pct, default_ad_spend }
    onApply
}) {
    // ─── STATE ───────────────────────────────────────────────────────────
    const [hpp, setHpp] = useState(0);
    const [profitMode, setProfitMode] = useState('nominal'); // 'nominal' | 'percent'
    const [profitValue, setProfitValue] = useState(15000);
    
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [adminFee, setAdminFee] = useState(0);
    const [affiliateFee, setAffiliateFee] = useState(0);
    const [markupPct, setMarkupPct] = useState(60);
    const [adSpend, setAdSpend] = useState(0);

    // Initial setup when modal opens
    useEffect(() => {
        if (isOpen) {
            const parsedHpp = Math.max(0, toRawNum(initialHpp) || 0);
            setHpp(parsedHpp);
            
            // Set default profile if available
            const matchingProfiles = feeProfiles.filter(p => p.platform === platform || p.platform === 'general');
            if (matchingProfiles.length > 0) {
                const def = matchingProfiles[0];
                setSelectedProfileId(String(def.id));
                applyProfile(def);
            }
        }
    }, [isOpen, initialHpp, feeProfiles, platform]);

    function applyProfile(prof) {
        setAdminFee(Number(prof.admin_fee_pct) || 0);
        setAffiliateFee(Number(prof.affiliate_fee_pct) || 0);
        setMarkupPct(Number(prof.markup_pct) || 60);
        setAdSpend(Number(prof.default_ad_spend) || 0);
    }

    function handleProfileChange(e) {
        const id = e.target.value;
        setSelectedProfileId(id);
        const prof = feeProfiles.find(p => String(p.id) === id);
        if (prof) applyProfile(prof);
    }

    // ─── CALCULATION ─────────────────────────────────────────────────────
    // Profit
    const calculatedProfit = profitMode === 'nominal' 
        ? (Number(profitValue) || 0)
        : (hpp * (Number(profitValue) || 0) / 100);

    // F = Total Fee Percentage
    const F = ((Number(adminFee) || 0) + (Number(affiliateFee) || 0)) / 100;
    
    // Safety check for F >= 1
    const safeF = F >= 1 ? 0.99 : F;

    // Harga Akhir
    // Rp = (HPP + Keuntungan + Iklan) / (1 - F)
    let rawHargaPromo = (hpp + calculatedProfit + (Number(adSpend) || 0)) / (1 - safeF);
    
    // Harga Awal
    let rawHargaCoret = rawHargaPromo / (1 - (Math.min(99, Number(markupPct) || 0) / 100));

    // Bulatkan ke ratusan terdekat
    const finalHargaPromo = Math.ceil(rawHargaPromo / 100) * 100;
    const finalHargaCoret = Math.ceil(rawHargaCoret / 100) * 100;

    // Reverse check for display
    const platformDeduction = finalHargaPromo * ((Number(adminFee) || 0) / 100);
    const affiliateDeduction = finalHargaPromo * ((Number(affiliateFee) || 0) / 100);
    const netRevenue = finalHargaPromo - platformDeduction - affiliateDeduction - (Number(adSpend) || 0);
    const marginBersihText = Math.max(0, netRevenue - hpp);

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-glass)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ background: 'rgba(108,92,231,0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: '#6c5ce7' }}>
                            <Calculator size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margsainBottom: 0 }}>Kalkulator Harga</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{productInfo?.name || 'Produk'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* HPP & Target */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>HPP (Modal) Rp</label>
                            <input 
                                type="text" 
                                inputMode="numeric"
                                className="im-input" 
                                value={hpp ? fmtRp(hpp) : ''} 
                                onChange={e => setHpp(toRawNum(e.target.value))}
                                style={{ width: '100%', fontSize: '0.875rem' }} 
                            />
                        </div>
                        <div style={{ flex: 1.5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Keuntungan</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                                        <input type="radio" checked={profitMode === 'nominal'} onChange={() => setProfitMode('nominal')} /> Rp
                                    </label>
                                    <label style={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                                        <input type="radio" checked={profitMode === 'percent'} onChange={() => setProfitMode('percent')} /> % (HPP)
                                    </label>
                                </div>
                            </div>
                            <input 
                                type="text" 
                                inputMode="numeric"
                                className="im-input" 
                                value={profitMode === 'nominal' ? (profitValue ? fmtRp(profitValue) : '') : profitValue} 
                                onChange={e => setProfitValue(toRawNum(e.target.value))}
                                placeholder={profitMode === 'nominal' ? "Cth: Rp25.000" : "Cth: 40"}
                                style={{ width: '100%', fontSize: '0.875rem' }} 
                            />
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-medium)' }} />

                    {/* Fees Settting */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pajak & Biaya Per Penjualan</label>
                            <select value={selectedProfileId} onChange={handleProfileChange} style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', fontSize: '0.75rem', cursor: 'pointer', outline: 'none' }}>
                                <option value="" disabled>-- Pilih Preset --</option>
                                {feeProfiles.filter(p => p.platform === platform || p.platform === 'general').map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Biaya Admin/Platf. (%)</label>
                                <input type="number" step="0.1" className="im-input" value={adminFee} onChange={e => setAdminFee(e.target.value)} style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Komisi Afiliasi (%)</label>
                                <input type="number" step="0.1" className="im-input" value={affiliateFee} onChange={e => setAffiliateFee(e.target.value)} style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Biaya Iklan (Rp) / pcs</label>
                                <input type="text" inputMode="numeric" className="im-input" value={adSpend ? fmtRp(adSpend) : ''} onChange={e => setAdSpend(toRawNum(e.target.value))} style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Target Markup Harga (%)</label>
                                <input type="number" step="1" className="im-input" value={markupPct} onChange={e => setMarkupPct(e.target.value)} style={{ width: '100%' }} title="Menentukan seberapa tinggi harga bayangan / Coret dari Harga Promo" />
                            </div>
                        </div>
                    </div>

                    {/* Result Preview Box */}
                    <div style={{ background: 'linear-gradient(145deg, #1f2937, #111827)', border: '1px solid #374151', borderRadius: 'var(--radius-lg)', padding: '1.25rem', color: '#f3f4f6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', margsainBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Saran Harga Promo</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{fmtRp(finalHargaPromo)}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Saran Harga Awal</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', textDecoration: 'line-through' }}>{fmtRp(finalHargaCoret)}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed #4b5563', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#d1d5db' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total Fee ({adminFee + affiliateFee}%):</span>
                                <span style={{ color: '#ef4444' }}>-{fmtRp(Math.round(platformDeduction + affiliateDeduction))}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Modal (HPP):</span>
                                <span style={{ color: '#ef4444' }}>-{fmtRp(hpp)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Iklan:</span>
                                <span style={{ color: '#ef4444' }}>-{fmtRp(adSpend)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#10b981' }}>
                                <span>Keuntungan Bersih:</span>
                                <span>{fmtRp(marginBersihText)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button className="btn-secondary" onClick={onClose} style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}>Batal</button>
                    <button 
                        className="btn-primary" 
                        onClick={() => {
                            onApply({ 
                                hargaPromo: finalHargaPromo, 
                                hargaCoret: finalHargaCoret 
                            });
                            onClose();
                        }}
                        style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem', display: 'flex', gap: '0.375rem', alignItems: 'center' }}
                    >
                        <Save size={16} /> Terapkan ke Produk
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PriceCalculatorModal;
