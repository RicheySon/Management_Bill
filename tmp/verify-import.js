const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres.lstlwurlordqjctykxyl:Ga_N0rth2026@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
    ssl: { rejectUnauthorized: false },
});

async function check() {
    try {
        const res = await pool.query('SELECT id, year, name, status FROM fee_schedules WHERE year = 2026 ORDER BY created_at DESC');
        console.log('2026 Schedules:', JSON.stringify(res.rows, null, 2));

        const zones = await pool.query('SELECT COUNT(*) FROM property_rate_zones WHERE fee_schedule_id = $1', [res.rows[0]?.id]);
        const items = await pool.query('SELECT COUNT(*) FROM business_fee_items WHERE fee_schedule_id = $1', [res.rows[0]?.id]);

        console.log(`Zones count for ID ${res.rows[0]?.id}:`, zones.rows[0].count);
        console.log(`Items count for ID ${res.rows[0]?.id}:`, items.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
