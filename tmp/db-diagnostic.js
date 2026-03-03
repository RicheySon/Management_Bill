const { Pool } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- Electoral Areas ---');
        const eaRes = await pool.query('SELECT * FROM electoral_areas');
        console.table(eaRes.rows);

        console.log('\n--- Local Areas Count ---');
        const laCountRes = await pool.query('SELECT COUNT(*) FROM local_areas');
        console.log(`Total Local Areas: ${laCountRes.rows[0].count}`);

        if (eaRes.rows.length > 0) {
            const firstId = eaRes.rows[0].id;
            console.log(`\n--- Local Areas for First EA (ID: ${firstId}) ---`);
            const laRes = await pool.query('SELECT * FROM local_areas WHERE electoral_area_id = $1', [firstId]);
            console.table(laRes.rows);
        }

        console.log('\n--- Local Areas missing Electoral Area ID ---');
        const missingRes = await pool.query('SELECT COUNT(*) FROM local_areas WHERE electoral_area_id IS NULL');
        console.log(`Missing EA ID: ${missingRes.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
