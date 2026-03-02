const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\\\Users\\\\RICHEY_SON\\\\Desktop\\\\Management_Bill\\\\2026 FEE FIXING RESOLUTIONS OF GA NORTH -pdf.xlsx';

try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    console.log(`--- Inspecting Sheet 1: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    rows.forEach((row, i) => {
        const rowStr = row.map(String).join(' ').toLowerCase();
        if (rowStr.trim().length > 0) {
            console.log(`[Row ${i}]`, JSON.stringify(row));
        }
    });

} catch (err) {
    console.error(err);
}
