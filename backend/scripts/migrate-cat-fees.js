const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: Adding CAT fee columns to property_rate_zones...');

        await client.query('BEGIN');

        // Add CAT A-D columns if they don't exist
        await client.query(`
      ALTER TABLE property_rate_zones 
      ADD COLUMN IF NOT EXISTS cat_a_fee DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS cat_b_fee DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS cat_c_fee DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS cat_d_fee DECIMAL(10,2)
    `);

        // Migrate existing minimum_rate_min to cat_a_fee if it's empty
        await client.query(`
      UPDATE property_rate_zones 
      SET cat_a_fee = minimum_rate_min 
      WHERE cat_a_fee IS NULL
    `);

        await client.query('COMMIT');
        console.log('Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.log('Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
