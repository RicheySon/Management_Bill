import { generateBillPDF, generateBulkBillsPDF } from './src/services/pdf.service';
import pool from './src/config/database';

async function testPDF() {
    try {
        const result = await pool.query('SELECT id FROM bills LIMIT 2');
        if (result.rows.length === 0) {
            console.log('No bills found');
            process.exit(0);
        }
        
        const billIds = result.rows.map(row => row.id);
        console.log(`Generating Bulk PDF for bills: ${billIds.join(', ')}`);
        
        const doc = await generateBulkBillsPDF(billIds);
        const fs = require('fs');
        const writeStream = fs.createWriteStream('test-bulk-bills.pdf');
        doc.pipe(writeStream);
        doc.end();
        
        writeStream.on('finish', () => {
            console.log('Bulk PDF Generation Successful! Saved to test-bulk-bills.pdf');
            process.exit(0);
        });
    } catch (e) {
        console.error('PDF Generation Failed:', e);
        process.exit(1);
    }
}

testPDF();
