const pool = require('./server/db');
const fs = require('fs');

async function check() {
    const output = [];
    const log = (...args) => { const line = args.join(' '); console.log(line); output.push(line); };

    const [allRows] = await pool.query('SELECT id, upload_id, content_hash, data FROM payments');
    log('Total payment rows:', allRows.length);

    // Parse all data
    const parsed = allRows.map(row => {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        // Find order ID key dynamically
        const oidKey = Object.keys(data).find(k => k.trim().toLowerCase().includes('order/adjustment'));
        const settleKey = Object.keys(data).find(k => k.trim().toLowerCase().includes('total settlement'));
        const oid = oidKey ? (data[oidKey] || '').toString().trim() : '';
        const settlement = settleKey ? parseFloat(data[settleKey]) || 0 : 0;
        return { id: row.id, upload_id: row.upload_id, hash: row.content_hash, oid, settlement, data };
    });

    // Group by Order ID
    const byOid = new Map();
    for (const r of parsed) {
        if (!r.oid || r.oid === '/') continue;
        if (!byOid.has(r.oid)) byOid.set(r.oid, []);
        byOid.get(r.oid).push(r);
    }

    // Find cross-upload duplicates (same order ID in different uploads)
    let crossUploadDups = 0;
    let totalExtraRows = 0;
    const examples = [];
    for (const [oid, rows] of byOid) {
        const uploads = new Set(rows.map(r => r.upload_id));
        if (uploads.size > 1) {
            crossUploadDups++;
            // Check if same settlement amount appears in multiple uploads
            const byUpload = {};
            for (const r of rows) {
                if (!byUpload[r.upload_id]) byUpload[r.upload_id] = [];
                byUpload[r.upload_id].push(r);
            }
            // Count extra rows (rows in later uploads that duplicate earlier ones)
            const allSettlements = rows.map(r => r.settlement);
            const uploadIds = [...uploads].sort((a, b) => a - b);
            const firstUploadRows = rows.filter(r => r.upload_id === uploadIds[0]);
            const laterRows = rows.filter(r => r.upload_id !== uploadIds[0]);
            // Each later row with same settlement as a first-upload row is a duplicate
            for (const later of laterRows) {
                const matchInFirst = firstUploadRows.find(f => f.settlement === later.settlement);
                if (matchInFirst) totalExtraRows++;
            }
            if (examples.length < 5) {
                examples.push({ oid, rows: rows.map(r => ({ id: r.id, upload: r.upload_id, settlement: r.settlement, hash: r.hash })) });
            }
        }
    }

    log('\nOrder IDs appearing in multiple uploads:', crossUploadDups);
    log('Estimated extra (duplicate) rows:', totalExtraRows);

    log('\nExamples:');
    for (const ex of examples) {
        log(`  OrderID: ${ex.oid}`);
        ex.rows.forEach(r => log(`    db_id:${r.id} upload:${r.upload} settlement:${r.settlement} hash:${r.hash}`));
    }

    // Check upload file overlap
    const [uploads] = await pool.query(
        `SELECT id, filename, platform, row_count, COALESCE(skipped_rows,0) as skipped, created_at
         FROM uploads WHERE category = 'payments' ORDER BY created_at ASC`
    );
    log('\nAll payment uploads (chronological):');
    uploads.forEach(u => log(`  [${u.id}] ${u.filename} | ${u.row_count} rows | ${u.skipped} skipped | ${u.created_at}`));

    // Check how many rows each upload contributes
    const uploadRowCounts = {};
    for (const r of parsed) {
        if (!uploadRowCounts[r.upload_id]) uploadRowCounts[r.upload_id] = 0;
        uploadRowCounts[r.upload_id]++;
    }

    // Check if hashes differ for same order ID rows
    let sameOidDiffHash = 0;
    for (const [oid, rows] of byOid) {
        if (rows.length > 1) {
            const hashes = new Set(rows.map(r => r.hash));
            if (hashes.size > 1) sameOidDiffHash++;
        }
    }
    log('\nOrder IDs with different content_hash across rows:', sameOidDiffHash);
    log('(This is expected if rows have different data like adjustments)');

    // Check if same order appears with SAME settlement in different uploads
    let trueDuplicateOrders = 0;
    for (const [oid, rows] of byOid) {
        const uploads = new Set(rows.map(r => r.upload_id));
        if (uploads.size <= 1) continue;
        // Group by settlement amount
        const bySettlement = {};
        for (const r of rows) {
            const key = r.settlement.toString();
            if (!bySettlement[key]) bySettlement[key] = new Set();
            bySettlement[key].add(r.upload_id);
        }
        // If same settlement appears in >1 upload, it's a true duplicate
        for (const [, upls] of Object.entries(bySettlement)) {
            if (upls.size > 1) { trueDuplicateOrders++; break; }
        }
    }
    log('\nTrue duplicate orders (same OrderID + same settlement in different uploads):', trueDuplicateOrders);

    fs.writeFileSync('_dupes_report.txt', output.join('\n'));
    log('\nReport saved to _dupes_report.txt');

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
