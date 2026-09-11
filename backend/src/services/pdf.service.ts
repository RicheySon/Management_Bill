import PDFDocument from 'pdfkit';
import pool from '../config/database';
import { format } from 'date-fns';
import path from 'path';
import QRCode from 'qrcode';

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
      p.property_use, p.building_type, p.account_number as property_account_number,
      p.latitude as property_latitude, p.longitude as property_longitude,
      pc.name as property_classification,
      prz.zone_name as property_zone_name,
      ea_p.name as property_electoral_area,
      bus.business_number, bus.business_name, bus.business_activity,
      bus.street_name as business_street, bus.gps_address as business_gps,
      bus.landmark as business_landmark,
      bus.business_type_main, bus.business_type_sub, bus.business_category_class,
      bus.account_number as business_account_number,
      bus.latitude as business_latitude, bus.longitude as business_longitude,
      ea_b.name as business_electoral_area,
      bc.name as business_category,
      bfi.description as business_fee_item_name
     FROM bills b
     LEFT JOIN customers c ON b.customer_id = c.id
     LEFT JOIN properties p ON b.property_id = p.id
     LEFT JOIN property_classifications pc ON p.classification_id = pc.id
     LEFT JOIN property_rate_zones prz ON p.property_rate_zone_id = prz.id
     LEFT JOIN electoral_areas ea_p ON p.electoral_area_id = ea_p.id
     LEFT JOIN businesses bus ON b.business_id = bus.id
     LEFT JOIN electoral_areas ea_b ON bus.electoral_area_id = ea_b.id
     LEFT JOIN business_categories bc ON bus.category_id = bc.id
     LEFT JOIN business_fee_items bfi ON bus.fee_item_id = bfi.id
     WHERE b.id = $1`,
        [billId]
    );

    if (result.rows.length === 0) {
        throw new Error('Bill not found');
    }

    const row = result.rows[0];

    const formatGps = (gpsAddress?: string | null, lat?: any, lng?: any) => {
        const addr = String(gpsAddress || '').trim();
        if (addr) return addr;
        const la = lat != null && lat !== '' ? Number(lat) : NaN;
        const lo = lng != null && lng !== '' ? Number(lng) : NaN;
        if (Number.isFinite(la) && Number.isFinite(lo)) {
            return `${la.toFixed(6)}, ${lo.toFixed(6)}`;
        }
        return '';
    };

    // Fee-fixing zone name is the main "property type" (e.g. Residential property 2 to 5 rooms)
    const propertyType =
        [row.property_zone_name, row.property_use, row.property_classification, row.building_type]
            .map((v: any) => (v != null ? String(v).trim() : ''))
            .find(Boolean) || '';

    // Prefer the specific business sub / fee-fixing item (e.g. Hardware, Provisions),
    // not the broad sector dropdown (e.g. Construction / FOOD/DRINKS).
    const businessType =
        [
            row.business_type_sub,
            row.business_fee_item_name,
            row.business_activity,
            [row.business_type_main, row.business_type_sub].filter(Boolean).join(' - '),
            row.business_category,
        ]
            .map((v: any) => (v != null ? String(v).trim() : ''))
            .filter(Boolean)
            .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
            .slice(0, 1)
            .join('') || '';

    return {
        bill: row,
        customer: {
            full_name: row.full_name,
            phone_number: row.phone_number,
            customer_number: row.bill_type === 'BOP' ? row.business_number : row.property_number,
        },
        property: row.property_id
            ? {
                  property_number: row.property_number,
                  street_name: row.property_street,
                  gps_address: formatGps(row.property_gps, row.property_latitude, row.property_longitude),
                  landmark: row.property_landmark,
                  property_type: propertyType,
                  account_number: row.property_account_number,
                  classification: row.property_classification,
                  zone_name: row.property_zone_name,
                  property_use: row.property_use,
                  building_type: row.building_type,
              }
            : null,
        business: row.business_id
            ? {
                  business_number: row.business_number,
                  business_name: row.business_name,
                  business_activity: row.business_activity,
                  business_category: row.business_category,
                  business_type: businessType,
                  street_name: row.business_street,
                  gps_address: formatGps(row.business_gps, row.business_latitude, row.business_longitude),
                  landmark: row.business_landmark,
                  account_number: row.business_account_number,
              }
            : null,
        electoral_area: row.property_electoral_area || row.business_electoral_area,
        landmark: row.property_landmark || row.business_landmark,
    };
};

/**
 * Authenticity QR code: scanning shows customer name, customer code, electoral area.
 */
const buildBillQrPng = async (payload: {
    customerName: string;
    customerCode: string;
    electoralArea: string;
}): Promise<Buffer> => {
    const text = [
        `Customer Name: ${payload.customerName || 'N/A'}`,
        `Customer Code: ${payload.customerCode || 'N/A'}`,
        `Electoral Area: ${payload.electoralArea || 'N/A'}`,
    ].join('\n');

    return QRCode.toBuffer(text, {
        type: 'png',
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 180,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });
};

/**
 * Outstanding-amount QR: scanning shows only the amount due.
 */
const buildOutstandingQrPng = async (amountDue: number): Promise<Buffer> => {
    const text = `Outstanding Amount: GHS ${Number(amountDue || 0).toFixed(2)}`;
    return QRCode.toBuffer(text, {
        type: 'png',
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 180,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });
};

/**
 * Draw a single bill onto the provided PDF document
 */
const drawBill = async (doc: typeof PDFDocument, billId: string): Promise<void> => {
    const data = await fetchBillData(billId);
    const { bill, customer, property, business, electoral_area, landmark } = data;

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
    const isBusinessProperty = bill.bill_type === 'BUSINESS_PROPERTY';
    let billDetails = typeof bill.bill_details === 'string'
        ? JSON.parse(bill.bill_details)
        : bill.bill_details;
    if (!billDetails || typeof billDetails !== 'object') {
        billDetails = { items: [] };
    }
    if (!Array.isArray(billDetails.items)) {
        billDetails.items = [];
    }

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
    const headerLabel = isBOP
        ? 'BOP BILL'
        : isBusinessProperty
          ? 'BUSINESS PROPERTY BILL'
          : 'PROPERTY BILL';
    const headerWidth = isBusinessProperty ? 170 : 110;
    doc.rect(margin + 40, currentY, headerWidth, 20)
        .fill('#000000');

    doc.fillColor('#FFFFFF')
        .fontSize(isBusinessProperty ? 8 : 10)
        .font('Helvetica-Bold')
        .text(headerLabel, margin + 40, currentY + 5, { width: headerWidth, align: 'center' });

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

    const streetName = (isBOP ? business?.street_name : property?.street_name) || '';
    const typeLabel = isBOP ? 'BUSINESS TYPE:' : 'PROPERTY TYPE:';
    const typeValue = isBOP
        ? (business?.business_type || business?.business_category || '')
        : (property?.property_type || '');
    const gpsValue = (isBOP ? business?.gps_address : property?.gps_address) || '';
    const landmarkValue =
        (isBOP ? business?.landmark : property?.landmark) || landmark || '';
    const oldAccount =
        bill.old_account_no ||
        (isBOP ? business?.account_number : property?.account_number) ||
        '';

    doc.fontSize(8);
    doc.font('Helvetica-Bold').text('STREET NAME:', margin + 15, currentY + 4);
    doc.font('Helvetica').text(streetName || 'N/A', margin + 15, currentY + 13, { width: 145 });

    doc.font('Helvetica-Bold').text('ELECTORAL AREA:', margin + 180, currentY + 4);
    doc.font('Helvetica').text((electoral_area || 'N/A').toUpperCase(), margin + 180, currentY + 13, { width: 175 });

    currentY += 30;

    // Property/Business Type & Landmark
    doc.rect(margin + 10, currentY, 190, 25).stroke();
    doc.rect(margin + 205, currentY, 160, 25).stroke();

    doc.font('Helvetica-Bold').text(typeLabel, margin + 15, currentY + 4);
    doc.font('Helvetica').text(typeValue || 'N/A', margin + 15, currentY + 13, {
        width: 180,
    });

    doc.font('Helvetica-Bold').text('LANDMARK:', margin + 210, currentY + 4);
    doc.font('Helvetica').text(landmarkValue || 'N/A', margin + 210, currentY + 13, { width: 150 });

    currentY += 30;

    // Old Account No & GPS Address
    doc.rect(margin + 10, currentY, 190, 20).stroke();
    doc.rect(margin + 205, currentY, 160, 20).stroke();

    doc.font('Helvetica-Bold').text('OLD ACCOUNT NO:', margin + 15, currentY + 6, { continued: true })
        .font('Helvetica').text(` ${oldAccount || 'N/A'}`);

    doc.font('Helvetica-Bold').text('GPS ADDRESS:', margin + 210, currentY + 6, { continued: true })
        .font('Helvetica').text(` ${gpsValue || 'N/A'}`);

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
    const defaultDescription = isBOP
        ? (business?.business_type || business?.business_activity || 'Business Operating Permit')
        : (property?.property_type || property?.zone_name || 'Property Rate');
    const item = billDetails.items[0] || {
        description: defaultDescription,
        current_rate: bill.current_rate || 0,
    };
    // For BOP, prefer the specific sub/fee name over generic "Assessed BOP fee..."
    const billTypeLabel = isBOP
        ? (business?.business_type ||
              (item.description && !/assessed bop fee/i.test(String(item.description))
                  ? item.description
                  : null) ||
              defaultDescription)
        : (item.description || defaultDescription);
    const basicRate = Number(
        billDetails.basic_rate ?? item.basic_rate ?? 8
    );

    doc.rect(margin + 10, currentY, col1, 60).stroke();
    doc.rect(margin + 10 + col1, currentY, col2, 60).stroke();
    doc.rect(margin + 10 + col1 + col2, currentY, col3, 60).stroke();
    doc.rect(margin + 10 + col1 + col2 + col3, currentY, col4, 60).stroke();
    doc.rect(margin + 10 + col1 + col2 + col3 + col4, currentY, col5, 60).stroke();

    doc.fontSize(8).font('Helvetica');
    doc.text(String(billTypeLabel), margin + 15, currentY + 12, { width: col1 - 10, align: 'center' });
    doc.fontSize(9);
    doc.text(parseFloat(String(item.current_rate ?? bill.current_rate ?? 0)).toFixed(2), margin + 10 + col1, currentY + 12, { width: col2, align: 'center' });
    doc.fontSize(6).fillColor('#333333')
        .text(`Basic Rate: ${basicRate.toFixed(2)}`, margin + 10 + col1, currentY + 28, { width: col2, align: 'center' });
    doc.fillColor('#000000').fontSize(9);
    doc.text(parseFloat(bill.arrears || 0).toFixed(2), margin + 10 + col1 + col2, currentY + 20, { width: col3, align: 'center' });
    doc.text(parseFloat(bill.rebate || 0).toFixed(2), margin + 10 + col1 + col2 + col3, currentY + 20, { width: col4, align: 'center' });
    doc.text(parseFloat(bill.total_amount || 0).toFixed(2), margin + 10 + col1 + col2 + col3 + col4, currentY + 20, { width: col5, align: 'center' });

    currentY += 70;

    // Authenticity QR (left of Amount Paid / Due) — encodes name, customer code, electoral area
    const amountBlockTop = currentY;
    const billToName = isBOP
        ? (business?.business_name || customer.full_name || '')
        : (customer.full_name || '');
    const customerCode = String(customer.customer_number || '').trim();
    const areaName = String(electoral_area || '').trim();
    try {
        const qrPng = await buildBillQrPng({
            customerName: billToName,
            customerCode,
            electoralArea: areaName,
        });
        const qrSize = 48;
        doc.image(qrPng, margin + 12, amountBlockTop, {
            width: qrSize,
            height: qrSize,
        });
        doc.fontSize(5).font('Helvetica').fillColor('#444444')
            .text('AUTHENTICITY QR', margin + 12, amountBlockTop + qrSize + 1, {
                width: Math.max(qrSize, 70),
                align: 'left',
            });
        doc.fillColor('#000000');
    } catch (e) {
        console.warn('Could not render bill authenticity QR code:', e);
        doc.fontSize(7).font('Helvetica').fillColor('#666666')
            .text(`AUTH: ${customerCode || bill.bill_number}`, margin + 12, amountBlockTop + 18, { width: 150 });
        doc.fillColor('#000000');
    }

    // Amount Paid & Due (right side — QR occupies the secured left space)
    const labelX = margin + 180;
    const valueX = margin + 260;
    const rowWidth = 100;

    doc.rect(valueX, amountBlockTop, rowWidth, 20).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Amount Paid : GHS', labelX, amountBlockTop + 5, { width: valueX - labelX - 5, align: 'right' });
    doc.font('Helvetica').text(parseFloat(bill.amount_paid || 0).toFixed(2), valueX, amountBlockTop + 5, { width: rowWidth, align: 'center' });

    currentY = amountBlockTop + 25;

    doc.rect(valueX, currentY, rowWidth, 20).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Amount Due : GHS', labelX, currentY + 5, { width: valueX - labelX - 5, align: 'right' });
    doc.text(parseFloat(bill.amount_due || 0).toFixed(2), valueX, currentY + 5, { width: rowWidth, align: 'center' });

    currentY = amountBlockTop + 55;

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

    // Second QR — outstanding amount only, bottom-right corner (Mr. Rockson request)
    const outstandingAmount = parseFloat(bill.amount_due || 0);
    try {
        const outstandingQrPng = await buildOutstandingQrPng(outstandingAmount);
        const outstandingQrSize = 52;
        const outstandingQrX = pageWidth - margin - outstandingQrSize - 12;
        const outstandingQrY = pageHeight - margin - outstandingQrSize - 18;
        doc.image(outstandingQrPng, outstandingQrX, outstandingQrY, {
            width: outstandingQrSize,
            height: outstandingQrSize,
        });
        doc.fontSize(5).font('Helvetica').fillColor('#444444')
            .text('OUTSTANDING QR', outstandingQrX - 8, outstandingQrY + outstandingQrSize + 1, {
                width: outstandingQrSize + 16,
                align: 'center',
            });
        doc.fillColor('#000000');
    } catch (e) {
        console.warn('Could not render outstanding-amount QR code:', e);
        doc.fontSize(6).font('Helvetica').fillColor('#666666')
            .text(
                `DUE: GHS ${outstandingAmount.toFixed(2)}`,
                pageWidth - margin - 90,
                pageHeight - margin - 20,
                { width: 80, align: 'right' }
            );
        doc.fillColor('#000000');
    }
};

/**
 * Generate GA North Municipal Bill PDF
 */
export const generateBillPDF = async (billId: string): Promise<typeof PDFDocument> => {
    const doc = new PDFDocument({
        size: 'A5',
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
    });

    await drawBill(doc, billId);

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
        await drawBill(doc, billIds[i]);
    }

    return doc;
};

export default {
    generateBillPDF,
    generateBulkBillsPDF,
};
