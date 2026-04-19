const XLSX = require('xlsx');

const wsData = [
  ['Nama Produk', 'Kode Produk', 'Nama Variasi', 'Kode Variasi', 'Rekomendasi Harga Diskon', 'Stok', 'Batas Pembelian', 'Alasan Gagal'],
  ['Opsional', 'Wajib', 'Opsional', 'Wajib', 'Opsional', 'Opsional', 'Wajib', 'Perlu Dihapus'],
  ['Nama Produk...', 'Mohon masukkan...', 'Nama variasi...', 'Kode Kriteria...', 'Harga diskon...', 'Stok ini...', 'Mohon masukkan...', 'Harap periksa...'],
  ['Celana', '21293754419', 'Dusty Pink', '270552921919', '63800', '992', '5', 'Gagal mengupload produk karena Harga Diskon Sebelum Pajak <= 62000']
];

const ws = XLSX.utils.aoa_to_sheet(wsData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

function parseFailReport(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(cell => {
      const c = String(cell).toLowerCase();
      return c.includes('sku id') || c.includes('sku_id') || c.includes('kode variasi');
    })) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return new Map();

  const headerRow = rows[headerIdx].map(h => String(h).trim());
  const dataRows = rows.slice(headerIdx + 1);
  const map = new Map();
  dataRows.forEach(r => {
    const obj = {};
    headerRow.forEach((k, i) => { obj[k] = r[i] ?? ''; });
    
    const skuId = String(obj['Kode Variasi'] || obj['SKU ID'] || obj['sku_id'] || obj['sku id'] || '').trim();
    if (!skuId || skuId.toLowerCase() === 'wajib' || skuId.toLowerCase() === 'opsional' || skuId.toLowerCase().includes('memenuhi kriteria')) return;

    let reason = String(obj['Alasan Gagal'] || obj['Reason'] || obj['reason'] || obj['Fail Reason'] || '').trim();
    const reko = String(obj['Rekomendasi Harga Diskon'] || '').trim();
    
    if (reko && !reason.includes('Saran harga:')) {
      reason += (reason ? ' | ' : '') + `Saran harga: Rp${reko}`;
    }

    if (skuId && reason) map.set(skuId, reason);
  });
  return map;
}

const result = parseFailReport(wb);
console.log('Result size:', result.size);
console.log('Result entries:', Array.from(result.entries()));
