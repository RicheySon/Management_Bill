import pool from '../config/database';

/**
 * Billing Service
 * Handles rate calculation and bill generation logic
 */

interface BillCalculation {
    current_rate: number;
    arrears: number;
    rebate: number;
    total_amount: number;
    amount_due: number;
    bill_details: any;
}

/**
 * Calculate property rate bill
 * Uses configured fee schedule rates if available, falls back to legacy base_rate * property_size
 */
export const calculatePropertyBill = async (
    propertyId: string,
    billYear: number
): Promise<BillCalculation> => {
    // Get property details
    const propertyResult = await pool.query(
        `SELECT p.*, pc.base_rate, pc.name as classification_name
     FROM properties p
     LEFT JOIN property_classifications pc ON p.classification_id = pc.id
     WHERE p.id = $1`,
        [propertyId]
    );

    if (propertyResult.rows.length === 0) {
        throw new Error('Property not found');
    }

    const property = propertyResult.rows[0];
    const propertySize = parseFloat(property.property_size) || 50;
    let current_rate: number;
    let rateDescription = '';

    // Try to use configured fee schedule rates
    const activeSchedule = await pool.query(
        `SELECT id FROM fee_schedules WHERE year = $1 AND status = 'ACTIVE'`,
        [billYear]
    );

    if (activeSchedule.rows.length > 0) {
        let zone = null;

        // First, check if property has a specific rate zone assigned
        if (property.property_rate_zone_id) {
            const zoneResult = await pool.query(
                'SELECT * FROM property_rate_zones WHERE id = $1',
                [property.property_rate_zone_id]
            );
            if (zoneResult.rows.length > 0) zone = zoneResult.rows[0];
        }

        // Otherwise, match by classification type
        if (!zone && property.classification_name) {
            const zoneTypeMap: Record<string, string> = {
                'Residential': 'RESIDENTIAL',
                'Commercial': 'COMMERCIAL',
                'Industrial': 'INDUSTRIAL',
            };
            const zoneType = zoneTypeMap[property.classification_name] || 'RESIDENTIAL';

            const zoneResult = await pool.query(
                `SELECT * FROM property_rate_zones
                 WHERE fee_schedule_id = $1 AND zone_type = $2
                 ORDER BY zone_class ASC LIMIT 1`,
                [activeSchedule.rows[0].id, zoneType]
            );
            if (zoneResult.rows.length > 0) zone = zoneResult.rows[0];
        }

        if (zone) {
            const rateImpost = parseFloat(zone.rate_impost_min);
            const minimumRate = parseFloat(zone.minimum_rate_min);
            const calculatedRate = rateImpost * propertySize;
            current_rate = Math.max(calculatedRate, minimumRate);
            rateDescription = `${zone.zone_name} - Rate Impost: ${rateImpost}`;
        } else {
            // Fallback to legacy
            const baseRate = parseFloat(property.base_rate) || 0;
            current_rate = baseRate * propertySize;
            rateDescription = `Legacy Rate: ${baseRate}`;
        }
    } else {
        // No active schedule - use legacy calculation
        const baseRate = parseFloat(property.base_rate) || 0;
        current_rate = baseRate * propertySize;
        rateDescription = `Legacy Rate: ${baseRate}`;
    }

    // Check for arrears (previous unpaid bills)
    const arrearsResult = await pool.query(
        `SELECT COALESCE(SUM(amount_due), 0) as total_arrears
     FROM bills
     WHERE property_id = $1
       AND bill_period_year < $2
       AND payment_status != 'PAID'`,
        [propertyId, billYear]
    );

    const arrears = parseFloat(arrearsResult.rows[0].total_arrears);
    const rebate = 0;
    const total_amount = current_rate + arrears - rebate;
    const amount_due = total_amount;

    const bill_details = {
        bill_type: 'PROPERTY_RATE',
        items: [
            {
                description: `Property Rate - ${property.classification_name || 'Standard'}`,
                rate_info: rateDescription,
                current_rate: current_rate.toFixed(2),
                area: propertySize.toFixed(2),
                arrears: arrears.toFixed(2),
                rebate: rebate.toFixed(2),
                total: current_rate.toFixed(2),
            },
        ],
    };

    return {
        current_rate,
        arrears,
        rebate,
        total_amount,
        amount_due,
        bill_details,
    };
};

/**
 * Calculate Business Operating Permit (BOP) bill
 * Uses configured fee schedule items if available, falls back to legacy base_fee
 */
export const calculateBusinessBill = async (
    businessId: string,
    billYear: number
): Promise<BillCalculation> => {
    // Get business details
    const businessResult = await pool.query(
        `SELECT b.*, bc.base_fee, bc.name as category_name
     FROM businesses b
     LEFT JOIN business_categories bc ON b.category_id = bc.id
     WHERE b.id = $1`,
        [businessId]
    );

    if (businessResult.rows.length === 0) {
        throw new Error('Business not found');
    }

    const business = businessResult.rows[0];
    let current_rate: number;
    let feeDescription = '';

    // Try to use configured fee schedule rates
    if (business.fee_item_id) {
        const activeSchedule = await pool.query(
            `SELECT id FROM fee_schedules WHERE year = $1 AND status = 'ACTIVE'`,
            [billYear]
        );

        if (activeSchedule.rows.length > 0) {
            const feeItemResult = await pool.query(
                'SELECT * FROM business_fee_items WHERE id = $1 AND fee_schedule_id = $2',
                [business.fee_item_id, activeSchedule.rows[0].id]
            );

            if (feeItemResult.rows.length > 0) {
                const feeItem = feeItemResult.rows[0];
                // Determine which category fee to use based on business_category_class
                const catClass = (business.business_category_class || 'Category A')
                    .replace('Category ', '').toLowerCase().trim();
                const feeColumn = `cat_${catClass}_fee`;
                const configuredFee = parseFloat(feeItem[feeColumn]);

                if (!isNaN(configuredFee) && configuredFee > 0) {
                    current_rate = configuredFee;
                    feeDescription = `${feeItem.description} - ${business.business_category_class || 'Category A'}`;
                } else {
                    // Try cat_a_fee as default
                    current_rate = parseFloat(feeItem.cat_a_fee) || parseFloat(business.base_fee) || 0;
                    feeDescription = `${feeItem.description} - Category A (default)`;
                }
            } else {
                current_rate = parseFloat(business.base_fee) || 0;
                feeDescription = `Legacy: ${business.category_name}`;
            }
        } else {
            current_rate = parseFloat(business.base_fee) || 0;
            feeDescription = `Legacy: ${business.category_name}`;
        }
    } else {
        // No fee_item_id - use legacy base_fee
        current_rate = parseFloat(business.base_fee) || 0;
        feeDescription = `Legacy: ${business.category_name}`;
    }

    // Check for arrears
    const arrearsResult = await pool.query(
        `SELECT COALESCE(SUM(amount_due), 0) as total_arrears
     FROM bills
     WHERE business_id = $1
       AND bill_period_year < $2
       AND payment_status != 'PAID'`,
        [businessId, billYear]
    );

    const arrears = parseFloat(arrearsResult.rows[0].total_arrears);
    const rebate = 0;
    const total_amount = current_rate + arrears - rebate;
    const amount_due = total_amount;

    const bill_details = {
        bill_type: 'BOP',
        items: [
            {
                description: feeDescription || `BOP Fee - ${business.category_name}`,
                current_rate: current_rate.toFixed(2),
                area: '0.00',
                arrears: arrears.toFixed(2),
                rebate: rebate.toFixed(2),
                total: current_rate.toFixed(2),
            },
        ],
        business_category: business.category_name,
    };

    return {
        current_rate,
        arrears,
        rebate,
        total_amount,
        amount_due,
        bill_details,
    };
};

/**
 * Generate a new bill
 */
export const generateBill = async (
    billType: 'PROPERTY_RATE' | 'BOP',
    targetId: string,
    customerId: string,
    billYear?: number
): Promise<any> => {
    const currentYear = new Date().getFullYear();
    const year = billYear || currentYear;

    let calculation: BillCalculation;
    let propertyId = null;
    let businessId = null;
    let billPeriodDescription = '';

    if (billType === 'PROPERTY_RATE') {
        calculation = await calculatePropertyBill(targetId, year);
        propertyId = targetId;
        billPeriodDescription = `${year} Annual Property Rate`;
    } else {
        calculation = await calculateBusinessBill(targetId, year);
        businessId = targetId;
        billPeriodDescription = `${year} Business Operating Permit`;
    }

    // Check if bill already exists for this period
    const existingBill = await pool.query(
        `SELECT id FROM bills
     WHERE bill_type = $1 
       AND bill_period_year = $2
       AND ${billType === 'PROPERTY_RATE' ? 'property_id' : 'business_id'} = $3`,
        [billType, year, targetId]
    );

    if (existingBill.rows.length > 0) {
        throw new Error(`Bill already exists for ${billType} in year ${year}`);
    }

    // Generate bill number
    const billNumberResult = await pool.query(
        `SELECT generate_auto_number('BILL', $1) as bill_number`,
        [year]
    );

    const billNumber = billNumberResult.rows[0].bill_number;

    // Calculate due date (30 days from now)
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Insert bill
    const result = await pool.query(
        `INSERT INTO bills (
      bill_number, bill_type, customer_id, property_id, business_id,
      bill_period_year, bill_period_description, current_rate, arrears,
      rebate, total_amount, amount_paid, amount_due, issue_date, due_date,
      payment_status, bill_details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
        [
            billNumber,
            billType,
            customerId,
            propertyId,
            businessId,
            year,
            billPeriodDescription,
            calculation.current_rate,
            calculation.arrears,
            calculation.rebate,
            calculation.total_amount,
            0, // amount_paid
            calculation.amount_due,
            issueDate,
            dueDate,
            'UNPAID',
            JSON.stringify(calculation.bill_details),
        ]
    );

    return result.rows[0];
};

/**
 * Record a payment against a bill
 */
export const recordPayment = async (
    billId: string,
    customerId: string,
    amount: number,
    paymentMethod: string,
    gcrNumber: string,
    paymentReference?: string
): Promise<any> => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get bill details
        const billResult = await client.query(
            'SELECT * FROM bills WHERE id = $1 AND customer_id = $2 FOR UPDATE',
            [billId, customerId]
        );

        if (billResult.rows.length === 0) {
            throw new Error('Bill not found');
        }

        const bill = billResult.rows[0];

        if (bill.payment_status === 'PAID') {
            throw new Error('Bill is already fully paid');
        }

        const newAmountPaid = parseFloat(bill.amount_paid) + amount;
        const newAmountDue = parseFloat(bill.total_amount) - newAmountPaid;

        let newStatus = 'UNPAID';
        if (newAmountDue <= 0) {
            newStatus = 'PAID';
        } else if (newAmountPaid > 0) {
            newStatus = 'PARTIAL';
        }

        // Generate receipt number
        const receiptResult = await client.query(
            `SELECT generate_auto_number('RECEIPT', $1) as receipt_number`,
            [new Date().getFullYear()]
        );

        const receiptNumber = receiptResult.rows[0].receipt_number;

        // Insert payment
        const paymentResult = await client.query(
            `INSERT INTO payments (
        receipt_number, gcr_number, bill_id, customer_id, amount,
        payment_method, payment_reference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
            [receiptNumber, gcrNumber, billId, customerId, amount, paymentMethod, paymentReference || null]
        );

        // Update bill
        await client.query(
            `UPDATE bills SET
        amount_paid = $1,
        amount_due = $2,
        payment_status = $3
       WHERE id = $4`,
            [newAmountPaid, newAmountDue, newStatus, billId]
        );

        await client.query('COMMIT');

        return paymentResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export default {
    calculatePropertyBill,
    calculateBusinessBill,
    generateBill,
    recordPayment,
};
