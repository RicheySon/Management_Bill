const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\\\Users\\\\RICHEY_SON\\\\Desktop\\\\Management_Bill\\\\2026 FEE FIXING RESOLUTIONS OF GA NORTH -pdf.xlsx';

try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    for (const sheetName of workbook.SheetNames) {
        console.log(`--- Sheet: ${sheetName} ---`);
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Look for property keywords
        let found = false;
        for (let i = 0; i < Math.min(rows.length, 50); i++) {
            const rowStr = rows[i].map(String).join(' ').toLowerCase();
            if (rowStr.includes('residential') || rowStr.includes('property') || rowStr.includes('rating zone')) {
                console.log(`Row ${i}:`, JSON.stringify(rows[i]));
                found = true;
            }
        }
        if (!found) console.log('No property keywords in first 50 rows');
    }

} catch (err) {
    console.error(err);
}
