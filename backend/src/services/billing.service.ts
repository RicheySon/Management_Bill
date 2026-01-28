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
    const baseRate = parseFloat(property.base_rate);
    const propertySize = parseFloat(property.property_size) || 50; // Default 50 sqm if not specified

    // Calculate current rate: base_rate * property_size
    const current_rate = baseRate * propertySize;

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

    // No rebates for now (can be configured later)
    const rebate = 0;

    const total_amount = current_rate + arrears - rebate;
    const amount_due = total_amount;

    const bill_details = {
        bill_type: 'PROPERTY_RATE',
        items: [
            {
                description: `Basic Rate Charge - CAT ${property.classification_name.charAt(0)}`,
                current_rate: baseRate.toFixed(2),
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
    const baseFee = parseFloat(business.base_fee);

    // For BOP, the current rate is simply the base fee
    const current_rate = baseFee;

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
                description: `Basic Rate Charge - CAT A`,
                current_rate: baseFee.toFixed(2),
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
        receipt_number, bill_id, customer_id, amount,
        payment_method, payment_reference
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
            [receiptNumber, billId, customerId, amount, paymentMethod, paymentReference || null]
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
