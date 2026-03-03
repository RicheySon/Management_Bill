const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const mapping = {
    'OFANKOR NORTH': ['Ofankor Barrier', 'Ahenbronum', 'Spot M'],
    'OFANKOR SOUTH': ['South Ofankor', 'Police Station Area', 'Market Area'],
    'AMAMORLEY': ['Amamoley Township', 'New Amamoley', 'Abease'],
    'AMANFROM': ['Amanfrom', 'Peace Village', 'John Teye'],
    'POKUASE': ['Pokuase Township', 'ACP Estates', 'Guinness Depot'],
    'TANTRA': ['Tantra Hill', 'St. Johns', 'Kingsby'],
    'ASOFAN': ['Asofan Township', 'Asofan Estate', 'Pipeline'],
    'FISE': ['Fise Township', 'Hebron', 'Kuotam'],
    'AYAWASO': ['Ayawaso', 'Nii Ankraman', 'Ga Odumase'],
    'OMANJOR': ['Omanjor', 'Dwenewoho', 'Sowutuom Border'],
    'AFIAMAN': ['Afiaman', 'Mayera', 'Manhean'],
    'TROBU': ['Trobu', 'Mile 7', 'Antieku'],
    'ABENSU': ['Abensu', 'Abesey', 'New Pokuase']
};

async function seed() {
    try {
        const eaRes = await pool.query('SELECT id, name FROM electoral_areas');
        const eaMap = {};
        eaRes.rows.forEach(r => eaMap[r.name] = r.id);

        console.log('Clearing existing local_areas...');
        await pool.query('DELETE FROM local_areas');

        for (const [eaName, locals] of Object.entries(mapping)) {
            const eaId = eaMap[eaName];
            if (eaId) {
                for (const localName of locals) {
                    await pool.query('INSERT INTO local_areas (name, electoral_area_id) VALUES ($1, $2)', [localName, eaId]);
                    console.log(`Linked ${localName} to ${eaName}`);
                }
            } else {
                console.warn(`EA ${eaName} not found in database`);
            }
        }
        console.log('Seeding complete successfully!');
    } catch (err) {
        console.error('Seeding failed:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
