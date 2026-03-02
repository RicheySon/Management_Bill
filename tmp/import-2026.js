const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// Supabase connection from .env
const pool = new Pool({
    connectionString: "postgresql://postgres.lstlwurlordqjctykxyl:Ga_N0rth2026@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
    ssl: { rejectUnauthorized: false },
});

function cleanNumber(val) {
    if (val === null || val === undefined || val === '') return undefined;
    const str = String(val).replace(/,/g, '').replace(/\n/g, '').replace(/\s/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
}

function detectZoneType(zoneName) {
    const lower = zoneName.toLowerCase();
    if (lower.includes('industrial')) return 'INDUSTRIAL';
    if (lower.includes('commercial')) return 'COMMERCIAL';
    if (lower.includes('mixed')) return 'MIXED_USE';
    return 'RESIDENTIAL';
}

function detectZoneClass(zoneName) {
    const match = zoneName.match(/(\d+)(?:st|nd|rd|th)/i);
    if (match) return parseInt(match[1]);
    return 1;
}

function findFrequency(row) {
    const freqKeywords = ['per annum', 'per month', 'per day', 'per event', 'per trip', 'per load', 'per item', 'per week', 'annual', 'per visit', 'per animal', 'per offe', 'per message', 'per unit', 'per year'];
    for (const cell of row) {
        const str = String(cell || '').toLowerCase().trim();
        if (freqKeywords.some(kw => str.includes(kw))) {
            return String(cell).trim();
        }
    }
    return undefined;
}

function extractFees(row) {
    const fees = [];
    for (let c = 1; c < row.length; c++) {
        const n = cleanNumber(row[c]);
        if (n !== undefined && n > 0) {
            const str = String(row[c]).toLowerCase();
            // Blacklist some common false positives
            if (['per', 'annum', 'month', 'year', 'visit', 'offence', 'animal', 'message', 'meter', 'foot'].some(k => str.includes(k))) continue;
            if (n === 2026 || n === 2025) continue;
            fees.push(n);
        }
    }
    if (fees.length === 0) return {};
    const result = {};
    const cats = ['cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee'];
    for (let i = 0; i < Math.min(fees.length, 6); i++) {
        result[cats[i]] = fees[i];
    }
    return result;
}

function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const propertyZones = [];
    const businessItems = [];

    workbook.SheetNames.forEach((sheetName, sheetIdx) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        let currentSection = (sheetIdx === 0) ? 'PROPERTY' : 'UNKNOWN';
        let sectionLocked = sheetName.toLowerCase().includes('table');
        if (sectionLocked) currentSection = 'BUSINESS';

        let currentMainItemNumber = 0;
        let currentMainDescription = '';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');

            // Section Detection
            if (!sectionLocked) {
                if (rowStr.includes('rating zone') || rowStr.includes('property rates')) {
                    currentSection = 'PROPERTY';
                }
                if (rowStr.includes('main item') || rowStr.includes('business licence')) {
                    currentSection = 'BUSINESS';
                    sectionLocked = true;
                    continue;
                }
            }

            const fees = extractFees(row);
            const hasFees = Object.keys(fees).length > 0;
            const desc = String(row[0] || '').trim();

            if (desc && desc.length > 2 && !desc.toLowerCase().includes('page') && !desc.toLowerCase().includes('municipal')) {
                // Property Detection 2.0
                const col1 = String(row[1] || '').toLowerCase().trim();
                const col2 = String(row[2] || '').toLowerCase().trim();
                const isZoneHeader = col1.includes('1st') || col2.includes('1st') || col1.includes('2nd') || col2.includes('2nd') || col1.includes('3rd') || col2.includes('3rd');

                if (currentSection === 'PROPERTY' || isZoneHeader) {
                    const vals = Object.values(fees);
                    if (vals.length > 0) {
                        propertyZones.push({
                            zone_name: desc,
                            zone_type: detectZoneType(desc),
                            zone_class: detectZoneClass(desc),
                            rate_impost_min: vals.find(v => v < 1) || 0,
                            minimum_rate_min: vals.find(v => v >= 1) || 0
                        });
                        currentSection = 'PROPERTY';
                        continue;
                    }
                }

                // Business logic
                const mainItemNum = parseInt(String(row[0]).trim());
                if (!isNaN(mainItemNum) && mainItemNum > 0) {
                    currentMainItemNumber = mainItemNum;
                    currentMainDescription = String(row[2] || row[1] || '').trim();
                }

                if (hasFees || currentMainItemNumber > 0) {
                    businessItems.push({
                        main_item_number: currentMainItemNumber || 999,
                        sub_item_code: String(row[1] || '').substring(0, 10),
                        description: desc,
                        parent_description: currentMainDescription !== desc ? currentMainDescription : undefined,
                        is_group_header: !hasFees,
                        frequency: findFrequency(row),
                        ...fees
                    });
                    if (currentSection === 'UNKNOWN') currentSection = 'BUSINESS';
                }
            }
        }
    });
    return { propertyZones, businessItems };
}

async function run() {
    const filePath = 'C:\\\\Users\\\\RICHEY_SON\\\\Desktop\\\\Management_Bill\\\\2026 FEE FIXING RESOLUTIONS OF GA NORTH -pdf.xlsx';
    try {
        console.log('--- STARTING CLEAN 2026 FEE IMPORT ---');
        const buffer = fs.readFileSync(filePath);
        const parsedData = parseExcel(buffer);
        console.log(`Parsed ${parsedData.propertyZones.length} Property Zones, ${parsedData.businessItems.length} Business Items`);

        const year = 2026;
        console.log('Cleaning up existing 2026 schedules...');
        await pool.query('DELETE FROM fee_schedules WHERE year = $1', [year]);

        const ins = await pool.query('INSERT INTO fee_schedules (year, name, effective_date, notes) VALUES ($1, $2, $3, $4) RETURNING id', [year, '2026 FEE FIXING RESOLUTIONS OF GA NORTH', '2026-01-01', 'Imported from Excel']);
        const scheduleId = ins.rows[0].id;
        console.log(`Created new schedule ID: ${scheduleId}`);

        await pool.query('BEGIN');
        for (let i = 0; i < parsedData.propertyZones.length; i++) {
            const z = parsedData.propertyZones[i];
            await pool.query('INSERT INTO property_rate_zones (fee_schedule_id, zone_name, zone_type, zone_class, rate_impost_min, minimum_rate_min, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [scheduleId, z.zone_name, z.zone_type, z.zone_class, z.rate_impost_min, z.minimum_rate_min, i]);
        }
        console.log(`Inserted ${parsedData.propertyZones.length} property zones`);

        const parentIdMap = {};
        for (let i = 0; i < parsedData.businessItems.length; i++) {
            const item = parsedData.businessItems[i];
            if (!item.is_group_header) continue;
            const pins = await pool.query('INSERT INTO business_fee_items (fee_schedule_id, main_item_number, sub_item_code, description, frequency, is_group_header, sort_order) VALUES ($1, $2, $3, $4, $5, TRUE, $6) RETURNING id', [scheduleId, item.main_item_number, item.sub_item_code || null, item.description, item.frequency || null, i]);
            parentIdMap[`${item.main_item_number}:${item.description}`] = pins.rows[0].id;
        }

        for (let i = 0; i < parsedData.businessItems.length; i++) {
            const item = parsedData.businessItems[i];
            if (item.is_group_header) continue;
            const parentId = item.parent_description ? parentIdMap[`${item.main_item_number}:${item.parent_description}`] : null;
            await pool.query('INSERT INTO business_fee_items (fee_schedule_id, main_item_number, sub_item_code, description, parent_id, frequency, cat_a_fee, cat_b_fee, cat_c_fee, cat_d_fee, cat_e_fee, cat_f_fee, is_group_header, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, $13)',
                [scheduleId, item.main_item_number, item.sub_item_code || null, item.description, parentId, item.frequency || null, item.cat_a_fee || null, item.cat_b_fee || null, item.cat_c_fee || null, item.cat_d_fee || null, item.cat_e_fee || null, item.cat_f_fee || null, i + parsedData.businessItems.length]);
        }
        console.log(`Inserted ${parsedData.businessItems.length} business items`);

        await pool.query('UPDATE fee_schedules SET status = \'ACTIVE\' WHERE id = $1', [scheduleId]);
        await pool.query('COMMIT');
        console.log('--- IMPORT SUCCESSFUL ---');
        process.exit(0);
    } catch (err) {
        console.error('IMPORT FAILED:', err);
        if (pool) await pool.query('ROLLBACK');
        process.exit(1);
    }
}
run();
