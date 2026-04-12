const fs = require('fs');
let code = fs.readFileSync('src/components/PromoShopee.js', 'utf-8');

// Add batas_pembelian to local helpers
code = code.replace(
  /function onStokChange\(id, e\) \{\s+setLocalField\(id, 'stok_promo', e\.target\.value\.replace\(\/\[\^0-9\]\/g, ''\)\);\s+\}/,
  `function onStokChange(id, e) {
    setLocalField(id, 'stok_promo', e.target.value.replace(/[^0-9]/g, ''));
  }

  function onBatasChange(id, e) {
    setLocalField(id, 'batas_pembelian', e.target.value.replace(/[^0-9]/g, ''));
  }`
);

// Add batas_pembelian to handleSave updates
code = code.replace(
  /\.\.\.\('stok_promo' in vals \? \{ stok_promo: vals\.stok_promo !== '' \? toRawNum\(vals\.stok_promo\) : null \} : \{\}\),/,
  `...('stok_promo' in vals ? { stok_promo: vals.stok_promo !== '' ? toRawNum(vals.stok_promo) : null } : {}),
        ...('batas_pembelian' in vals ? { batas_pembelian: vals.batas_pembelian !== '' ? toRawNum(vals.batas_pembelian) : null } : {}),`
);

// Add batas_pembelian to template saving payload
code = code.replace(
  /stok_promo: localValues\[p\.id\]\?.stok_promo !== undefined \? localValues\[p\.id\]\.stok_promo : \(p\.stok_promo \|\| null\),/,
  `stok_promo: localValues[p.id]?.stok_promo !== undefined ? localValues[p.id].stok_promo : (p.stok_promo || null),
      batas_pembelian: localValues[p.id]?.batas_pembelian !== undefined ? localValues[p.id].batas_pembelian : (p.batas_pembelian || null),`
);

// Add batas_pembelian to template load payload
code = code.replace(
  /if \(item\.harga_promo != null \|\| item\.stok_promo != null\) \{\s+newLocalValues\[matchedProduct\.id\] = \{\s+harga_promo: item\.harga_promo,\s+stok_promo: item\.stok_promo\s+\};\s+\}/g,
  `if (item.harga_promo != null || item.stok_promo != null || item.batas_pembelian != null) {
            newLocalValues[matchedProduct.id] = {
              harga_promo: item.harga_promo,
              stok_promo: item.stok_promo,
              batas_pembelian: item.batas_pembelian
            };
          }`
);

// Add batas to cardBulk
code = code.replace(/\{ selections: \[\], harga: '', stok: '' \}/g, `{ selections: [], harga: '', stok: '', batas: '' }`);
code = code.replace(/if \(!bulk\.harga && bulk\.stok === ''\) return;/g, `if (!bulk.harga && bulk.stok === '' && bulk.batas === '') return;`);
code = code.replace(
  /if \(bulk\.stok !== ''\) next\.stok_promo = bulk\.stok;/,
  `if (bulk.stok !== '') next.stok_promo = bulk.stok;
        if (bulk.batas !== '') next.batas_pembelian = bulk.batas;`
);

// Add Batas Beli Input to Bulk row
code = code.replace(
  /<input type="text" placeholder="Stok" value=\{bulk\.stok \|\| ''\} onChange=\{e => setCardBulkField\(sellerSku, 'stok', e\.target\.value\.replace\(\/\[\^0-9\]\/g, ''\)\)\} style=\{\{ width: '4\.5rem' \}\} className="im-bulk-input" \/>/,
  `<input type="text" placeholder="Stok" value={bulk.stok || ''} onChange={e => setCardBulkField(sellerSku, 'stok', e.target.value.replace(/[^0-9]/g, ''))} style={{ width: '4.5rem' }} className="im-bulk-input" />
                        <input type="text" placeholder="Batas" value={bulk.batas || ''} onChange={e => setCardBulkField(sellerSku, 'batas', e.target.value.replace(/[^0-9]/g, ''))} style={{ width: '4.5rem' }} className="im-bulk-input" />`
);

// Add Batas Pembelian Input to row
code = code.replace(
  /<input\s+type="text"\s+placeholder="Stok"\s+value=\{getLocal\(r\.id, 'stok_promo'\) != null \? getLocal\(r\.id, 'stok_promo'\) : ''\}\s+onChange=\{e => onStokChange\(r\.id, e\)\}\s+className=\{classNames\('im-input', \{ 'has-value': getLocal\(r\.id, 'stok_promo'\) != null \}\)\}\s+style=\{\{ width: '4\.5rem', border: hasLocalEdit\(r\.id, 'stok_promo'\) \? '1px solid var\(--accent-primary\)' : undefined \}\}\s+\/>/,
  `<input
                                type="text"
                                placeholder="Stok"
                                value={getLocal(r.id, 'stok_promo') != null ? getLocal(r.id, 'stok_promo') : ''}
                                onChange={e => onStokChange(r.id, e)}
                                className={classNames('im-input', { 'has-value': getLocal(r.id, 'stok_promo') != null })}
                                style={{ width: '4.5rem', border: hasLocalEdit(r.id, 'stok_promo') ? '1px solid var(--accent-primary)' : undefined }}
                              />
                              <input
                                type="text"
                                placeholder="Batas"
                                value={getLocal(r.id, 'batas_pembelian') != null ? getLocal(r.id, 'batas_pembelian') : ''}
                                onChange={e => onBatasChange(r.id, e)}
                                className={classNames('im-input', { 'has-value': getLocal(r.id, 'batas_pembelian') != null })}
                                style={{ width: '4.5rem', border: hasLocalEdit(r.id, 'batas_pembelian') ? '1px solid var(--accent-primary)' : undefined }}
                              />`
);

// Remove file report text and change title
code = code.replace(/Sales Information TikTok/g, `Promo Shopee`);

// Replace applySaranHarga logic to trigger from database saran_harga instead of failMap
code = code.replace(
  /function applySaranHarga\(rows\) \{\s+rows\.forEach\(r => \{\s+const rekoPrice = extractRekoPrice\(failMap\.get\(String\(r\.sku_id\)\)\);\s+if \(rekoPrice\) setLocalField\(r\.id, 'harga_promo', fmtRp\(rekoPrice\)\);\s+\}\);\s+\}/,
  `function applySaranHarga(rows) {
    rows.forEach(r => {
      if (r.saran_harga) setLocalField(r.id, 'harga_promo', fmtRp(r.saran_harga));
    });
  }`
);

// In the row renderer, display saran_harga directly from p.saran_harga
code = code.replace(
  /\{rekoPrice && \([\s\S]*?Reko[\s\S]*?<\/button>\s*\)\}/,
  `{r.saran_harga && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLocalField(r.id, 'harga_promo', fmtRp(r.saran_harga));
                                      }}
                                      className="im-badge im-badge-reko tooltip"
                                      data-tooltip={"Shopee menyarankan harga: " + fmtRp(r.saran_harga)}
                                    >
                                      ★ Reko
                                    </button>
                                  )}`
);

// Show the "Terapkan Rekomendasi" in the row headers if ANY row has saran_harga instead of failMap
code = code.replace(
  /const hasDiscountError = groupRows\.some\(r => failMap\.get\(String\(r\.sku_id\)\)\);/,
  `const hasDiscountError = groupRows.some(r => r.saran_harga > 0);`
);

fs.writeFileSync('src/components/PromoShopee.js', code, 'utf-8');
console.log('Build PromoShopee.js Part 2 done');
