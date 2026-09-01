import { Router, Request, Response } from 'express';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import pool from '../config/database';

const router = Router();

// Apply authentication to all reports routes
router.use(authenticateToken);

const requireReportsOrPayment = (req: AuthRequest, res: Response, next: Function) => {
    const perms = req.user?.permissions || [];
    if (perms.includes('view_reports') || perms.includes('record_payment') || perms.includes('manage_users')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        error: 'Permission denied. You do not have the required access for this action.',
    });
};

/**
 * GET /api/reports/revenue
 * Revenue summary report
 */
router.get('/revenue', authorize(['view_reports']), async (req: Request, res: Response) => {
    try {
        const { period = 'month', year, month } = req.query;

        let query = `
      SELECT 
        DATE_TRUNC($1, b.issue_date) as period,
        b.bill_type,
        COUNT(*) as bill_count,
        SUM(b.total_amount) as total_billed,
        SUM(b.amount_paid) as total_collected,
        SUM(b.amount_due) as total_outstanding
      FROM bills b
      WHERE 1=1
    `;

        const queryParams: any[] = [period];
        let paramIndex = 2;

        if (year) {
            query += ` AND EXTRACT(YEAR FROM b.issue_date) = $${paramIndex}`;
            queryParams.push(year);
            paramIndex++;
        }

        if (month) {
            query += ` AND EXTRACT(MONTH FROM b.issue_date) = $${paramIndex}`;
            queryParams.push(month);
            paramIndex++;
        }

        query += ` GROUP BY DATE_TRUNC($1, b.issue_date), b.bill_type ORDER BY period DESC`;

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching revenue report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch revenue report',
        });
    }
});

/**
 * GET /api/reports/defaulters
 * List of customers with unpaid bills
 */
router.get('/defaulters', authorize(['view_reports']), async (req: Request, res: Response) => {
    try {
        const { electoral_area_id, bill_type } = req.query;

        let query = `
      SELECT 
        c.id,
        c.full_name,
        c.phone_number,
        ea.name as electoral_area,
        COUNT(b.id) as unpaid_bill_count,
        SUM(b.amount_due) as total_outstanding
      FROM customers c
      INNER JOIN bills b ON c.id = b.customer_id
      LEFT JOIN electoral_areas ea ON c.electoral_area_id = ea.id
      WHERE b.payment_status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
    `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (electoral_area_id) {
            query += ` AND c.electoral_area_id = $${paramIndex}`;
            queryParams.push(electoral_area_id);
            paramIndex++;
        }

        if (bill_type) {
            query += ` AND b.bill_type = $${paramIndex}`;
            queryParams.push(bill_type);
        }

        query += ` GROUP BY c.id, c.full_name, c.phone_number, ea.name ORDER BY total_outstanding DESC`;

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching defaulters report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch defaulters report',
        });
    }
});

/**
 * GET /api/reports/by-area
 * Revenue grouped by electoral area
 */
router.get('/by-area', authorize(['view_reports']), async (req: Request, res: Response) => {
    try {
        const { year } = req.query;

        let query = `
      SELECT 
        ea.name as electoral_area,
        COUNT(DISTINCT c.id) as customer_count,
        COUNT(b.id) as bill_count,
        SUM(b.total_amount) as total_billed,
        SUM(b.amount_paid) as total_collected,
        SUM(b.amount_due) as total_outstanding
      FROM electoral_areas ea
      LEFT JOIN customers c ON ea.id = c.electoral_area_id
      LEFT JOIN bills b ON c.id = b.customer_id
      WHERE 1=1
    `;

        const queryParams: any[] = [];

        if (year) {
            query += ` AND b.bill_period_year = $1`;
            queryParams.push(year);
        }

        query += ` GROUP BY ea.name ORDER BY total_collected DESC`;

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching area report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch area report',
        });
    }
});

/**
 * GET /api/reports/by-category
 * BOP revenue grouped by business category
 */
router.get('/by-category', authorize(['view_reports']), async (req: Request, res: Response) => {
    try {
        const { year } = req.query;

        let query = `
      SELECT 
        bc.name as category,
        COUNT(DISTINCT bus.id) as business_count,
        COUNT(b.id) as bill_count,
        SUM(b.total_amount) as total_billed,
        SUM(b.amount_paid) as total_collected,
        SUM(b.amount_due) as total_outstanding
      FROM business_categories bc
      LEFT JOIN businesses bus ON bc.id = bus.category_id
      LEFT JOIN bills b ON bus.id = b.business_id
      WHERE b.bill_type = 'BOP'
    `;

        const queryParams: any[] = [];

        if (year) {
            query += ` AND b.bill_period_year = $1`;
            queryParams.push(year);
        }

        query += ` GROUP BY bc.name ORDER BY total_collected DESC`;

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching category report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch category report',
        });
    }
});

/**
 * GET /api/reports/dashboard
 * Summary statistics for admin dashboard
 */
router.get('/dashboard', requireReportsOrPayment, async (req: Request, res: Response) => {
    try {
        const currentYear = new Date().getFullYear();

        // Total revenue this year
        const revenueResult = await pool.query(
            `SELECT 
        COALESCE(SUM(total_amount), 0) as total_billed,
        COALESCE(SUM(amount_paid), 0) as total_collected,
        COALESCE(SUM(amount_due), 0) as total_outstanding
       FROM bills
       WHERE bill_period_year = $1`,
            [currentYear]
        );

        // Customer counts
        const customerResult = await pool.query(
            'SELECT COUNT(*) as total_customers FROM customers'
        );

        // Property counts
        const propertyResult = await pool.query(
            `SELECT COUNT(*) as total_properties FROM properties WHERE status = 'ACTIVE'`
        );

        // Business counts
        const businessResult = await pool.query(
            `SELECT COUNT(*) as total_businesses FROM businesses WHERE status = 'ACTIVE'`
        );

        // Unpaid bills
        const unpaidResult = await pool.query(
            `SELECT COUNT(*) as unpaid_count FROM bills WHERE payment_status != 'PAID'`
        );

        // Recent payments (last 10) with recorder name
        const paymentsResult = await pool.query(
            `SELECT p.*, c.full_name, b.bill_number, u.full_name as recorded_by_name
       FROM payments p
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN bills b ON p.bill_id = b.id
       LEFT JOIN system_users u ON p.recorded_by = u.id
       ORDER BY p.created_at DESC NULLS LAST, p.payment_date DESC
       LIMIT 10`
        );

        res.json({
            success: true,
            data: {
                revenue: revenueResult.rows[0],
                counts: {
                    customers: parseInt(customerResult.rows[0].total_customers),
                    properties: parseInt(propertyResult.rows[0].total_properties),
                    businesses: parseInt(businessResult.rows[0].total_businesses),
                    unpaid_bills: parseInt(unpaidResult.rows[0].unpaid_count),
                },
                recent_payments: paymentsResult.rows,
            },
        });
    } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
        });
    }
});

export default router;
