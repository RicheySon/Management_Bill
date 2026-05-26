const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function run() {
    try {
        console.log('Adding gcr_number column to payments table...');
        await pool.query(`
            ALTER TABLE payments 
            ADD COLUMN IF NOT EXISTS gcr_number VARCHAR(50) DEFAULT 'N/A' NOT NULL;
        `);
        console.log('Success!');
    } catch (err) {
        console.error('Failed:', err);
    } finally {
        await pool.end();
    }
}

run();
