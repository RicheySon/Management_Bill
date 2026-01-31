import PDFDocument from 'pdfkit';
import pool from '../config/database';
import { format } from 'date-fns';

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
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 40, right: 40 },
    });

    const isBOP = bill.bill_type === 'BOP';
    const billDetails = typeof bill.bill_details === 'string'
        ? JSON.parse(bill.bill_details)
        : bill.bill_details;

    // Header
    doc.fontSize(18)
        .font('Helvetica-Bold')
        .text('GA NORTH MUNICIPAL', 50, 50, { align: 'center' });

    doc.fontSize(10)
        .font('Helvetica')
        .text('Revenue Management System', { align: 'center' });

    // Bill Type Header Box
    doc.rect(50, 100, 150, 30)
        .fillAndStroke('#000080', '#000080');

    doc.fillColor('#FFFFFF')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(isBOP ? 'BOP BILL' : 'PROPERTY BILL', 55, 110);

    // Printed On Date
    doc.fillColor('#000000')
        .fontSize(9)
        .font('Helvetica')
        .text(`Printed On: ${format(new Date(), 'dd/MM/yyyy')}`, 450, 110, { align: 'right' });

    // Bill To Box
    let currentY = 150;
    doc.rect(50, currentY, 495, 25)
        .stroke();

    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text(`BILL TO: ${isBOP ? business.business_name : customer.full_name}`,
            55, currentY + 8);

    currentY += 30;

    // Customer Details Section
    // Customer Number & Phone
    doc.rect(50, currentY, 270, 30).stroke();
    doc.rect(320, currentY, 225, 30).stroke();

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('CUSTOMER NO:', 55, currentY + 5);
    doc.fontSize(9).font('Helvetica');
    doc.text(customer.customer_number, 55, currentY + 15, { width: 260 });

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text(`PHONE: ${customer.phone_number}`, 325, currentY + 12);

    currentY += 30;

    // Street Name & Electoral Area
    doc.rect(50, currentY, 270, 25).stroke();
    doc.rect(320, currentY, 225, 25).stroke();

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('STREET NAME:', 55, currentY + 5);
    doc.fontSize(9).font('Helvetica');
    const streetName = business?.street_name || property?.street_name || 'N/A';
    doc.text(streetName, 55, currentY + 13);

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('ELECTORAL AREA:', 325, currentY + 5);
    doc.fontSize(9).font('Helvetica');
    doc.text(electoral_area || 'N/A', 325, currentY + 13);

    currentY += 25;

    // Business Type/Category & Landmark
    if (isBOP) {
        doc.rect(50, currentY, 270, 25).stroke();
        doc.rect(320, currentY, 225, 25).stroke();

        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('BUSINESS TYPE:', 55, currentY + 5);
        doc.fontSize(9).font('Helvetica');
        doc.text(business.business_category, 55, currentY + 13);

        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('LANDMARK:', 325, currentY + 5);
        doc.fontSize(9).font('Helvetica');
        doc.text(landmark || 'N/A', 325, currentY + 13);

        currentY += 25;

        // Business Activity (Category Name from your image)
        doc.rect(50, currentY, 495, 25).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text(business.business_category.toUpperCase(), 55, currentY + 10);

        currentY += 25;
    }

    // GPS Coordinate
    const gpsAddress = business?.gps_address || property?.gps_address || 'N/A';
    doc.rect(50, currentY, 495, 20).stroke();
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text(`GPS COORDINATE: ${gpsAddress}`, 55, currentY + 7);

    currentY += 25;

    // Bill Number & Period
    doc.rect(50, currentY, 270, 20).stroke();
    doc.rect(320, currentY, 225, 20).stroke();

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('BILL NO:', 55, currentY + 7);

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('BILL PERIOD:', 325, currentY + 7);
    doc.fontSize(9).font('Helvetica');
    doc.text(bill.bill_period_year.toString(), 390, currentY + 7);

    currentY += 25;

    // Charges Table
    // Table Header
    doc.rect(50, currentY, 85, 40).stroke(); // Bill Type
    doc.rect(135, currentY, 65, 20).stroke(); // Current Rate(GH)
    doc.rect(200, currentY, 50, 20).stroke(); // Area(GH)
    doc.rect(250, currentY, 65, 20).stroke(); // Arrears(GHS)
    doc.rect(315, currentY, 60, 20).stroke(); // Rebate(GHS)
    doc.rect(375, currentY, 170, 20).stroke(); // Total(GHS)

    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('BILL TYPE', 55, currentY + 3, { width: 75, align: 'center' });
    doc.text('CURRENT\nRATE(GH)', 137, currentY + 2, { width: 60, align: 'center' });
    doc.text('AREA\n(GH)', 203, currentY + 2, { width: 45, align: 'center' });
    doc.text('ARREARS\n(GHS)', 253, currentY + 2, { width: 60, align: 'center' });
    doc.text('REBAT\n(GHS)', 318, currentY + 2, { width: 55, align: 'center' });
    doc.text('TOTAL\n(GHS)', 385, currentY + 2, { width: 150, align: 'center' });

    currentY += 20;

    // Sub-headers
    doc.rect(135, currentY, 65, 20).stroke();
    doc.rect(200, currentY, 50, 20).stroke();

    doc.fontSize(7).font('Helvetica');
    doc.text('C.RATE', 140, currentY + 7);
    doc.text('CR', 205, currentY + 7);

    currentY += 20;

    // Bill Item Row
    const item = billDetails.items[0];
    doc.rect(50, currentY, 85, 25).stroke();
    doc.rect(135, currentY, 65, 25).stroke();
    doc.rect(200, currentY, 50, 25).stroke();
    doc.rect(250, currentY, 65, 25).stroke();
    doc.rect(315, currentY, 60, 25).stroke();
    doc.rect(375, currentY, 170, 25).stroke();

    doc.fontSize(8).font('Helvetica');
    doc.text(item.description, 53, currentY + 5, { width: 80 });
    doc.text(item.current_rate, 140, currentY + 10);
    doc.text(item.area || '0.00', 205, currentY + 10);
    doc.text(bill.arrears.toFixed(2), 255, currentY + 10);
    doc.text(bill.rebate.toFixed(2), 320, currentY + 10);
    doc.text(bill.total_amount.toFixed(2), 380, currentY + 10);

    currentY += 30;

    // Amount Paid & Due
    doc.rect(375, currentY, 100, 20).stroke();
    doc.rect(475, currentY, 70, 20).stroke();

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Amount Paid ▸', 380, currentY + 7);
    doc.text(bill.amount_paid.toFixed(2), 480, currentY + 7);

    currentY += 20;

    doc.rect(375, currentY, 100, 20).stroke();
    doc.rect(475, currentY, 70, 20).stroke();

    doc.text('Amount Due ▸', 380, currentY + 7);
    doc.fillColor('#FF0000');
    doc.text(bill.amount_due.toFixed(2), 480, currentY + 7);

    // Footer
    doc.fillColor('#000000')
        .fontSize(7)
        .font('Helvetica')
        .text('Please write the customer number on all payment slips', 50, 700, { align: 'center' });

    doc.text(`Generated by Municipal Revenue Management System - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
        50, 715, { align: 'center' });

    return doc;
};

/**
 * Generate multiple bills as bulk PDF
 */
export const generateBulkBillsPDF = async (billIds: string[]): Promise<typeof PDFDocument> => {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 40, right: 40 },
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
