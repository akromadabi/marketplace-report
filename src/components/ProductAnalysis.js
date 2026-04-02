import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useProcessedOrders } from '../hooks/useProcessedOrders';

function ProductAnalysis() {
  const { rangkumanData, loading: isLoading } = useProcessedOrders();

  function parseQuantity(q) {
    if (typeof q === "number") return q;
    if (typeof q === "string") { const n = parseInt(q.replace(/\D/g, ""), 10); return isNaN(n) ? 0 : n; }
    return 0;
  }

  // Aggregate per SKU from rangkumanData (rekap transaksi)
  const skuAggregated = useMemo(() => {
    const map = new Map();

    rangkumanData.forEach((row) => {
      const statusOrder = (row.statusOrder || '').toLowerCase();
      const isReturn = statusOrder === 'return';
      const isAffiliated = row.totalAffiliateCommission < 0;
      const settlement = row.totalSettlementAmount || 0;

      // Each rangkumanData row has `orders` — the raw line items for that order
      const lineItems = row.orders || [];

      lineItems.forEach((order) => {
        const sku = (order["Seller SKU"] || "").toString().trim();
        if (!sku) return;
        const quantity = parseQuantity(order["Quantity"]);
        const variation = (order["Variation"] || "").toString().trim() || "(No Variation)";
        const skuId = (order["SKU ID"] || "").toString().trim();

        // Calculate per-item settlement share (split proportionally by qty)
        const totalQtyInOrder = row.totalQuantity || 1;
        const itemSettlement = (settlement / totalQtyInOrder) * quantity;

        if (!map.has(sku)) {
          map.set(sku, {
            sku, productName: order["Product Name"] || "",
            totalQuantity: 0, totalReturn: 0,
            totalNilaiJual: 0, totalNilaiJualAFF: 0,
            countNilaiJual: 0, countNilaiJualAFF: 0,
            variations: new Map(),
          });
        }
        const skuData = map.get(sku);
        skuData.totalQuantity += quantity;

        // Return = order with statusOrder 'return'
        if (isReturn) {
          skuData.totalReturn += quantity;
        }

        // Nilai Jual: settlement per item, non-affiliasi only
        if (settlement > 0 && !isAffiliated && !isReturn) {
          skuData.totalNilaiJual += itemSettlement;
          skuData.countNilaiJual += quantity;
        }

        // Nilai Jual AFF: settlement per item, affiliasi only
        if (settlement > 0 && isAffiliated && !isReturn) {
          skuData.totalNilaiJualAFF += itemSettlement;
          skuData.countNilaiJualAFF += quantity;
        }

        // Variation level
        if (!skuData.variations.has(variation)) {
          skuData.variations.set(variation, {
            variation, productName: order["Product Name"] || "",
            totalQuantity: 0, totalReturn: 0, skuId,
            totalNilaiJual: 0, totalNilaiJualAFF: 0,
            countNilaiJual: 0, countNilaiJualAFF: 0,
          });
        }
        const varData = skuData.variations.get(variation);
        varData.totalQuantity += quantity;
        if (isReturn) varData.totalReturn += quantity;
        if (settlement > 0 && !isAffiliated && !isReturn) {
          varData.totalNilaiJual += itemSettlement;
          varData.countNilaiJual += quantity;
        }
        if (settlement > 0 && isAffiliated && !isReturn) {
          varData.totalNilaiJualAFF += itemSettlement;
          varData.countNilaiJualAFF += quantity;
        }
      });
    });

    const arr = Array.from(map.values());
    arr.forEach((skuObj) => {
      // Average nilai jual per unit
      skuObj.totalNilaiJual = skuObj.countNilaiJual > 0 ? skuObj.totalNilaiJual / skuObj.countNilaiJual : 0;
      skuObj.totalNilaiJualAFF = skuObj.countNilaiJualAFF > 0 ? skuObj.totalNilaiJualAFF / skuObj.countNilaiJualAFF : 0;
      skuObj.variations.forEach((varObj) => {
        varObj.totalNilaiJual = varObj.countNilaiJual > 0 ? varObj.totalNilaiJual / varObj.countNilaiJual : 0;
        varObj.totalNilaiJualAFF = varObj.countNilaiJualAFF > 0 ? varObj.totalNilaiJualAFF / varObj.countNilaiJualAFF : 0;
      });
    });
    arr.sort((a, b) => b.totalQuantity - a.totalQuantity);
    return arr;
  }, [rangkumanData]);

  const [expandedSkus, setExpandedSkus] = useState(new Set());
  const [variationSorts, setVariationSorts] = useState({});

  function toggleSku(sku) {
    setExpandedSkus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) newSet.delete(sku); else newSet.add(sku);
      return newSet;
    });
  }

  const columns = ["SKU Produk", "Total Quantity Terjual", "Presentase", "Total Return", "Presentase Return", "Nilai Jual", "Nilai Jual AFF"];
  const variationColumns = ["Variation", "ID Produk", "Total Quantity Terjual", "Presentase", "Total Return", "Presentase Return", "Nilai Jual", "Nilai Jual AFF"];

  const totalQuantityAllSkus = useMemo(() => skuAggregated.reduce((sum, skuObj) => sum + skuObj.totalQuantity, 0), [skuAggregated]);

  function sortVariations(variationsArray, sortConfig) {
    if (!sortConfig || !sortConfig.column) return variationsArray;
    const { column, direction } = sortConfig;
    const sorted = [...variationsArray];
    sorted.sort((a, b) => {
      let aVal, bVal;
      switch (column) {
        case "Variation": aVal = a.variation.toLowerCase(); bVal = b.variation.toLowerCase(); if (aVal < bVal) return direction === "asc" ? -1 : 1; if (aVal > bVal) return direction === "asc" ? 1 : -1; return 0;
        case "ID Produk": aVal = a.skuId.toLowerCase(); bVal = b.skuId.toLowerCase(); if (aVal < bVal) return direction === "asc" ? -1 : 1; if (aVal > bVal) return direction === "asc" ? 1 : -1; return 0;
        case "Total Quantity Terjual": return direction === "asc" ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity;
        case "Presentase": { const total = variationsArray.reduce((sum, v) => sum + v.totalQuantity, 0); aVal = total > 0 ? (a.totalQuantity / total) * 100 : 0; bVal = total > 0 ? (b.totalQuantity / total) * 100 : 0; return direction === "asc" ? aVal - bVal : bVal - aVal; }
        case "Total Return": return direction === "asc" ? a.totalReturn - b.totalReturn : b.totalReturn - a.totalReturn;
        case "Presentase Return": aVal = a.totalQuantity > 0 ? (a.totalReturn / a.totalQuantity) * 100 : 0; bVal = b.totalQuantity > 0 ? (b.totalReturn / b.totalQuantity) * 100 : 0; return direction === "asc" ? aVal - bVal : bVal - aVal;
        case "Nilai Jual": return direction === "asc" ? a.totalNilaiJual - b.totalNilaiJual : b.totalNilaiJual - a.totalNilaiJual;
        case "Nilai Jual AFF": return direction === "asc" ? a.totalNilaiJualAFF - b.totalNilaiJualAFF : b.totalNilaiJualAFF - a.totalNilaiJualAFF;
        default: return 0;
      }
    });
    return sorted;
  }

  function handleVariationSortClick(sku, column) {
    setVariationSorts((prev) => {
      const currentSort = prev[sku];
      if (currentSort && currentSort.column === column) {
        return { ...prev, [sku]: { column, direction: currentSort.direction === "asc" ? "desc" : "asc" } };
      }
      return { ...prev, [sku]: { column, direction: "asc" } };
    });
  }

  function VarSortIcon({ sku, column }) {
    const sort = variationSorts[sku];
    const size = 12;
    if (!sort || sort.column !== column) return <ArrowUpDown size={size} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sort.direction === "asc"
      ? <ChevronUp size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />
      : <ChevronDown size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
  }

  function formatRupiah(number) {
    if (typeof number !== "number" || isNaN(number)) return "";
    return "Rp" + number.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={24} style={{ color: '#7c3aed' }} />
          Produk Analisis
        </h2>
        <p>{skuAggregated.length} SKU • {totalQuantityAllSkus.toLocaleString('id-ID')} total terjual</p>
      </div>

      <div className="modern-table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '3rem' }}>No</th>
                {columns.map((col) => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} style={{ animation: `fadeInUp 0.3s ease ${i * 60}ms both` }}>
                    <td><div className="skeleton" style={{ height: '1rem', width: '1.5rem' }}>&nbsp;</div></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="skeleton" style={{ width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0 }}>&nbsp;</div>
                        <div style={{ flex: 1 }}>
                          <div className="skeleton" style={{ height: '0.875rem', width: `${50 + Math.random() * 30}%`, marginBottom: '0.375rem' }}>&nbsp;</div>
                          <div className="skeleton" style={{ height: '0.625rem', width: '40%' }}>&nbsp;</div>
                        </div>
                      </div>
                    </td>
                    {columns.slice(1).map((col) => (
                      <td key={col}><div className="skeleton" style={{ height: '1rem', width: `${40 + Math.random() * 40}%`, margin: '0 auto' }}>&nbsp;</div></td>
                    ))}
                  </tr>
                ))
              ) : skuAggregated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                    Tidak ada data untuk ditampilkan.
                  </td>
                </tr>
              ) : (
                skuAggregated.map((skuObj, i) => {
                  const isExpanded = expandedSkus.has(skuObj.sku);
                  const percentage = totalQuantityAllSkus > 0 ? (skuObj.totalQuantity / totalQuantityAllSkus) * 100 : 0;
                  const returnPercentage = skuObj.totalQuantity > 0 ? (skuObj.totalReturn / skuObj.totalQuantity) * 100 : 0;

                  return (
                    <React.Fragment key={skuObj.sku}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggleSku(skuObj.sku)}>
                        <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '2rem', height: '2rem', borderRadius: '50%',
                              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                            }}>
                              {skuObj.sku.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontWeight: 700, color: '#a78bfa' }}>{skuObj.sku}</span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                                Klik untuk detail variasi
                              </span>
                            </div>
                            <div style={{ marginLeft: 'auto', color: '#a78bfa' }}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{skuObj.totalQuantity}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{percentage.toFixed(2)}%</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: skuObj.totalReturn > 0 ? '#fbbf24' : 'var(--text-primary)' }}>{skuObj.totalReturn}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: returnPercentage > 5 ? '#f87171' : 'var(--text-primary)' }}>{returnPercentage.toFixed(2)}%</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatRupiah(skuObj.totalNilaiJual)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatRupiah(skuObj.totalNilaiJualAFF)}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={columns.length + 1} style={{ padding: 0, background: 'rgba(124, 58, 237, 0.05)' }}>
                            <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(167, 139, 250, 0.2)' }}>
                              <table className="modern-table" style={{ margin: 0, borderRadius: 0 }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '3rem' }}>No</th>
                                    {variationColumns.map((col) => (
                                      <th key={col} onClick={() => handleVariationSortClick(skuObj.sku, col)} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span>{col}</span>
                                          <VarSortIcon sku={skuObj.sku} column={col} />
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const sortedVariations = sortVariations(Array.from(skuObj.variations.values()), variationSorts[skuObj.sku]);
                                    if (sortedVariations.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={variationColumns.length + 1} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-tertiary)' }}>
                                            Tidak ada variasi.
                                          </td>
                                        </tr>
                                      );
                                    }
                                    const totalQuantityVariations = sortedVariations.reduce((sum, v) => sum + v.totalQuantity, 0);
                                    return sortedVariations.map((varObj, idx) => {
                                      const varPercentage = totalQuantityVariations > 0 ? (varObj.totalQuantity / totalQuantityVariations) * 100 : 0;
                                      const varReturnPercentage = varObj.totalQuantity > 0 ? (varObj.totalReturn / varObj.totalQuantity) * 100 : 0;
                                      return (
                                        <tr key={varObj.variation}>
                                          <td style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{idx + 1}</td>
                                          <td style={{ fontSize: '0.75rem' }} title={varObj.variation}>{varObj.variation}</td>
                                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} title={varObj.skuId}>{varObj.skuId}</td>
                                          <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{varObj.totalQuantity}</td>
                                          <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{varPercentage.toFixed(2)}%</td>
                                          <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: varObj.totalReturn > 0 ? '#fbbf24' : 'var(--text-primary)' }}>{varObj.totalReturn}</td>
                                          <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: varReturnPercentage > 5 ? '#f87171' : 'var(--text-primary)' }}>{varReturnPercentage.toFixed(2)}%</td>
                                          <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{formatRupiah(varObj.totalNilaiJual)}</td>
                                          <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem' }}>{formatRupiah(varObj.totalNilaiJualAFF)}</td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductAnalysis;