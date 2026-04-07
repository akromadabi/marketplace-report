const X = require('xlsx');
const wb = X.readFile('TESTING SHOPEE/Tiktoksellercenter_batchedit_20260403_sales_information_template.xlsx', { sheetStubs: true });
const ws = wb.Sheets['Template'];
// Check actual cell range
console.log('Cell Range:', ws['!ref']);
// Try reading with different options
const rows = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true });
console.log('Rows with blanks:', rows.length);
// Print rows 0-7 column 0 raw value
for (let i = 0; i <= 7; i++) {
  const r = rows[i] || [];
  const nonEmpty = r.filter(c => String(c).trim()).length;
  console.log('Row', i, '- non-empty cols:', nonEmpty, '| col0:', JSON.stringify(String(r[0]).slice(0, 30)), '| col3:', JSON.stringify(String(r[3]).slice(0, 30)));
}
