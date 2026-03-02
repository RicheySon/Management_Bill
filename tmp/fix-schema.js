const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres.lstlwurlordqjctykxyl:Ga_N0rth2026@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
    ssl: { rejectUnauthorized: false },
});

async function run() {
    try {
        console.log('--- ALTERING SCHEMA FOR 2026 RESOLUTIONS ---');

        await pool.query('ALTER TABLE property_rate_zones ALTER COLUMN zone_name TYPE VARCHAR(500)');
        console.log('Updated property_rate_zones.zone_name to VARCHAR(500)');

        await pool.query('ALTER TABLE businesses ALTER COLUMN business_category_class TYPE VARCHAR(255)');
        console.log('Updated businesses.business_category_class to VARCHAR(255)');

        await pool.query('ALTER TABLE business_fee_items ALTER COLUMN frequency TYPE VARCHAR(255)');
        console.log('Updated business_fee_items.frequency to VARCHAR(255)');

        console.log('--- SCHEMA UPDATED SUCCESSFULLY ---');
        process.exit(0);
    } catch (err) {
        console.error('SCHEMA UPDATE FAILED:', err);
        process.exit(1);
    }
}

run();
