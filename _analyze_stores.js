const pool = require('./server/db');
async function analyze() {
    const [orders] = await pool.query(`SELECT u.store_id, COUNT(*) as cnt FROM orders o JOIN uploads u ON o.upload_id = u.id WHERE u.store_id IN (5, 6) GROUP BY u.store_id`);
    const [payments] = await pool.query(`SELECT u.store_id, COUNT(*) as cnt FROM payments p JOIN uploads u ON p.upload_id = u.id WHERE u.store_id IN (5, 6) GROUP BY u.store_id`);
    const [modals] = await pool.query(`SELECT store_id, COUNT(*) as cnt, SUM(value) as total FROM modal_values WHERE store_id IN (5, 6) GROUP BY store_id`);

    console.log('--- COMPARISON ---');
    console.log('Store 5 (Groovy 2025):');
    const o5 = orders.find(r => r.store_id === 5);
    const p5 = payments.find(r => r.store_id === 5);
    const m5 = modals.find(r => r.store_id === 5);
    console.log('  Orders:', o5 ? o5.cnt : 0);
    console.log('  Payments:', p5 ? p5.cnt : 0);
    console.log('  Modal entries:', m5 ? m5.cnt : 0, '- Total:', m5 ? m5.total : 0);

    console.log('Store 6 (Groovy 2024):');
    const o6 = orders.find(r => r.store_id === 6);
    const p6 = payments.find(r => r.store_id === 6);
    const m6 = modals.find(r => r.store_id === 6);
    console.log('  Orders:', o6 ? o6.cnt : 0);
    console.log('  Payments:', p6 ? p6.cnt : 0);
    console.log('  Modal entries:', m6 ? m6.cnt : 0, '- Total:', m6 ? m6.total : 0);

    // Payment coverage: how many unique order IDs appear in both orders and payments
    const [coverage] = await pool.query(`
        SELECT u.store_id,
            COUNT(DISTINCT o.order_id) as unique_orders,
            COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN o.order_id END) as orders_with_payment
        FROM orders o
        JOIN uploads u ON o.upload_id = u.id
        LEFT JOIN payments p ON p.upload_id IN (SELECT id FROM uploads WHERE store_id = u.store_id)
            AND JSON_UNQUOTE(JSON_EXTRACT(p.data, '$."Order/adjustment ID"')) = o.order_id
        WHERE u.store_id IN (5, 6)
        GROUP BY u.store_id
    `);
    // This query might be too slow, let's skip it and just show the basic counts

    process.exit(0);
}
analyze().catch(e => { console.error(e); process.exit(1); });
