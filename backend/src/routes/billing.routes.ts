import { Router, Response } from 'express';
import Joi from 'joi';
import { generateBill, recordPayment } from '../services/billing.service';
import { authenticateToken, authorize, AuthRequest, getCollectorAreaFilter } from '../middlewares/auth.middleware';
import pool from '../config/database';
import { createAmountChangeRequest } from '../services/amount-change.service';
import { getAuditContext, logAction } from '../services/audit.service';

const router = Router();

// Apply authentication to all billing routes
router.use(authenticateToken);

/**
 * POST /api/bills/generate
 * Generate a new bill for property or business
 */
router.post('/generate', authenticateToken, authorize(['generate_bill']), async (req: AuthRequest, res: Response) => {
    try {
        const schema = Joi.object({
            bill_type: Joi.string().valid('PROPERTY_RATE', 'BOP').required(),
            target_id: Joi.string().uuid().required(), // property_id or business_id
            customer_id: Joi.string().uuid().required(),
            bill_year: Joi.number().integer().min(2000).max(2100).optional(),
        });

        const { error, value } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const { bill_type, target_id, customer_id, bill_year } = value;

        const bill = await generateBill(bill_type, target_id, customer_id, bill_year);

        await logAction(
            req.user!.id,
            'BILL_GENERATED',
            'bills',
            bill.id,
            null,
            { bill_number: bill.bill_number, bill_type, total_amount: bill.total_amount },
            getAuditContext(req)
        );

        res.status(201).json({
            success: true,
            data: bill,
            message: `Bill generated successfully. Bill Number: ${bill.bill_number}`,
        });
    } catch (error: any) {
        console.error('Error generating bill:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate bill',
        });
    }
});

/**
 * PUT /api/bills/:id/amounts
 * Request amount change — never applies directly (Super Admin approval required).
 */
router.put('/:id/amounts', async (req: AuthRequest, res: Response) => {
    try {
        const perms = req.user?.permissions || [];
        const can =
            perms.includes('generate_bill') ||
            perms.includes('delete_bill') ||
            perms.includes('configure_rates') ||
            perms.includes('approve_amount_changes');
        if (!can) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        const schema = Joi.object({
            current_rate: Joi.number().min(0).optional(),
            arrears: Joi.number().min(0).optional(),
            rebate: Joi.number().min(0).optional(),
            total_amount: Joi.number().min(0).optional(),
            reason: Joi.string().allow('', null).optional(),
        }).or('current_rate', 'arrears', 'rebate', 'total_amount');

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const { reason, ...proposed } = value;
        const request = await createAmountChangeRequest({
            entityType: 'BILL',
            entityId: req.params.id,
            proposedValues: proposed,
            reason,
            requestedBy: req.user!.id,
            auditCtx: getAuditContext(req),
        });

        res.status(201).json({
            success: true,
            message: 'Amount change submitted for Super Admin approval',
            data: request,
        });
    } catch (error: any) {
        console.error('Error requesting bill amount change:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to request amount change' });
    }
});

/**
 * POST /api/bills/preview
 * Calculate bill amounts without saving
 */
router.post('/preview', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const schema = Joi.object({
            bill_type: Joi.string().valid('PROPERTY_RATE', 'BOP').required(),
            target_id: Joi.string().uuid().required(),
            customer_id: Joi.string().uuid().required(),
            bill_year: Joi.number().integer().min(2000).max(2100).optional(),
        });

        const { error, value } = schema.validate(req.body);
        if (error) return res.status(400).json({ success: false, error: error.details[0].message });

        const { bill_type, target_id, bill_year } = value;
        const year = bill_year || new Date().getFullYear();

        let calculation;
        if (bill_type === 'PROPERTY_RATE') {
            const { calculatePropertyBill } = require('../services/billing.service');
            calculation = await calculatePropertyBill(target_id, year);
        } else {
            const { calculateBusinessBill } = require('../services/billing.service');
            calculation = await calculateBusinessBill(target_id, year);
        }

        res.json({
            success: true,
            data: calculation,
        });
    } catch (error: any) {
        console.error('Error previewing bill:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to calculate preview',
        });
    }
});

/**
 * GET /api/bills/:id
 * Get bill details with customer info
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT b.*,
                c.full_name, c.phone_number, c.gps_address as customer_gps,
                p.property_number, p.street_name, p.gps_address as property_gps,
                p.landmark as property_landmark,
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
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bill not found',
            });
        }

        // Get payments for this bill (include recorder name)
        const paymentsResult = await pool.query(
            `SELECT p.*, u.full_name as recorded_by_name
             FROM payments p
             LEFT JOIN system_users u ON p.recorded_by = u.id
             WHERE p.bill_id = $1
             ORDER BY p.payment_date DESC, p.created_at DESC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                bill: result.rows[0],
                payments: paymentsResult.rows,
            },
        });
    } catch (error: any) {
        console.error('Error fetching bill:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bill details',
        });
    }
});

/**
 * GET /api/bills/customer/:customerId
 * Get all bills for a customer
 */
router.get('/customer/:customerId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { customerId } = req.params;
        const { status, bill_type } = req.query;

        let query = `
            SELECT b.*,
                p.property_number,
                bus.business_number, bus.business_name
            FROM bills b
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN businesses bus ON b.business_id = bus.id
            WHERE b.customer_id = $1
        `;

        const queryParams: any[] = [customerId];
        let paramIndex = 2;

        if (status) {
            query += ` AND b.payment_status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (bill_type) {
            query += ` AND b.bill_type = $${paramIndex}`;
            queryParams.push(bill_type);
        }

        query += ` ORDER BY b.issue_date DESC`;

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching customer bills:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bills',
        });
    }
});

/**
 * GET /api/bills
 * List all bills with filters
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const {
            status,
            bill_type,
            electoral_area_id,
            year,
            search,
            page = 1,
            limit = 50,
        } = req.query;

        let query = `
            SELECT b.*,
                c.full_name,
                p.property_number,
                bus.business_number, bus.business_name,
                ea.name as electoral_area
            FROM bills b
            LEFT JOIN customers c ON b.customer_id = c.id
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN businesses bus ON b.business_id = bus.id
            LEFT JOIN electoral_areas ea ON COALESCE(p.electoral_area_id, bus.electoral_area_id) = ea.id
            WHERE 1 = 1
        `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND b.payment_status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (bill_type) {
            query += ` AND b.bill_type = $${paramIndex}`;
            queryParams.push(bill_type);
            paramIndex++;
        }

        if (year) {
            query += ` AND b.bill_period_year = $${paramIndex}`;
            queryParams.push(year);
            paramIndex++;
        }

        if (electoral_area_id) {
            query += ` AND (p.electoral_area_id = $${paramIndex} OR bus.electoral_area_id = $${paramIndex})`;
            queryParams.push(electoral_area_id);
            paramIndex++;
        }

        const areaFilter = getCollectorAreaFilter(
            req,
            'COALESCE(p.electoral_area_id, bus.electoral_area_id, c.electoral_area_id)',
            paramIndex
        );
        query += areaFilter.clause;
        queryParams.push(...areaFilter.params);
        paramIndex = areaFilter.nextIndex;

        if (search) {
            query += ` AND (b.bill_number ILIKE $${paramIndex} OR c.full_name ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY b.issue_date DESC`;

        // Pagination
        const offset = (Number(page) - 1) * Number(limit);
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(Number(limit), offset);

        const result = await pool.query(query, queryParams);

        // Get total
        const countResult = await pool.query('SELECT COUNT(*) FROM bills');
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
        console.error('Error listing bills:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list bills',
        });
    }
});

/**
 * DELETE /api/bills/:id
 * Delete a bill (direct permission). Roles without delete_bill must request approval.
 */
router.delete('/:id', authenticateToken, authorize(['delete_bill']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM payments WHERE bill_id = $1', [id]);
        await pool.query(
            'UPDATE bills SET rolled_into_bill_id = NULL WHERE rolled_into_bill_id = $1',
            [id]
        );
        const result = await pool.query('DELETE FROM bills WHERE id = $1 RETURNING id, bill_number', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bill not found',
            });
        }

        await logAction(
            req.user!.id,
            'BILL_DELETED',
            'bills',
            id,
            { bill_number: result.rows[0].bill_number },
            null,
            getAuditContext(req)
        );

        res.json({
            success: true,
            message: 'Bill deleted successfully',
        });
    } catch (error: any) {
        console.error('Error deleting bill:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete bill',
        });
    }
});

/**
 * POST /api/bills/:id/payment
 * Record a payment for a bill
 */
router.post('/:id/payment', authenticateToken, authorize(['record_payment']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const schema = Joi.object({
            customer_id: Joi.string().uuid().required(),
            amount: Joi.number().positive().required(),
            payment_method: Joi.string().required(),
            gcr_number: Joi.string().trim().min(4).max(20).required()
                .pattern(/^[A-Za-z0-9][A-Za-z0-9\-]{3,19}$/)
                .messages({
                    'string.pattern.base':
                        'GCR must be 4–20 characters (letters, numbers, hyphens). Example: 012345 or GCR-012345',
                }),
            payment_reference: Joi.string().optional().allow(''),
        });

        const { error, value } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const { customer_id, amount, payment_method, gcr_number, payment_reference } = value;

        const payment = await recordPayment(
            id,
            customer_id,
            amount,
            payment_method,
            gcr_number,
            payment_reference,
            req.user!.id
        );

        await logAction(
            req.user!.id,
            'PAYMENT_RECORDED',
            'payments',
            payment.id,
            null,
            {
                bill_id: id,
                amount,
                gcr_number: payment.gcr_number,
                receipt_number: payment.receipt_number,
                recorded_by: req.user!.id,
            },
            getAuditContext(req)
        );

        res.status(201).json({
            success: true,
            data: payment,
            message: `Payment recorded successfully. Receipt Number: ${payment.receipt_number}`,
        });
    } catch (error: any) {
        console.error('Error recording payment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to record payment',
        });
    }
});

export default router;
