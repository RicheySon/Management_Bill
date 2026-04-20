import { generateBillPDF } from './src/services/pdf.service';
import pool from './src/config/database';

async function testPDF() {
    try {
        const result = await pool.query('SELECT id FROM bills LIMIT 1');
        if (result.rows.length === 0) {
            console.log('No bills found');
            process.exit(0);
        }
        console.log(`Generating PDF for bill ${result.rows[0].id}`);
        const doc = await generateBillPDF(result.rows[0].id);
        console.log('PDF Generation Successful!');
        process.exit(0);
    } catch (e) {
        console.error('PDF Generation Failed:', e);
        process.exit(1);
    }
}

testPDF();
