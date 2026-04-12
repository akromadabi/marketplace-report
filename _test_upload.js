const fs = require('fs');
const X = require('xlsx');

async function run() {
  console.log('Reading excel...');
  const wb = X.readFile('TESTING SHOPEE/Semua pesanan-2025-12-30-20_19.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  console.log('Parsing JSON...');
  let jsonData = X.utils.sheet_to_json(ws, { defval: "" });
  
  // tiktok: strip first row if orders
  jsonData = jsonData.slice(1);

  const chunk = jsonData.slice(0, 500);
  console.log('Chunk length:', chunk.length);

  const payload = {
    user_id: 1, // dummy
    store_id: 2, // dummy
    files_data: [
      {
        filename: "test.xlsx",
        platform: "tiktok",
        category: "orders",
        jsonData: chunk
      }
    ]
  };

  console.log('Sending payload size:', JSON.stringify(payload).length, 'bytes');

  try {
    const res = await fetch('http://127.0.0.1:8000/api/upload/parsed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}

run();
