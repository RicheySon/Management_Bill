const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    console.log('Connecting to:', process.env.DATABASE_URL ? 'URL found' : 'URL NOT FOUND');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- Electoral Areas ---');
        const eaRes = await pool.query('SELECT id, name FROM electoral_areas ORDER BY name');
        console.table(eaRes.rows);

        console.log('\n--- Local Areas Count per Electoral Area ---');
        const laCountRes = await pool.query(`
            SELECT ea.name as electoral_area, COUNT(la.id) as local_area_count
            FROM electoral_areas ea
            LEFT JOIN local_areas la ON ea.id = la.electoral_area_id
            GROUP BY ea.id, ea.name
            ORDER BY ea.name
        `);
        console.table(laCountRes.rows);

        console.log('\n--- Sample Local Areas ---');
        const sampleRes = await pool.query('SELECT id, name, electoral_area_id FROM local_areas LIMIT 5');
        console.table(sampleRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

run();
