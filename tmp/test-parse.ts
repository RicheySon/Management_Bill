import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = 'C:\\Users\\RICHEY_SON\\Desktop\\Management_Bill\\2026 FEE FIXING RESOLUTIONS OF GA NORTH -pdf.xlsx';

function cleanNumber(val: any): number | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
}

function parseRateRange(val: any): { min: number; max?: number } | null {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).replace(/,/g, '').trim();

    if (str.includes('-')) {
        const parts = str.split('-').map(s => s.trim());
        if (parts.length === 2) {
            const min = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            if (!isNaN(min) && !isNaN(max)) {
                return { min, max };
            }
            if (!isNaN(min)) return { min };
        }
    }

    const num = parseFloat(str);
    if (!isNaN(num)) return { min: num };
    return null;
}

try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log('Sheet Names:', workbook.SheetNames);

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    console.log('Total Rows:', rows.length);
    console.log('First 10 rows:');
    rows.slice(0, 10).forEach((row, i) => {
        console.log(`Row ${i}:`, row);
    });

    // Simple check for sections
    let propertySectionFound = false;
    let businessSectionFound = false;

    for (let i = 0; i < rows.length; i++) {
        const rowStr = rows[i].map((c: any) => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('rating zone') && rowStr.includes('rate impost')) {
            console.log('Property Section Found at Row:', i);
            propertySectionFound = true;
        }
        if (rowStr.includes('business licence') || (rowStr.includes('main item') && rowStr.includes('sub item'))) {
            console.log('Business Section Found at Row:', i);
            businessSectionFound = true;
        }
    }

    if (!propertySectionFound) console.log('Property section NOT found using current logic');
    if (!businessSectionFound) console.log('Business section NOT found using current logic');

} catch (err) {
    console.error('Error reading/parsing file:', err);
}
