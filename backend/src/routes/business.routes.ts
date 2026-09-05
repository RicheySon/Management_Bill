import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, authorize, AuthRequest, getCollectorAreaFilter } from '../middlewares/auth.middleware';
import { generateBill } from '../services/billing.service';
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
const businessSchema = Joi.object({
    business_name: Joi.string().required().max(200),
    customer_id: Joi.string().uuid().required(),
    category_id: Joi.number().integer().optional().allow(null),
    business_activity: Joi.string().required(),
    business_contact: Joi.string().optional().allow('').max(20),
    business_type_main: Joi.string().optional().allow(''),
    business_type_sub: Joi.string().optional().allow(''),
    business_category_class: Joi.string().valid('Category A', 'Category B', 'Category C', 'Category D', '').optional().allow(''),
    business_email: Joi.string().email().optional().allow(''),
    description: Joi.string().optional().allow(''),
    account_number: Joi.string().optional().allow(''),
    division_number: Joi.string().optional().allow(''),
    block_number: Joi.string().optional().allow(''),
    property_id: Joi.string().uuid().optional().allow('', null),
    street_name: Joi.string().optional().allow(''),
    gps_address: Joi.string().optional().allow('').max(50),
    latitude: Joi.number().precision(8).min(-90).max(90).optional().allow(null, ''),
    longitude: Joi.number().precision(8).min(-180).max(180).optional().allow(null, ''),
    town: Joi.string().optional().allow(''),
    physical_location: Joi.string().optional().allow(''),
    landmark: Joi.string().optional().allow(''),
    electoral_area_id: Joi.number().integer().optional().allow(null, ''),
    local_area_id: Joi.number().integer().optional().allow(null, ''),
    year_registered: Joi.number().integer().min(2000).max(2100).optional(),
    fee_item_id: Joi.number().integer().optional().allow(null, ''),
    assessed_amount: Joi.number().min(0).optional().allow(null, ''),
});

/**
 * POST /api/businesses
 * Register a new business
 */
router.post('/', authorize(['register_business']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = businessSchema.validate(req.body);

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
            electoral_area_id,
            local_area_id,
            year_registered,
            fee_item_id,
            assessed_amount,
        } = value;

        const currentYear = new Date().getFullYear();
        const regYear = year_registered || currentYear;
        const assessed =
            assessed_amount === '' || assessed_amount === undefined || assessed_amount === null
                ? null
                : Number(assessed_amount);

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
                business_activity,
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
                    { current_rate: assessed as number, arrears: 0, rebate: 0 }
                );
            } catch (billError: any) {
                console.error('Auto bill generation failed after business registration:', billError);
            }
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
            LEFT JOIN electoral_areas ea ON b.electoral_area_id = ea.id
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

        const areaFilter = getCollectorAreaFilter(req, 'b.electoral_area_id', paramIndex);
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
            business_activity: Joi.string().optional(),
            business_contact: Joi.string().optional().allow('').max(20),
            business_type_main: Joi.string().optional().allow(''),
            business_type_sub: Joi.string().optional().allow(''),
            business_category_class: Joi.string().valid('Category A', 'Category B', 'Category C', 'Category D', '').optional().allow(''),
            business_email: Joi.string().email().optional().allow(''),
            description: Joi.string().optional().allow(''),
            account_number: Joi.string().optional().allow(''),
            division_number: Joi.string().optional().allow(''),
            block_number: Joi.string().optional().allow(''),
            street_name: Joi.string().optional().allow(''),
            gps_address: Joi.string().optional().allow('').max(50),
            latitude: Joi.number().precision(8).min(-90).max(90).optional().allow(null, ''),
            longitude: Joi.number().precision(8).min(-180).max(180).optional().allow(null, ''),
            town: Joi.string().optional().allow(''),
            physical_location: Joi.string().optional().allow(''),
            landmark: Joi.string().optional().allow(''),
            electoral_area_id: Joi.number().integer().optional().allow(null, ''),
            local_area_id: Joi.number().integer().optional().allow(null, ''),
            fee_item_id: Joi.number().integer().optional().allow(null, ''),
            status: Joi.string().valid('ACTIVE', 'INACTIVE', 'CLOSED').optional(),
        });

        const { error, value } = updateSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const fields = Object.keys(value);
        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        const values = Object.values(value);
        values.push(id);

        const result = await pool.query(
            `UPDATE businesses SET ${setClause} WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Business not found',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Business updated successfully',
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
