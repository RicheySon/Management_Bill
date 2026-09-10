import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, authorize, AuthRequest, getCollectorAreaFilter, resolveElectoralAreaId } from '../middlewares/auth.middleware';
import { generateBill, syncLatestBillAmounts } from '../services/billing.service';
import { ensureCustomerCodesReady } from '../services/customer-code-schema.service';
import Joi from 'joi';

const outstandingStatuses = new Set(['UNPAID', 'PARTIAL', 'OVERDUE']);

function summarizeBills(bills: any[]) {
    const total_outstanding = bills
        .filter((b) => outstandingStatuses.has(b.payment_status))
        .reduce((sum, b) => sum + (parseFloat(b.amount_due) || 0), 0);
    const total_paid = bills.reduce((sum, b) => sum + (parseFloat(b.amount_paid) || 0), 0);
    return { total_outstanding, total_paid };
}

const router = Router();

// Apply authentication to all business routes
router.use(authenticateToken);

/**
 * Validation Schema
 */
const optionalText = () => Joi.string().optional().allow('', null);
const optionalEmail = () =>
    Joi.string().email({ tlds: { allow: false } }).optional().allow('', null);

const businessSchema = Joi.object({
    business_name: Joi.string().required().max(200),
    customer_id: Joi.string().uuid().required(),
    category_id: Joi.number().integer().optional().allow(null),
    business_activity: optionalText(),
    business_contact: Joi.string().optional().allow('', null).max(20),
    business_type_main: optionalText(),
    business_type_sub: optionalText(),
    business_category_class: Joi.string().valid('Category A', 'Category B', 'Category C', 'Category D', '').optional().allow('', null),
    business_email: optionalEmail(),
    description: optionalText(),
    account_number: optionalText(),
    division_number: optionalText(),
    block_number: optionalText(),
    property_id: Joi.string().uuid().optional().allow('', null),
    street_name: optionalText(),
    gps_address: Joi.string().optional().allow('', null).max(50),
    latitude: Joi.number().precision(8).min(-90).max(90).optional().allow(null, ''),
    longitude: Joi.number().precision(8).min(-180).max(180).optional().allow(null, ''),
    town: optionalText(),
    physical_location: optionalText(),
    landmark: optionalText(),
    electoral_area_id: Joi.number().integer().optional().allow(null, ''),
    local_area_id: Joi.number().integer().optional().allow(null, ''),
    year_registered: Joi.number().integer().min(2000).max(2100).optional(),
    fee_item_id: Joi.number().integer().optional().allow(null, ''),
    assessed_amount: Joi.number().min(0).optional().allow(null, ''),
    arrears: Joi.number().min(0).optional().allow(null, ''),
});

/** Coerce null/undefined optional strings so Joi never sees bare null as non-string. */
function normalizeBusinessPayload(body: Record<string, any>) {
    const out = { ...body };
    const textKeys = [
        'business_activity', 'business_contact', 'business_type_main', 'business_type_sub',
        'business_category_class', 'business_email', 'description', 'account_number',
        'division_number', 'block_number', 'street_name', 'gps_address', 'town',
        'physical_location', 'landmark',
    ];
    for (const key of textKeys) {
        if (out[key] === null || out[key] === undefined) out[key] = '';
    }
    return out;
}

async function applyArrearsToLatestBill(
    entityColumn: 'property_id' | 'business_id',
    entityId: string,
    arrears: number
) {
    return syncLatestBillAmounts(entityColumn, entityId, { arrears });
}

async function applyAssessedAmountToLatestBill(
    entityColumn: 'property_id' | 'business_id',
    entityId: string,
    current_rate: number,
    description?: string
) {
    return syncLatestBillAmounts(entityColumn, entityId, {
        current_rate,
        description,
    });
}

/**
 * POST /api/businesses
 * Register a new business
 */
router.post('/', authorize(['register_business']), async (req: AuthRequest, res: Response) => {
    try {
        await ensureCustomerCodesReady();
        const { error, value } = businessSchema.validate(normalizeBusinessPayload(req.body));

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const {
            business_name,
            customer_id,
            category_id,
            business_activity,
            business_contact,
            business_type_main,
            business_type_sub,
            business_category_class,
            business_email,
            description,
            account_number,
            division_number,
            block_number,
            property_id,
            street_name,
            gps_address,
            latitude,
            longitude,
            town,
            physical_location,
            landmark,
            electoral_area_id: electoralAreaRaw,
            local_area_id,
            year_registered,
            fee_item_id,
            assessed_amount,
            arrears,
        } = value;

        const electoral_area_id = await resolveElectoralAreaId(electoralAreaRaw, local_area_id);

        const currentYear = new Date().getFullYear();
        const regYear = year_registered || currentYear;
        const assessed =
            assessed_amount === '' || assessed_amount === undefined || assessed_amount === null
                ? null
                : Number(assessed_amount);
        const arrearsValue =
            arrears === '' || arrears === undefined || arrears === null
                ? 0
                : Math.max(0, Number(arrears) || 0);

        const result = await pool.query(
            `INSERT INTO businesses (
                business_name, customer_id, category_id, business_activity,
                business_contact, business_type_main, business_type_sub,
                business_category_class, business_email, description,
                account_number, division_number, block_number,
                property_id, street_name, gps_address, latitude, longitude, town, physical_location,
                landmark, electoral_area_id, local_area_id, year_registered, fee_item_id, assessed_amount
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
            RETURNING *`,
            [
                business_name,
                customer_id,
                category_id || null,
                business_activity || '',
                business_contact || null,
                business_type_main || null,
                business_type_sub || null,
                business_category_class || null,
                business_email || null,
                description || null,
                account_number || null,
                division_number || null,
                block_number || null,
                property_id || null,
                street_name || null,
                gps_address || null,
                latitude || null,
                longitude || null,
                town || null,
                physical_location || null,
                landmark || null,
                electoral_area_id || null,
                local_area_id || null,
                regYear,
                fee_item_id || null,
                Number.isFinite(assessed as number) ? assessed : null,
            ]
        );

        const businessId = result.rows[0].id;
        let initialBill: any = null;

        // Auto-issue registration-year BOP bill when an assessed amount was provided
        if (Number.isFinite(assessed as number) && (assessed as number) > 0) {
            try {
                initialBill = await generateBill(
                    'BOP',
                    businessId,
                    customer_id,
                    regYear,
                    { current_rate: assessed as number, arrears: arrearsValue, rebate: 0 }
                );
            } catch (billError: any) {
                console.error('Auto bill generation failed after business registration:', billError);
            }
        } else if (!Number.isFinite(assessed as number) || (assessed as number) <= 0) {
            console.warn(
                `Business ${businessId} registered without a positive assessed_amount; no BOP bill auto-issued`
            );
        }

        const businessWithDetails = await pool.query(
            `SELECT b.*,
                c.full_name as owner_name,
                c.phone_number as owner_phone,
                bc.name as category_name,
                bc.base_fee,
                p.property_number,
                ea.name as electoral_area_name,
                la.name as local_area_name
            FROM businesses b
            LEFT JOIN customers c ON b.customer_id = c.id
            LEFT JOIN business_categories bc ON b.category_id = bc.id
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN electoral_areas ea ON b.electoral_area_id = ea.id
            LEFT JOIN local_areas la ON b.local_area_id = la.id
            WHERE b.id = $1`,
            [businessId]
        );

        const businessNumber = businessWithDetails.rows[0].business_number;
        const message = initialBill
            ? `Business registered successfully. BOP Number: ${businessNumber}. ${regYear} bill ${initialBill.bill_number} issued for GHS ${Number(initialBill.total_amount).toFixed(2)}.`
            : `Business registered successfully. BOP Number: ${businessNumber}`;

        res.status(201).json({
            success: true,
            data: businessWithDetails.rows[0],
            bill: initialBill,
            message,
        });
    } catch (error: any) {
        console.error('Error creating business:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register business',
        });
    }
});

/**
 * GET /api/businesses/:id
 * Get business details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT b.*,
                c.full_name as owner_name,
                c.phone_number as owner_phone,
                c.gps_address as owner_gps,
                bc.name as category_name,
                bc.base_fee,
                p.property_number,
                ea.name as electoral_area_name,
                la.name as local_area_name
            FROM businesses b
            LEFT JOIN customers c ON b.customer_id = c.id
            LEFT JOIN business_categories bc ON b.category_id = bc.id
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN electoral_areas ea ON b.electoral_area_id = ea.id
            LEFT JOIN local_areas la ON b.local_area_id = la.id
            WHERE b.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Business not found',
            });
        }

        const billsResult = await pool.query(
            `SELECT * FROM bills
            WHERE business_id = $1
            ORDER BY issue_date DESC`,
            [id]
        );

        const bills = billsResult.rows;
        const { total_outstanding, total_paid } = summarizeBills(bills);

        res.json({
            success: true,
            data: {
                business: {
                    ...result.rows[0],
                    total_outstanding,
                    total_paid,
                },
                bills,
            },
        });
    } catch (error: any) {
        console.error('Error fetching business:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business details',
        });
    }
});

/**
 * GET /api/businesses
 * List businesses with filters
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            search,
            category_id,
            electoral_area_id,
            customer_id,
            status = 'ACTIVE',
            page = 1,
            limit = 50,
        } = req.query;

        let query = `
            SELECT b.*,
                c.full_name as owner_name,
                c.phone_number as owner_phone,
                bc.name as category_name,
                ea.name as electoral_area_name
            FROM businesses b
            LEFT JOIN customers c ON b.customer_id = c.id
            LEFT JOIN business_categories bc ON b.category_id = bc.id
            LEFT JOIN local_areas la ON b.local_area_id = la.id
            LEFT JOIN electoral_areas ea ON COALESCE(b.electoral_area_id, la.electoral_area_id) = ea.id
            WHERE 1=1
        `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND b.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (search) {
            query += ` AND (b.business_number ILIKE $${paramIndex} OR b.business_name ILIKE $${paramIndex} OR c.full_name ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        if (category_id) {
            query += ` AND b.category_id = $${paramIndex}`;
            queryParams.push(category_id);
            paramIndex++;
        }

        if (electoral_area_id) {
            query += ` AND b.electoral_area_id = $${paramIndex}`;
            queryParams.push(electoral_area_id);
            paramIndex++;
        }

        const areaFilter = getCollectorAreaFilter(
            req,
            'COALESCE(b.electoral_area_id, la.electoral_area_id)',
            paramIndex,
            'b.local_area_id'
        );
        query += areaFilter.clause;
        queryParams.push(...areaFilter.params);
        paramIndex = areaFilter.nextIndex;

        if (customer_id) {
            query += ` AND b.customer_id = $${paramIndex}`;
            queryParams.push(customer_id);
            paramIndex++;
        }

        query += ` ORDER BY b.created_at DESC`;

        const offset = (Number(page) - 1) * Number(limit);
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(Number(limit), offset);

        const result = await pool.query(query, queryParams);

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM businesses WHERE status = $1',
            [status]
        );
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        console.error('Error listing businesses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch businesses',
        });
    }
});

/**
 * PUT /api/businesses/:id
 * Update business information
 */
router.put('/:id', authorize(['edit_business']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const updateSchema = Joi.object({
            business_name: Joi.string().optional().max(200),
            category_id: Joi.number().integer().optional().allow(null),
            business_activity: optionalText(),
            business_contact: Joi.string().optional().allow('', null).max(20),
            business_type_main: optionalText(),
            business_type_sub: optionalText(),
            business_category_class: Joi.string().valid('Category A', 'Category B', 'Category C', 'Category D', '').optional().allow('', null),
            business_email: optionalEmail(),
            description: optionalText(),
            account_number: optionalText(),
            division_number: optionalText(),
            block_number: optionalText(),
            street_name: optionalText(),
            gps_address: Joi.string().optional().allow('', null).max(50),
            latitude: Joi.number().precision(8).min(-90).max(90).optional().allow(null, ''),
            longitude: Joi.number().precision(8).min(-180).max(180).optional().allow(null, ''),
            town: optionalText(),
            physical_location: optionalText(),
            landmark: optionalText(),
            electoral_area_id: Joi.number().integer().optional().allow(null, ''),
            local_area_id: Joi.number().integer().optional().allow(null, ''),
            fee_item_id: Joi.number().integer().optional().allow(null, ''),
            assessed_amount: Joi.number().min(0).optional().allow(null, ''),
            arrears: Joi.number().min(0).optional().allow(null, ''),
            status: Joi.string().valid('ACTIVE', 'INACTIVE', 'CLOSED').optional(),
        });

        const { error, value } = updateSchema.validate(normalizeBusinessPayload(req.body));

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const arrearsInput = value.arrears;
        delete value.arrears;

        // Normalize empty assessed_amount to null
        if (value.assessed_amount === '' || value.assessed_amount === undefined) {
            // leave unset if not provided
        } else if (value.assessed_amount === null) {
            value.assessed_amount = null;
        } else {
            value.assessed_amount = Number(value.assessed_amount);
        }

        // Empty optional text → null (except business_activity which is NOT NULL)
        for (const key of Object.keys(value)) {
            if (typeof value[key] === 'string' && value[key].trim() === '' && key !== 'business_activity') {
                value[key] = null;
            }
        }
        if (value.business_activity === null || value.business_activity === undefined) {
            value.business_activity = '';
        }

        if ('electoral_area_id' in value || 'local_area_id' in value) {
            value.electoral_area_id = await resolveElectoralAreaId(
                value.electoral_area_id,
                value.local_area_id
            );
        }

        const fields = Object.keys(value);
        if (fields.length === 0 && (arrearsInput === undefined || arrearsInput === '' || arrearsInput === null)) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        let resultRows: any[] = [];
        if (fields.length > 0) {
            const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
            const values = Object.values(value);
            values.push(id);

            const result = await pool.query(
                `UPDATE businesses SET ${setClause} WHERE id = $${values.length} RETURNING *`,
                values
            );
            resultRows = result.rows;
        } else {
            const existing = await pool.query('SELECT * FROM businesses WHERE id = $1', [id]);
            resultRows = existing.rows;
        }

        if (resultRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Business not found',
            });
        }

        let updatedBill = null;
        const billSyncNotes: string[] = [];
        const subLabel =
            String(resultRows[0].business_type_sub || '').trim() ||
            undefined;

        if (
            value.assessed_amount !== undefined &&
            value.assessed_amount !== null &&
            Number.isFinite(Number(value.assessed_amount))
        ) {
            updatedBill = await applyAssessedAmountToLatestBill(
                'business_id',
                id,
                Number(value.assessed_amount),
                subLabel
            );
            if (updatedBill) {
                billSyncNotes.push(
                    `current rate set to GHS ${Number(updatedBill.current_rate).toFixed(2)}`
                );
            }
        }

        if (arrearsInput !== undefined && arrearsInput !== '' && arrearsInput !== null) {
            const arrearsNum = Math.max(0, Number(arrearsInput) || 0);
            updatedBill = await applyArrearsToLatestBill('business_id', id, arrearsNum);
            if (updatedBill) {
                billSyncNotes.push(`arrears set to GHS ${Number(updatedBill.arrears).toFixed(2)}`);
            }
        }

        res.json({
            success: true,
            data: resultRows[0],
            bill: updatedBill,
            message: updatedBill
                ? `Business updated. Bill ${updatedBill.bill_number}: ${billSyncNotes.join('; ')} (total GHS ${Number(updatedBill.total_amount).toFixed(2)} incl. basic rate).`
                : 'Business updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating business:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update business',
        });
    }
});

export default router;
