/**
 * Apply SQL migrations against DATABASE_URL / local PG.
 * Usage: node scripts/migrate.js [migration-file-name]
 * Default: runs all *.sql files in database/migrations in sorted order.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.error('Migrations directory not found:', migrationsDir);
        process.exit(1);
    }

    const requested = process.argv[2];
    const files = requested
        ? [requested.endsWith('.sql') ? requested : `${requested}.sql`]
        : fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

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
        for (const file of files) {
            const migrationPath = path.join(migrationsDir, file);
            if (!fs.existsSync(migrationPath)) {
                console.error('Migration file not found:', migrationPath);
                process.exitCode = 1;
                return;
            }
            const sql = fs.readFileSync(migrationPath, 'utf8');
            console.log(`Running ${file}...`);
            await client.query(sql);
            console.log(`✓ ${file} completed`);
        }
        console.log('All migrations completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
