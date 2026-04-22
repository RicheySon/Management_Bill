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
        const fs = require('fs');
        const writeStream = fs.createWriteStream('test-bill.pdf');
        doc.pipe(writeStream);
        doc.end();
        console.log('PDF Generation Successful! Saved to test-bill.pdf');

        writeStream.on('finish', () => {
            process.exit(0);
        });
    } catch (e) {
        console.error('PDF Generation Failed:', e);
        process.exit(1);
    }
}

testPDF();
