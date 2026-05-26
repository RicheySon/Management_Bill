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
        console.log('Creating user_electoral_areas table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_electoral_areas (
                user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
                electoral_area_id INTEGER REFERENCES electoral_areas(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, electoral_area_id)
            );
        `);
        console.log('Success!');
    } catch (err) {
        console.error('Failed:', err);
    } finally {
        await pool.end();
    }
}

run();
