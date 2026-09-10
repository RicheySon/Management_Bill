import pool from '../config/database';

/**
 * Billing Service
 * Handles rate calculation and bill generation logic
 */

/** Annual basic rate (GHS) attached to every property and BOP bill. */
export const BASIC_RATE_GHC = 8;

interface BillCalculation {
    current_rate: number;
    basic_rate: number;
    arrears: number;
    rebate: number;
    total_amount: number;
    amount_due: number;
    bill_details: any;
    prior_bill_ids?: string[];
}

export const billTotal = (current_rate: number, arrears: number, rebate: number, basicRate = BASIC_RATE_GHC) =>
    Number(current_rate || 0) + Number(basicRate || 0) + Number(arrears || 0) - Number(rebate || 0);

/**
 * Keep bill_details JSON aligned with money columns after an edit.
 * Without this, PDFs / UI can show a stale basic rate or drop it from the total story.
 */
export const syncBillDetailsAmounts = (
    existingDetails: any,
    amounts: { current_rate: number; arrears: number; rebate: number; basic_rate?: number; description?: string }
) => {
    const basic_rate = Number(
        amounts.basic_rate !== undefined ? amounts.basic_rate : BASIC_RATE_GHC
    );
    const details =
        existingDetails && typeof existingDetails === 'object'
            ? JSON.parse(JSON.stringify(existingDetails))
            : { items: [] };

    details.basic_rate = basic_rate;

    if (!Array.isArray(details.items) || details.items.length === 0) {
        details.items = [{}];
    }

    const item = details.items[0] || {};
    item.current_rate = Number(amounts.current_rate || 0).toFixed(2);
    item.basic_rate = basic_rate.toFixed(2);
    item.arrears = Number(amounts.arrears || 0).toFixed(2);
    item.rebate = Number(amounts.rebate || 0).toFixed(2);
    item.total = Number(amounts.current_rate || 0).toFixed(2);
    if (amounts.description) {
        item.description = amounts.description;
    }
    details.items[0] = item;

    return details;
};

/**
 * Push money-field changes onto the latest bill for a property/business.
 * Keeps the annual basic rate in the total so outstanding cards stay correct.
 */
export const syncLatestBillAmounts = async (
    entityColumn: 'property_id' | 'business_id',
    entityId: string,
    updates: { current_rate?: number; arrears?: number; rebate?: number; description?: string }
) => {
    const latest = await pool.query(
        `SELECT id, current_rate, arrears, rebate, amount_paid, bill_details
         FROM bills
         WHERE ${entityColumn} = $1
         ORDER BY bill_period_year DESC, created_at DESC
         LIMIT 1`,
        [entityId]
    );
    if (latest.rows.length === 0) return null;

    const bill = latest.rows[0];
    const current_rate =
        updates.current_rate !== undefined ? Number(updates.current_rate) : Number(bill.current_rate || 0);
    const arrears =
        updates.arrears !== undefined ? Number(updates.arrears) : Number(bill.arrears || 0);
    const rebate =
        updates.rebate !== undefined ? Number(updates.rebate) : Number(bill.rebate || 0);
    const amount_paid = Number(bill.amount_paid || 0);
    const total_amount = billTotal(current_rate, arrears, rebate, BASIC_RATE_GHC);
    const amount_due = Math.max(total_amount - amount_paid, 0);
    const payment_status =
        amount_due <= 0 ? 'PAID' : amount_paid > 0 ? 'PARTIAL' : 'UNPAID';
    const bill_details = syncBillDetailsAmounts(bill.bill_details, {
        current_rate,
        arrears,
        rebate,
        basic_rate: BASIC_RATE_GHC,
        description: updates.description,
    });

    const updated = await pool.query(
        `UPDATE bills SET
            current_rate = $1,
            arrears = $2,
            rebate = $3,
            total_amount = $4,
            amount_due = $5,
            payment_status = $6,
            bill_details = $7,
            updated_at = NOW()
         WHERE id = $8
         RETURNING id, bill_number, current_rate, arrears, rebate, total_amount, amount_due, payment_status`,
        [
            current_rate,
            arrears,
            rebate,
            total_amount,
            amount_due,
            payment_status,
            JSON.stringify(bill_details),
            bill.id,
        ]
    );
    return updated.rows[0] || null;
};

/** Normalize GCR: digits-only input becomes YY/####### for mobile keyboards without "/". */
export const normalizeGcrNumber = (value: string): string => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const isValidGcrNumber = (value: string): boolean => /^\d{2}\/\d{7}$/.test(normalizeGcrNumber(value));

const LETTER_TO_CLASS: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };

/** Parse "1st Class" / "Category A" / "CAT B" / legacy Residential → 1, 2, … */
export const propertyClassNumber = (classificationName?: string | null): number | null => {
    if (!classificationName) return null;
    const raw = String(classificationName).trim().toLowerCase();

    if (raw === 'residential') return 1;
    if (raw === 'commercial') return 2;
    if (raw === 'industrial') return 3;
    if (raw === 'mixed use' || raw === 'mixed_use') return 4;

    const letterMatch =
        raw.match(/^category\s*([a-f])\b/) ||
        raw.match(/^cat[_\s-]?([a-f])\b/) ||
        raw.match(/\b([a-f])\s*class\b/);
    if (letterMatch) return LETTER_TO_CLASS[letterMatch[1]] || null;

    const digitMatch = raw.match(/(\d+)/);
    if (digitMatch) {
        const n = parseInt(digitMatch[1], 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
};

/**
 * Resolve bill amount from a fee-fixing zone using property class / Category A–D.
 * Fee-fixing Excel: class columns → cat_a/b/c/d.
 */
export const feeAmountForPropertyClass = (
    zone: any,
    classificationName?: string | null,
    propertySize = 50
): number => {
    if (!zone) return 0;
    const classNum = propertyClassNumber(classificationName);
    const catMap: Record<number, any> = {
        1: zone.cat_a_fee,
        2: zone.cat_b_fee,
        3: zone.cat_c_fee,
        4: zone.cat_d_fee,
    };

    // Explicit class → only that CAT column (no silent CAT A fallback)
    if (classNum) {
        const raw = catMap[classNum];
        if (raw != null && raw !== '') {
            const fee = parseFloat(String(raw));
            if (!isNaN(fee) && fee > 0) return fee;
        }
        return 0;
    }

    const catA = parseFloat(String(zone.cat_a_fee ?? ''));
    if (!isNaN(catA) && catA > 0) return catA;

    const rateImpost = parseFloat(String(zone.rate_impost_min ?? 0)) || 0;
    const minimumRate = parseFloat(String(zone.minimum_rate_min ?? 0)) || 0;
    const calculatedRate = rateImpost * propertySize;
    let current = Math.max(calculatedRate, minimumRate || 0);
    if ((!current || current <= 0) && minimumRate > 0) current = minimumRate;
    return current || 0;
};

/** "Category A" / "A" / "CAT A" → a (null if unknown) */
export const businessCategoryLetter = (categoryClass?: string | null): string | null => {
    if (!categoryClass) return null;
    const raw = String(categoryClass).trim().toLowerCase();
    const match = raw.match(/([a-f])\b/) || raw.match(/cat[_\s-]?([a-f])/);
    if (match) return match[1];
    const stripped = raw.replace(/^category\s*/i, '').replace(/^cat[_\s-]*/i, '').trim();
    if (/^[a-f]$/.test(stripped)) return stripped;
    return null;
};

/** BOP fee from fee-fixing item + category class (CAT A/B/C/D). */
export const feeAmountForBusinessCategory = (
    feeItem: any,
    categoryClass?: string | null
): number => {
    if (!feeItem) return 0;
    const letter = businessCategoryLetter(categoryClass);

    if (letter) {
        const preferred = parseFloat(String(feeItem[`cat_${letter}_fee`] ?? ''));
        if (!isNaN(preferred) && preferred > 0) return preferred;
        return 0;
    }

    const fallbackFees = [
        feeItem.cat_a_fee,
        feeItem.cat_b_fee,
        feeItem.cat_c_fee,
        feeItem.cat_d_fee,
        feeItem.cat_e_fee,
        feeItem.cat_f_fee,
    ]
        .map((v: any) => parseFloat(String(v)))
        .filter((n: number) => !isNaN(n) && n > 0);
    return fallbackFees[0] || 0;
};

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

    // Prefer assessed amount set at registration / by admin
    const assessedAmount = parseFloat(property.assessed_amount);
    if (!isNaN(assessedAmount) && assessedAmount > 0) {
        current_rate = assessedAmount;
        rateDescription = 'Assessed property rate (from registration)';
    } else {
        // Try to use configured fee schedule rates
        const activeSchedule = await pool.query(
            `SELECT id FROM fee_schedules WHERE year = $1 AND status = 'ACTIVE'`,
            [billYear]
        );

        if (activeSchedule.rows.length > 0) {
            let zone = null;
            const scheduleId = activeSchedule.rows[0].id;
            const classNum = propertyClassNumber(property.classification_name);

            // First, check if property has a specific rate zone assigned
            if (property.property_rate_zone_id) {
                const zoneResult = await pool.query(
                    'SELECT * FROM property_rate_zones WHERE id = $1',
                    [property.property_rate_zone_id]
                );
                if (zoneResult.rows.length > 0) zone = zoneResult.rows[0];
            }

            // Otherwise match by property class → zone_class (1st Class → zone_class 1)
            if (!zone && classNum) {
                const zoneResult = await pool.query(
                    `SELECT * FROM property_rate_zones
                     WHERE fee_schedule_id = $1 AND zone_class = $2
                     ORDER BY sort_order ASC, id ASC
                     LIMIT 1`,
                    [scheduleId, classNum]
                );
                if (zoneResult.rows.length > 0) zone = zoneResult.rows[0];
            }

            // Fallback: zone_type from property_use if present
            if (!zone && property.property_use) {
                const useMap: Record<string, string> = {
                    Residential: 'RESIDENTIAL',
                    Commercial: 'COMMERCIAL',
                    Industrial: 'INDUSTRIAL',
                    'Mixed Use': 'MIXED_USE',
                };
                const zoneType = useMap[property.property_use];
                if (zoneType) {
                    const zoneResult = await pool.query(
                        `SELECT * FROM property_rate_zones
                         WHERE fee_schedule_id = $1 AND zone_type = $2
                         ORDER BY zone_class ASC, sort_order ASC
                         LIMIT 1`,
                        [scheduleId, zoneType]
                    );
                    if (zoneResult.rows.length > 0) zone = zoneResult.rows[0];
                }
            }

            if (zone) {
                current_rate = feeAmountForPropertyClass(
                    zone,
                    property.classification_name,
                    propertySize
                );
                rateDescription = `${zone.zone_name} — ${property.classification_name || 'class'} fee`;
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
    }

    // Check for arrears (previous unpaid bills of the same sector, not already rolled)
    const propertyBillType =
        property.property_kind === 'BUSINESS_PROPERTY' ? 'BUSINESS_PROPERTY' : 'PROPERTY_RATE';
    const arrearsResult = await pool.query(
        `SELECT COALESCE(SUM(amount_due), 0) as total_arrears,
                COALESCE(array_agg(id) FILTER (WHERE id IS NOT NULL), '{}') as prior_bill_ids
     FROM bills
     WHERE property_id = $1
       AND bill_type = $2
       AND bill_period_year < $3
       AND payment_status != 'PAID'
       AND rolled_into_bill_id IS NULL`,
        [propertyId, propertyBillType, billYear]
    );

    const arrears = parseFloat(arrearsResult.rows[0].total_arrears);
    const priorBillIds: string[] = arrearsResult.rows[0].prior_bill_ids || [];
    const rebate = 0;
    const basic_rate = BASIC_RATE_GHC;
    const total_amount = billTotal(current_rate, arrears, rebate, basic_rate);
    const amount_due = total_amount;

    const billTypeLabel =
        property.property_kind === 'BUSINESS_PROPERTY' ? 'Business Property Rate' : 'Property Rate';
    const bill_details = {
        bill_type: property.property_kind === 'BUSINESS_PROPERTY' ? 'BUSINESS_PROPERTY' : 'PROPERTY_RATE',
        basic_rate,
        items: [
            {
                description: `${billTypeLabel} - ${property.classification_name || 'Standard'}`,
                rate_info: rateDescription,
                current_rate: current_rate.toFixed(2),
                basic_rate: basic_rate.toFixed(2),
                area: propertySize.toFixed(2),
                arrears: arrears.toFixed(2),
                rebate: rebate.toFixed(2),
                total: current_rate.toFixed(2),
            },
        ],
    };

    return {
        current_rate,
        basic_rate,
        arrears,
        rebate,
        total_amount,
        amount_due,
        bill_details,
        prior_bill_ids: priorBillIds,
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
        `SELECT b.*, bc.base_fee, bc.name as category_name,
                bfi.description as fee_item_description
     FROM businesses b
     LEFT JOIN business_categories bc ON b.category_id = bc.id
     LEFT JOIN business_fee_items bfi ON b.fee_item_id = bfi.id
     WHERE b.id = $1`,
        [businessId]
    );

    if (businessResult.rows.length === 0) {
        throw new Error('Business not found');
    }

    const business = businessResult.rows[0];
    let current_rate: number;
    const subOrFee =
        String(business.business_type_sub || '').trim() ||
        String(business.fee_item_description || '').trim();
    let feeDescription = '';

    const assessedAmount = parseFloat(business.assessed_amount);
    if (!isNaN(assessedAmount) && assessedAmount > 0) {
        current_rate = assessedAmount;
        feeDescription = subOrFee || 'Assessed BOP fee (from registration)';
    } else if (business.fee_item_id) {
        // Look up fee item by id first (do not require matching schedule year)
        const feeItemResult = await pool.query(
            'SELECT * FROM business_fee_items WHERE id = $1',
            [business.fee_item_id]
        );

        if (feeItemResult.rows.length > 0) {
            const feeItem = feeItemResult.rows[0];
            current_rate = feeAmountForBusinessCategory(
                feeItem,
                business.business_category_class || 'Category A'
            );
            feeDescription =
                subOrFee ||
                `${feeItem.description} - ${business.business_category_class || 'Category A'}`;
            if (!current_rate) {
                current_rate = parseFloat(business.base_fee) || 0;
                feeDescription = subOrFee || `${feeItem.description} - fee schedule amount`;
            }
        } else {
            current_rate = parseFloat(business.base_fee) || 0;
            feeDescription = subOrFee || `Legacy: ${business.category_name}`;
        }
    } else {
        // No fee_item_id - use legacy base_fee
        current_rate = parseFloat(business.base_fee) || 0;
        feeDescription = subOrFee || `Legacy: ${business.category_name}`;
    }

    // Check for arrears (exclude bills already rolled into a newer bill)
    const arrearsResult = await pool.query(
        `SELECT COALESCE(SUM(amount_due), 0) as total_arrears,
                COALESCE(array_agg(id) FILTER (WHERE id IS NOT NULL), '{}') as prior_bill_ids
     FROM bills
     WHERE business_id = $1
       AND bill_period_year < $2
       AND payment_status != 'PAID'
       AND rolled_into_bill_id IS NULL`,
        [businessId, billYear]
    );

    const arrears = parseFloat(arrearsResult.rows[0].total_arrears);
    const priorBillIds: string[] = arrearsResult.rows[0].prior_bill_ids || [];
    const rebate = 0;
    const basic_rate = BASIC_RATE_GHC;
    const total_amount = billTotal(current_rate, arrears, rebate, basic_rate);
    const amount_due = total_amount;

    const bill_details = {
        bill_type: 'BOP',
        basic_rate,
        items: [
            {
                description: feeDescription || `BOP Fee - ${business.category_name}`,
                current_rate: current_rate.toFixed(2),
                basic_rate: basic_rate.toFixed(2),
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
        basic_rate,
        arrears,
        rebate,
        total_amount,
        amount_due,
        bill_details,
        prior_bill_ids: priorBillIds,
    };
};

/**
 * Generate a new bill
 */
export const generateBill = async (
    billType: 'PROPERTY_RATE' | 'BUSINESS_PROPERTY' | 'BOP',
    targetId: string,
    customerId: string,
    billYear?: number,
    amountOverride?: { current_rate?: number; arrears?: number; rebate?: number }
): Promise<any> => {
    const currentYear = new Date().getFullYear();
    const year = billYear || currentYear;

    let calculation: BillCalculation;
    let propertyId = null;
    let businessId = null;
    let billPeriodDescription = '';

    if (billType === 'PROPERTY_RATE' || billType === 'BUSINESS_PROPERTY') {
        calculation = await calculatePropertyBill(targetId, year);
        propertyId = targetId;
        billPeriodDescription =
            billType === 'BUSINESS_PROPERTY'
                ? `${year} Annual Business Property Rate`
                : `${year} Annual Property Rate`;
        if (calculation.bill_details) {
            calculation.bill_details.bill_type = billType;
        }
    } else {
        calculation = await calculateBusinessBill(targetId, year);
        businessId = targetId;
        billPeriodDescription = `${year} Business Operating Permit`;
    }

    // Optional explicit amounts from the officer at generation time
    if (amountOverride) {
        if (amountOverride.current_rate !== undefined && Number.isFinite(Number(amountOverride.current_rate))) {
            calculation.current_rate = Number(amountOverride.current_rate);
        }
        if (amountOverride.arrears !== undefined && Number.isFinite(Number(amountOverride.arrears))) {
            calculation.arrears = Number(amountOverride.arrears);
        }
        if (amountOverride.rebate !== undefined && Number.isFinite(Number(amountOverride.rebate))) {
            calculation.rebate = Number(amountOverride.rebate);
        }
        calculation.basic_rate = BASIC_RATE_GHC;
        calculation.total_amount = billTotal(
            calculation.current_rate,
            calculation.arrears,
            calculation.rebate,
            calculation.basic_rate
        );
        calculation.amount_due = calculation.total_amount;
        if (calculation.bill_details) {
            calculation.bill_details.basic_rate = calculation.basic_rate;
        }
        if (calculation.bill_details?.items?.[0]) {
            calculation.bill_details.items[0].current_rate = calculation.current_rate.toFixed(2);
            calculation.bill_details.items[0].basic_rate = calculation.basic_rate.toFixed(2);
            calculation.bill_details.items[0].arrears = calculation.arrears.toFixed(2);
            calculation.bill_details.items[0].rebate = calculation.rebate.toFixed(2);
            calculation.bill_details.items[0].total = calculation.current_rate.toFixed(2);
            calculation.bill_details.items[0].rate_info =
                calculation.bill_details.items[0].rate_info || 'Manual amount at generation';
        }

        // Persist assessed amount back onto the property/business for future bills
        if (amountOverride.current_rate !== undefined && Number(amountOverride.current_rate) >= 0) {
            if (billType === 'PROPERTY_RATE' || billType === 'BUSINESS_PROPERTY') {
                await pool.query(
                    `UPDATE properties SET assessed_amount = $1, updated_at = NOW() WHERE id = $2`,
                    [Number(amountOverride.current_rate), targetId]
                );
            } else {
                await pool.query(
                    `UPDATE businesses SET assessed_amount = $1, updated_at = NOW() WHERE id = $2`,
                    [Number(amountOverride.current_rate), targetId]
                );
            }
        }
    }

    if (billType === 'BOP' && Number(calculation.current_rate || 0) <= 0) {
        throw new Error(
            'Cannot issue a BOP bill with no permit fee. Set Bill Amount on the business (fee item × category, or a custom amount), then try again. The GHS 8 basic rate alone is not enough.'
        );
    }

    // Check if bill already exists for this period
    const existingBill = await pool.query(
        `SELECT id FROM bills
     WHERE bill_type = $1 
       AND bill_period_year = $2
       AND ${billType === 'BOP' ? 'business_id' : 'property_id'} = $3`,
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

    const newBill = result.rows[0];

    // Mark prior unpaid bills as rolled into this bill (prevents double-counting arrears)
    const priorIds = (calculation.prior_bill_ids || []).filter(Boolean);
    if (priorIds.length > 0) {
        await pool.query(
            `UPDATE bills SET rolled_into_bill_id = $1, updated_at = NOW()
             WHERE id = ANY($2::uuid[]) AND rolled_into_bill_id IS NULL`,
            [newBill.id, priorIds]
        );
    }

    return newBill;
};

/**
 * Normalize payment method spellings (CHECK → CHEQUE)
 */
export const normalizePaymentMethod = (method: string): string => {
    const raw = String(method || '').trim().toUpperCase().replace(/\s+/g, '_');
    if (raw === 'CHECK' || raw === 'CHEQUE') return 'CHEQUE';
    return raw || 'CASH';
};

export const isChequePaymentMethod = (method: string): boolean =>
    normalizePaymentMethod(method) === 'CHEQUE';

/**
 * Record a payment against a bill.
 * Cheque payments are stored as PENDING and do not update the bill until cleared.
 */
export const recordPayment = async (
    billId: string,
    customerId: string,
    amount: number,
    paymentMethod: string,
    gcrNumber: string,
    paymentReference?: string,
    recordedBy?: string
): Promise<any> => {
    const client = await pool.connect();
    const method = normalizePaymentMethod(paymentMethod);
    const isCheque = method === 'CHEQUE';

    try {
        await client.query('BEGIN');

        // Get bill details
        const billResult = await client.query(
            'SELECT * FROM bills WHERE id = $1 AND customer_id = $2 FOR UPDATE',
            [billId, customerId]
        );

        if (billResult.rows.length === 0) {
            throw new Error('Bill not found for this customer');
        }

        const bill = billResult.rows[0];

        if (bill.payment_status === 'PAID') {
            throw new Error('Bill is already fully paid');
        }

        const outstanding = parseFloat(bill.total_amount) - parseFloat(bill.amount_paid);
        const pendingResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS pending_total
             FROM payments
             WHERE bill_id = $1 AND clearance_status = 'PENDING'`,
            [billId]
        );
        const pendingTotal = parseFloat(pendingResult.rows[0]?.pending_total) || 0;
        const available = outstanding - pendingTotal;

        if (amount > available + 0.001) {
            const msg =
                pendingTotal > 0
                    ? `Payment amount exceeds available balance of GHS ${available.toFixed(2)} (GHS ${pendingTotal.toFixed(2)} already held by pending cheque(s))`
                    : `Payment amount exceeds outstanding balance of GHS ${outstanding.toFixed(2)}`;
            throw new Error(msg);
        }

        // GCR format: YY/####### — auto-insert slash for mobile digit-only entry
        const gcr = normalizeGcrNumber(gcrNumber);
        if (!isValidGcrNumber(gcr)) {
            throw new Error(
                'Invalid GCR format. Enter 9 digits (2 + 7); slash is added automatically, e.g. 251234567 → 25/1234567'
            );
        }

        const existingGcr = await client.query(
            `SELECT id, receipt_number FROM payments WHERE gcr_number = $1 LIMIT 1`,
            [gcr]
        );
        if (existingGcr.rows.length > 0) {
            throw new Error(
                `GCR ${gcr} is already used on receipt ${existingGcr.rows[0].receipt_number}. Each GCR can only be used once.`
            );
        }

        // Generate receipt number
        const receiptResult = await client.query(
            `SELECT generate_auto_number('RECEIPT', $1) as receipt_number`,
            [new Date().getFullYear()]
        );

        const receiptNumber = receiptResult.rows[0].receipt_number;
        const clearanceStatus = isCheque ? 'PENDING' : 'CLEARED';

        // Insert payment with recorder attribution
        const paymentResult = await client.query(
            `INSERT INTO payments (
        receipt_number, gcr_number, bill_id, customer_id, amount,
        payment_method, payment_reference, recorded_by, clearance_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
            [
                receiptNumber,
                gcr,
                billId,
                customerId,
                amount,
                method,
                paymentReference || null,
                recordedBy || null,
                clearanceStatus,
            ]
        );

        // Cash / MoMo / transfer hit the account immediately; cheques wait for clearance
        if (!isCheque) {
            const newAmountPaid = parseFloat(bill.amount_paid) + amount;
            const newAmountDue = parseFloat(bill.total_amount) - newAmountPaid;

            let newStatus = 'UNPAID';
            if (newAmountDue <= 0) {
                newStatus = 'PAID';
            } else if (newAmountPaid > 0) {
                newStatus = 'PARTIAL';
            }

            await client.query(
                `UPDATE bills SET
        amount_paid = $1,
        amount_due = $2,
        payment_status = $3
       WHERE id = $4`,
                [newAmountPaid, Math.max(newAmountDue, 0), newStatus, billId]
            );
        }

        await client.query('COMMIT');

        return paymentResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Apply a CLEARED payment amount onto its bill (used after cheque approval).
 */
const applyPaymentToBill = async (client: any, billId: string, amount: number) => {
    const billResult = await client.query('SELECT * FROM bills WHERE id = $1 FOR UPDATE', [billId]);
    if (billResult.rows.length === 0) {
        throw new Error('Bill not found');
    }
    const bill = billResult.rows[0];
    const newAmountPaid = parseFloat(bill.amount_paid) + amount;
    const newAmountDue = parseFloat(bill.total_amount) - newAmountPaid;
    let newStatus = 'UNPAID';
    if (newAmountDue <= 0) {
        newStatus = 'PAID';
    } else if (newAmountPaid > 0) {
        newStatus = 'PARTIAL';
    }
    await client.query(
        `UPDATE bills SET
            amount_paid = $1,
            amount_due = $2,
            payment_status = $3,
            updated_at = NOW()
         WHERE id = $4`,
        [newAmountPaid, Math.max(newAmountDue, 0), newStatus, billId]
    );
};

/**
 * Revenue Officer confirms cheque cleared — amount now hits the bill.
 */
export const approveChequePayment = async (
    paymentId: string,
    clearedBy: string,
    clearanceNote?: string
): Promise<any> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const paymentResult = await client.query(
            `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
            [paymentId]
        );
        if (paymentResult.rows.length === 0) {
            throw new Error('Payment not found');
        }
        const payment = paymentResult.rows[0];
        if (payment.clearance_status !== 'PENDING') {
            throw new Error(`Cheque payment is already ${payment.clearance_status}`);
        }
        if (normalizePaymentMethod(payment.payment_method) !== 'CHEQUE') {
            throw new Error('Only cheque payments require clearance approval');
        }

        await applyPaymentToBill(client, payment.bill_id, parseFloat(payment.amount));

        const updated = await client.query(
            `UPDATE payments SET
                clearance_status = 'CLEARED',
                cleared_by = $1,
                cleared_at = NOW(),
                clearance_note = $2
             WHERE id = $3
             RETURNING *`,
            [clearedBy, clearanceNote || null, paymentId]
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Revenue Officer declines a bounced cheque — bill balance unchanged.
 */
export const rejectChequePayment = async (
    paymentId: string,
    clearedBy: string,
    clearanceNote?: string
): Promise<any> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const paymentResult = await client.query(
            `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
            [paymentId]
        );
        if (paymentResult.rows.length === 0) {
            throw new Error('Payment not found');
        }
        const payment = paymentResult.rows[0];
        if (payment.clearance_status !== 'PENDING') {
            throw new Error(`Cheque payment is already ${payment.clearance_status}`);
        }
        if (normalizePaymentMethod(payment.payment_method) !== 'CHEQUE') {
            throw new Error('Only cheque payments can be declined for bounce');
        }

        const updated = await client.query(
            `UPDATE payments SET
                clearance_status = 'REJECTED',
                cleared_by = $1,
                cleared_at = NOW(),
                clearance_note = $2
             WHERE id = $3
             RETURNING *`,
            [clearedBy, clearanceNote || 'Cheque bounced', paymentId]
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const listChequePayments = async (status = 'PENDING', limit = 100): Promise<any[]> => {
    const result = await pool.query(
        `SELECT p.*,
            b.bill_number, b.bill_type, b.amount_due as bill_amount_due,
            c.full_name as customer_name, c.phone_number as customer_phone,
            rec.full_name as recorded_by_name,
            clr.full_name as cleared_by_name
         FROM payments p
         LEFT JOIN bills b ON p.bill_id = b.id
         LEFT JOIN customers c ON p.customer_id = c.id
         LEFT JOIN system_users rec ON p.recorded_by = rec.id
         LEFT JOIN system_users clr ON p.cleared_by = clr.id
         WHERE UPPER(p.payment_method) IN ('CHEQUE', 'CHECK')
           AND p.clearance_status = $1
         ORDER BY p.created_at ASC
         LIMIT $2`,
        [status, limit]
    );
    return result.rows;
};

export default {
    BASIC_RATE_GHC,
    billTotal,
    syncBillDetailsAmounts,
    syncLatestBillAmounts,
    normalizeGcrNumber,
    isValidGcrNumber,
    normalizePaymentMethod,
    isChequePaymentMethod,
    calculatePropertyBill,
    calculateBusinessBill,
    generateBill,
    recordPayment,
    approveChequePayment,
    rejectChequePayment,
    listChequePayments,
};
