const X = require('xlsx');

// Test beberapa file income yang mungkin ada
const files = [
  'TESTING SHOPEE/income_20260317001253(UTC+7).xlsx',
];

for (const file of files) {
  try {
    const wb = X.readFile(file);
    console.log(`\n=== FILE: ${file} ===`);
    console.log('Sheets:', wb.SheetNames);
    
    // Check first sheet header row
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    console.log('Row 0 (headers):', JSON.stringify(rows[0]));
    console.log('Row 1 (data):', JSON.stringify(rows[1]));
    
    // Check what detectPlatformAndCategory would return
    const headers = rows[0].map(h => String(h).toString().trim().toLowerCase());
    const tiktokPaymentsHeaders = ["order/adjustment id", "total settlement amount", "total revenue", "subtotal after seller discounts", "customer payment"];
    const tiktokPaymentsFlexHeaders = ["order created time", "order settled time"];
    const hasTiktokPayments = tiktokPaymentsHeaders.every(h => headers.some(fh => fh.trim().startsWith(h.trim())));
    const hasFlex = tiktokPaymentsFlexHeaders.every(prefix => headers.some(h => h.trim().startsWith(prefix)));
    
    console.log('Has TikTok payments headers:', hasTiktokPayments);
    console.log('Has flex headers:', hasFlex);
    console.log('Has Income sheet:', wb.SheetNames.includes('Income'));
    console.log('Would detect as Shopee payments (Income sheet):', wb.SheetNames.includes('Income'));
    console.log('Would detect as TikTok payments:', hasTiktokPayments && hasFlex);
    console.log('');
    console.log('All headers (normalized):', headers);
  } catch(e) {
    console.log('Error:', e.message);
  }
}
