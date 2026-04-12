const fs = require('fs');

let content = fs.readFileSync('src/components/PromoTiktok.js', 'utf-8');

// 1. Rename Component
content = content.replace(/function PromoTiktok/g, 'function PromoShopee');
content = content.replace(/export default PromoTiktok/g, 'export default PromoShopee');

// 2. Swaps API Imports
content = content.replace(/apiGetPromoValues,/g, 'apiGetPromoShopeeValues as apiGetPromoValues,');
content = content.replace(/apiUploadPromoProducts,/g, 'apiUploadPromoShopeeProducts as apiUploadPromoProducts,');
content = content.replace(/apiSavePromoBatch,/g, 'apiSavePromoShopeeBatch as apiSavePromoBatch,');
content = content.replace(/apiDeletePromoItems,/g, 'apiDeletePromoShopeeItems as apiDeletePromoItems,');

// Modify initial template API to handle platform='shopee' defaults where possible, but actually we use apiGetCampaignTemplates so it's fine (will rename below).

// 3. Shopee Excel Parser function
const parseShopeeStr = `
// ─── Excel: parse Sales Information Shopee ──────────────────────────────
function parseSalesInfoSheet(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    range.e.r = Math.max(range.e.r, 5000);
    ws['!ref'] = XLSX.utils.encode_range(range);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
  const headers = rows[0] || [];
  const namaIdx = headers.indexOf('Nama Produk');
  const kodeIdx = headers.indexOf('Kode Produk');
  const namaVarIdx = headers.indexOf('Nama Variasi');
  const kodeVarIdx = headers.indexOf('Kode Variasi');
  const stokIdx = headers.indexOf('Stok');
  // Kadang ada Rekomendasi di Shopee:
  const rekoIdx = headers.findIndex(h => String(h).includes('Rekomendasi'));
  
  const parsed = [];
  // Shopee data starts exactly at row 4 (index 3)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const kode = String(row[kodeIdx] || '').trim();
    if (!kode || !/^\\d+$/.test(kode)) continue;
    
    let saran = null;
    if (rekoIdx > -1 && row[rekoIdx]) {
      const num = Number(String(row[rekoIdx]).replace(/[^0-9]/g, ''));
      if (num > 0) saran = num;
    }
    
    parsed.push({
      product_id: kode,
      sku_id: String(row[kodeVarIdx] || '').trim(),
      product_name: String(row[namaIdx] || '').trim(),
      seller_sku: '', // not commonly used in shopee template line
      variation_value: String(row[namaVarIdx] || '').trim(),
      stok_saat_ini: row[stokIdx] ? Number(String(row[stokIdx]).replace(/[^0-9]/g, '')) : null,
      saran_harga: saran
    });
  }
  return parsed;
}

// ─── Replace Fail map ───
// Shopee doesn't have an error upload
// We get Saran Harga directly from the db (p.saran_harga).
`;

// Replace the parseSalesInfoSheet implementation in PromoTiktok
content = content.replace(/\/\/ ─── Excel: parse Sales Information ────────[\s\S]*?\/\/ ─── Excel: parse Fail Report ────/g, parseShopeeStr + '\n// ─── Excel: parse Fail Report ────');

// 4. Modify saving template to use 'shopee'
content = content.replace(/apiSaveCampaignTemplate\(activeStore\.id, 'tiktok'/g, `apiSaveCampaignTemplate(activeStore.id, 'shopee'`);
content = content.replace(/apiGetCampaignTemplates\(activeStore\.id, 'tiktok'\)/g, `apiGetCampaignTemplates(activeStore.id, 'shopee')`);

// 5. Excel Export logic for Shopee
const exportReplace = `
const SHOPEE_HEADER_ROW0 = ['Nama Produk','Kode Produk','Nama Variasi','Kode Variasi','Harga Diskon (Tidak Wajib)','Stok Promo (Tidak Wajib)','Harga Diskon (Wajib)','Periode Mulai','Periode Selesai','Nama Promo','Harga Diskon','Diskon (%)','Stok Saat Ini','Stok Promo','Batas Pembelian'];
const SHOPEE_HEADER_ROW1 = ['Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Tidak Wajib','Wajib','Tidak Wajib','Referensi','Wajib','Wajib'];
const SHOPEE_HEADER_ROW2 = ['','','','','','','','','','','Masukkan harga diskon produk','','','Aktifkan promo dengan mengisi stok promo','Batas pembelian per pembeli per hari, min 1'];

function exportCampaign(rows, withStock, filename) {
  const aoa = [SHOPEE_HEADER_ROW0, SHOPEE_HEADER_ROW1, SHOPEE_HEADER_ROW2];
  rows.forEach(r => {
    aoa.push([
      r.product_name || '',
      r.product_id,
      r.variation_value || '',
      r.sku_id,
      '','','','','','',
      r.harga_promo,
      '',
      r.stok_saat_ini || '',
      withStock && r.stok_promo != null ? r.stok_promo : '',
      r.batas_pembelian != null ? r.batas_pembelian : ''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'Sheet1');
  XLSX.writeFile(wb2, filename);
}
`;
content = content.replace(/\/\/ ─── Export ──────────────────────────────────────────────────────[\s\S]*?\/\/ ─── Main Component ────────────────────────────────────────────────/g, exportReplace + '\n// ─── Main Component ────────────────────────────────────────────────');

fs.writeFileSync('src/components/PromoShopee.js', content, 'utf-8');
console.log('Build PromoShopee.js done');
