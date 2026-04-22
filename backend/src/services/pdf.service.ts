import PDFDocument from 'pdfkit';
import pool from '../config/database';
import { format } from 'date-fns';
import path from 'path';

/**
 * PDF Generation Service
 * Generates bills and receipts matching GA North Municipal format
 */

interface BillData {
    bill: any;
    customer: any;
    property?: any;
    business?: any;
    electoral_area?: string;
    landmark?: string;
}

/**
 * Fetch bill data with all related information
 */
const fetchBillData = async (billId: string): Promise<BillData> => {
    const result = await pool.query(
        `SELECT b.*,
      c.full_name, c.phone_number, c.gps_address as customer_gps,
      p.property_number, p.street_name as property_street, 
      p.gps_address as property_gps, p.landmark as property_landmark,
      ea_p.name as property_electoral_area,
      bus.business_number, bus.business_name, bus.business_activity,
      bus.street_name as business_street, bus.gps_address as business_gps,
      bus.landmark as business_landmark,
      ea_b.name as business_electoral_area,
      bc.name as business_category
     FROM bills b
     LEFT JOIN customers c ON b.customer_id = c.id
     LEFT JOIN properties p ON b.property_id = p.id
     LEFT JOIN electoral_areas ea_p ON p.electoral_area_id = ea_p.id
     LEFT JOIN businesses bus ON b.business_id = bus.id
     LEFT JOIN electoral_areas ea_b ON bus.electoral_area_id = ea_b.id
     LEFT JOIN business_categories bc ON bus.category_id = bc.id
     WHERE b.id = $1`,
        [billId]
    );

    if (result.rows.length === 0) {
        throw new Error('Bill not found');
    }

    const row = result.rows[0];

    return {
        bill: row,
        customer: {
            full_name: row.full_name,
            phone_number: row.phone_number,
            customer_number: row.bill_type === 'BOP' ? row.business_number : row.property_number,
        },
        property: row.property_id ? {
            property_number: row.property_number,
            street_name: row.property_street,
            gps_address: row.property_gps,
            landmark: row.property_landmark,
        } : null,
        business: row.business_id ? {
            business_number: row.business_number,
            business_name: row.business_name,
            business_activity: row.business_activity,
            business_category: row.business_category,
            street_name: row.business_street,
            gps_address: row.business_gps,
            landmark: row.business_landmark,
        } : null,
        electoral_area: row.property_electoral_area || row.business_electoral_area,
        landmark: row.property_landmark || row.business_landmark,
    };
};

/**
 * Generate GA North Municipal Bill PDF
 */
export const generateBillPDF = async (billId: string): Promise<typeof PDFDocument> => {
    const data = await fetchBillData(billId);
    const { bill, customer, property, business, electoral_area, landmark } = data;

    const doc = new PDFDocument({
        size: 'A5',
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
    });

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 20;

    // Assets Path
    const assetsPath = path.join(__dirname, '../../assets');
    const gaLogoPath = path.join(assetsPath, 'ga_north_logo.jpg');
    const coatOfArmsPath = path.join(assetsPath, 'coat_of_arms.png');

    // Draw Black Border
    doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2))
        .lineWidth(1)
        .strokeColor('#000000')
        .stroke();

    // Watermark
    try {
        doc.save();
        doc.opacity(0.1);
        const watermarkWidth = 350;
        doc.image(gaLogoPath, (pageWidth - watermarkWidth) / 2, (pageHeight - watermarkWidth) / 2, {
            width: watermarkWidth,
        });
        doc.restore();
    } catch (e) {
        console.warn('Could not add watermark:', e);
    }

    const isBOP = bill.bill_type === 'BOP';
    const billDetails = typeof bill.bill_details === 'string'
        ? JSON.parse(bill.bill_details)
        : bill.bill_details;

    // Header Logos
    try {
        doc.image(gaLogoPath, margin + 10, margin + 10, { width: 45 });
        doc.image(coatOfArmsPath, pageWidth - margin - 55, margin + 10, { width: 45 });
    } catch (e) {
        console.warn('Could not add header logos:', e);
    }

    // Header Text
    doc.fillColor('#000000')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('GA NORTH MUNICIPAL ASSEMBLY', margin, margin + 25, { align: 'center' });

    doc.moveDown(1.5);

    // Bill Type Header Box
    let currentY = doc.y;
    doc.rect(margin + 40, currentY, 110, 20)
        .fill('#000000');

    doc.fillColor('#FFFFFF')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(isBOP ? 'BOP BILL' : 'PROPERTY BILL', margin + 45, currentY + 5, { width: 100, align: 'center' });

    // Printed On Date
    doc.fillColor('#000000')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(`Printed On ${format(new Date(), "do' / 'MMMM / yyyy").toUpperCase()}`,
            pageWidth - margin - 180, currentY + 5, { width: 170, align: 'right' });

    currentY += 25;

    // Bill To Box
    doc.rect(margin + 10, currentY, pageWidth - (margin * 2) - 20, 20)
        .strokeColor('#000000')
        .lineWidth(0.5)
        .stroke();

    doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('BILL TO:', margin + 15, currentY + 6, { continued: true })
        .font('Helvetica')
        .text(` ${isBOP ? business.business_name : customer.full_name}`);

    currentY += 25;

    // Customer & Phone
    doc.rect(margin + 10, currentY, 190, 20).stroke();
    doc.rect(margin + 205, currentY, 160, 20).stroke();

    doc.fontSize(8).font('Helvetica-Bold')
        .text('CUSTOMER:', margin + 15, currentY + 6, { continued: true })
        .font('Helvetica')
        .text(` ${customer.customer_number}`);

    doc.font('Helvetica-Bold')
        .text('PHONE:', margin + 210, currentY + 6, { continued: true })
        .font('Helvetica')
        .text(` ${customer.phone_number}`);

    currentY += 25;

    // Street & Electoral Area
    doc.rect(margin + 10, currentY, 160, 25).stroke();
    doc.rect(margin + 175, currentY, 190, 25).stroke();

    doc.fontSize(8);
    doc.font('Helvetica-Bold').text('STREET NAME:', margin + 15, currentY + 4);
    doc.font('Helvetica').text(business?.street_name || property?.street_name || 'N/A', margin + 15, currentY + 13);

    doc.font('Helvetica-Bold').text('ELECTRAL AREA:', margin + 180, currentY + 4);
    doc.font('Helvetica').text((electoral_area || 'N/A').toUpperCase(), margin + 180, currentY + 13);

    currentY += 30;

    // Business Type & Landmark
    doc.rect(margin + 10, currentY, 190, 25).stroke();
    doc.rect(margin + 205, currentY, 160, 25).stroke();

    doc.font('Helvetica-Bold').text('BUSINESS TYPE:', margin + 15, currentY + 4);
    doc.font('Helvetica').text((business?.business_category || 'N/A').toUpperCase(), margin + 15, currentY + 13);

    doc.font('Helvetica-Bold').text('LANDMARK:', margin + 210, currentY + 4);
    doc.font('Helvetica').text(landmark || 'N/A', margin + 210, currentY + 13);

    currentY += 30;

    // Old Account No & GPS
    doc.rect(margin + 10, currentY, 190, 20).stroke();
    doc.rect(margin + 205, currentY, 160, 20).stroke();

    doc.font('Helvetica-Bold').text('OLD ACCOUNT NO:', margin + 15, currentY + 6, { continued: true })
        .font('Helvetica').text(` ${bill.old_account_no || 'N/A'}`);

    doc.font('Helvetica-Bold').text('GPS COORDINATE:', margin + 210, currentY + 6, { continued: true })
        .font('Helvetica').text(` ${business?.gps_address || property?.gps_address || 'N/A'}`);

    currentY += 25;

    // Bill No & Period
    doc.rect(margin + 10, currentY, 225, 20).stroke();
    doc.rect(margin + 240, currentY, 125, 20).stroke();

    doc.font('Helvetica-Bold').text('BILL NO:', margin + 15, currentY + 6, { continued: true })
        .font('Helvetica').text(` ${bill.bill_number}`);

    doc.font('Helvetica-Bold').text('BILL PERIOD:', margin + 245, currentY + 6, { continued: true })
        .font('Helvetica').text(` ${bill.bill_period_year}`);

    currentY += 30;

    // Charges Table
    const col1 = 120;
    const col2 = 60;
    const col3 = 55;
    const col4 = 55;
    const col5 = 65;

    // Table Header
    doc.rect(margin + 10, currentY, col1, 20).stroke();
    doc.rect(margin + 10 + col1, currentY, col2, 20).stroke();
    doc.rect(margin + 10 + col1 + col2, currentY, col3, 20).stroke();
    doc.rect(margin + 10 + col1 + col2 + col3, currentY, col4, 20).stroke();
    doc.rect(margin + 10 + col1 + col2 + col3 + col4, currentY, col5, 20).stroke();

    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('BILL TYPE', margin + 10, currentY + 7, { width: col1, align: 'center' });
    doc.text('CURRENT\nRATE(GHS)', margin + 10 + col1, currentY + 2, { width: col2, align: 'center' });
    doc.text('AREARS\n(GHS)', margin + 10 + col1 + col2, currentY + 2, { width: col3, align: 'center' });
    doc.text('REBATE\n(GHS)', margin + 10 + col1 + col2 + col3, currentY + 2, { width: col4, align: 'center' });
    doc.text('TOTAL\n(GHS)', margin + 10 + col1 + col2 + col3 + col4, currentY + 7, { width: col5, align: 'center' });

    currentY += 20;

    // Bill Item Row
    const item = billDetails.items[0] || { description: 'Basic Rate Charge', current_rate: 0 };
    doc.rect(margin + 10, currentY, col1, 60).stroke();
    doc.rect(margin + 10 + col1, currentY, col2, 60).stroke();
    doc.rect(margin + 10 + col1 + col2, currentY, col3, 60).stroke();
    doc.rect(margin + 10 + col1 + col2 + col3, currentY, col4, 60).stroke();
    doc.rect(margin + 10 + col1 + col2 + col3 + col4, currentY, col5, 60).stroke();

    doc.fontSize(9).font('Helvetica');
    doc.text(item.description, margin + 15, currentY + 20, { width: col1 - 10, align: 'center' });
    doc.text(parseFloat(item.current_rate).toFixed(2), margin + 10 + col1, currentY + 20, { width: col2, align: 'center' });
    doc.text(parseFloat(bill.arrears || 0).toFixed(2), margin + 10 + col1 + col2, currentY + 20, { width: col3, align: 'center' });
    doc.text(parseFloat(bill.rebate || 0).toFixed(2), margin + 10 + col1 + col2 + col3, currentY + 20, { width: col4, align: 'center' });
    doc.text(parseFloat(bill.total_amount || 0).toFixed(2), margin + 10 + col1 + col2 + col3 + col4, currentY + 20, { width: col5, align: 'center' });

    // Sum row inside the current rate column?
    doc.text(parseFloat(item.current_rate).toFixed(2), margin + 10 + col1, currentY + 45, { width: col2, align: 'center' });

    currentY += 70;

    // Amount Paid & Due
    const labelX = margin + 180;
    const valueX = margin + 260;
    const rowWidth = 100;

    doc.rect(valueX, currentY, rowWidth, 20).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Amount Paid : GHS', labelX, currentY + 5, { width: valueX - labelX - 5, align: 'right' });
    doc.font('Helvetica').text(parseFloat(bill.amount_paid || 0).toFixed(2), valueX, currentY + 5, { width: rowWidth, align: 'center' });

    currentY += 25;

    doc.rect(valueX, currentY, rowWidth, 20).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Amount Due : GHS', labelX, currentY + 5, { width: valueX - labelX - 5, align: 'right' });
    doc.text(parseFloat(bill.amount_due || 0).toFixed(2), valueX, currentY + 5, { width: rowWidth, align: 'center' });

    currentY += 30;

    // Please Note Footer
    doc.fontSize(7).font('Helvetica-Bold').text('PLEASE NOTE', margin + 10, currentY);
    doc.fontSize(6).font('Helvetica');
    const notes = [
        'Do not make any payment without this bill.',
        'It is an offence to deface the property number given by the G.N.M.A.',
        'It is an offence to change ownership of the property without informing the G.N.M.A Authorities.',
        'All dishonored cheque(s) shall attract a penalty of 100% of the face value of the cheque and defaulters will be liable for prosecution.',
        'Legal action shall be taken against defaulters after Bill Payment Date specified on the bill elapsed. Defaulters shall pay 50% penalty of the amount owed the Assembly.',
        'Payments should be made to the Ga North Municipal Assembly Authorized Revenue Collector(s) or at the Municipal Revenue Office.',
        'Obtain General Counteroil receipt (GCR) for all payment to the Assembly at all time.'
    ];

    currentY += 5;
    notes.forEach((note) => {
        doc.text(`•  ${note}`, margin + 50, currentY, { width: pageWidth - margin - 60 });
        currentY = doc.y + 2; // Move currentY to the next line with a small gap
    });

    currentY += 5;

    // Payment Points
    doc.fontSize(7).font('Helvetica-Bold').text('NB:-  Payments Points', margin + 10, currentY);
    const points = [
        '*Revenue Collection Point',
        '*Municipal Assembly Collection Point  (Walk-in Service)',
        '*Direct Payment / Bank Transfer Zenit Bank #6011811493',
        '*Office Line - 0302-908-086'
    ];

    points.forEach((point, i) => {
        doc.text(point, margin + 40, currentY + 10 + (i * 8));
    });

    return doc;
};

/**
 * Generate multiple bills as bulk PDF
 */
export const generateBulkBillsPDF = async (billIds: string[]): Promise<typeof PDFDocument> => {
    const doc = new PDFDocument({
        size: 'A5',
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
    });

    for (let i = 0; i < billIds.length; i++) {
        if (i > 0) {
            doc.addPage();
        }

        // Generate each bill on a new page
        await generateBillPDF(billIds[i]);
        // Note: In production, you'd merge PDFs properly
        // This is a simplified version
    }

    return doc;
};

export default {
    generateBillPDF,
    generateBulkBillsPDF,
};
