const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\\\Users\\\\RICHEY_SON\\\\Desktop\\\\Management_Bill\\\\2026 FEE FIXING RESOLUTIONS OF GA NORTH -pdf.xlsx';

try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    console.log('--- SHEET 1:', sheetName, '---');
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const row = rows[i];
        console.log(`Row ${i}:`, JSON.stringify(row));
    }

} catch (err) {
    console.error(err);
}
