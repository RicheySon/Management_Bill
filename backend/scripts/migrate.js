/**
 * Apply trust-phase SQL migration against DATABASE_URL / local PG.
 * Usage: node scripts/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
    const migrationPath = path.join(__dirname, '../../database/migrations/2026_trust_phase.sql');
    if (!fs.existsSync(migrationPath)) {
        console.error('Migration file not found:', migrationPath);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    const pool = process.env.DATABASE_URL
        ? new Pool({
              connectionString: process.env.DATABASE_URL,
              ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
          })
        : new Pool({
              host: process.env.DATABASE_HOST || 'localhost',
              port: Number(process.env.DATABASE_PORT || 5432),
              database: process.env.DATABASE_NAME || 'municipal_revenue',
              user: process.env.DATABASE_USER || 'postgres',
              password: process.env.DATABASE_PASSWORD,
          });

    const client = await pool.connect();
    try {
        console.log('Running 2026_trust_phase migration...');
        await client.query(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
