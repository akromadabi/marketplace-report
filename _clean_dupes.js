const pool = require('./server/db');

async function cleanDuplicates() {
    console.log('=== CLEANING DUPLICATE PAYMENTS ===\n');

    const [allRows] = await pool.query('SELECT id, upload_id, data FROM payments ORDER BY id ASC');
    console.log('Total payment rows before cleanup:', allRows.length);

    // Parse all rows and extract Order ID
    const parsed = allRows.map(row => {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const oidKey = Object.keys(data).find(k => k.trim().toLowerCase().includes('order/adjustment'));
        // For Shopee payments, use 'No. Pesanan'
        const shopeeOidKey = Object.keys(data).find(k => k.trim().toLowerCase().includes('no. pesanan'));
        const oid = oidKey ? (data[oidKey] || '').toString().trim()
            : shopeeOidKey ? (data[shopeeOidKey] || '').toString().trim()
                : '';
        return { id: row.id, upload_id: row.upload_id, oid };
    });

    // Group by Order ID and keep only the FIRST occurrence (lowest DB id)
    const seen = new Map(); // oid -> first row id
    const toDelete = [];

    for (const row of parsed) {
        if (!row.oid || row.oid === '/' || row.oid === '') continue;
        if (seen.has(row.oid)) {
            // This is a duplicate — mark for deletion
            toDelete.push(row.id);
        } else {
            seen.set(row.oid, row.id);
        }
    }

    console.log('Unique Order IDs:', seen.size);
    console.log('Duplicate rows to delete:', toDelete.length);

    if (toDelete.length > 0) {
        // Delete in batches of 1000
        for (let i = 0; i < toDelete.length; i += 1000) {
            const batch = toDelete.slice(i, i + 1000);
            await pool.query('DELETE FROM payments WHERE id IN (?)', [batch]);
            console.log(`  Deleted batch ${Math.floor(i / 1000) + 1}/${Math.ceil(toDelete.length / 1000)} (${batch.length} rows)`);
        }
        console.log('Done! Deleted', toDelete.length, 'duplicate rows');

        // Update upload row_counts
        const [remaining] = await pool.query('SELECT upload_id, COUNT(*) as cnt FROM payments GROUP BY upload_id');
        for (const r of remaining) {
            await pool.query('UPDATE uploads SET row_count = ? WHERE id = ?', [r.cnt, r.upload_id]);
        }
        console.log('Updated upload row_counts');
    }

    const [[after]] = await pool.query('SELECT COUNT(*) as total FROM payments');
    console.log('\nTotal payment rows after cleanup:', after.total);

    process.exit(0);
}

cleanDuplicates().catch(e => { console.error(e); process.exit(1); });
