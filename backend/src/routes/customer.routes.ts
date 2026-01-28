import { Router, Request, Response } from 'express';
import pool from '../config/database';
import Joi from 'joi';

const router = Router();

/**
 * Validation Schemas
 */
const customerSchema = Joi.object({
    full_name: Joi.string().required().max(200),
    phone_number: Joi.string().required().max(20),
    email: Joi.string().email().optional().allow(''),
    gps_address: Joi.string().optional().allow('').max(50),
    physical_location: Joi.string().optional().allow(''),
    landmark: Joi.string().optional().allow(''),
    electoral_area_id: Joi.number().integer().optional(),
    local_area_id: Joi.number().integer().optional(),
});

/**
 * POST /api/customers
 * Register a new customer
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { error, value } = customerSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const {
            full_name,
            phone_number,
            email,
            gps_address,
            physical_location,
            landmark,
            electoral_area_id,
            local_area_id,
        } = value;

        const result = await pool.query(
            `INSERT INTO customers (
        full_name, phone_number, email, gps_address, 
        physical_location, landmark, electoral_area_id, local_area_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
            [
                full_name,
                phone_number,
                email || null,
                gps_address || null,
                physical_location || null,
                landmark || null,
                electoral_area_id || null,
                local_area_id || null,
            ]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Customer registered successfully',
        });
    } catch (error: any) {
        console.error('Error creating customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register customer',
        });
    }
});

/**
 * GET /api/customers/:id
 * Get customer details with related properties and businesses
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get customer details
        const customerResult = await pool.query(
            `SELECT c.*, 
        ea.name as electoral_area_name,
        la.name as local_area_name
       FROM customers c
       LEFT JOIN electoral_areas ea ON c.electoral_area_id = ea.id
       LEFT JOIN local_areas la ON c.local_area_id = la.id
       WHERE c.id = $1`,
            [id]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found',
            });
        }

        // Get properties
        const propertiesResult = await pool.query(
            `SELECT p.*, pc.name as classification_name
       FROM properties p
       LEFT JOIN property_classifications pc ON p.classification_id = pc.id
       WHERE p.customer_id = $1 AND p.status = 'ACTIVE'`,
            [id]
        );

        // Get businesses
        const businessesResult = await pool.query(
            `SELECT b.*, bc.name as category_name
       FROM businesses b
       LEFT JOIN business_categories bc ON b.category_id = bc.id
       WHERE b.customer_id = $1 AND b.status = 'ACTIVE'`,
            [id]
        );

        // Get outstanding bills
        const billsResult = await pool.query(
            `SELECT * FROM bills
       WHERE customer_id = $1 AND payment_status != 'PAID'
       ORDER BY issue_date DESC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                customer: customerResult.rows[0],
                properties: propertiesResult.rows,
                businesses: businessesResult.rows,
                outstanding_bills: billsResult.rows,
            },
        });
    } catch (error: any) {
        console.error('Error fetching customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer details',
        });
    }
});

/**
 * GET /api/customers
 * List customers with filters
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const {
            search,
            electoral_area_id,
            local_area_id,
            page = 1,
            limit = 50,
        } = req.query;

        let query = `
      SELECT c.*, 
        ea.name as electoral_area_name,
        la.name as local_area_name,
        COUNT(DISTINCT p.id) as property_count,
        COUNT(DISTINCT b.id) as business_count
      FROM customers c
      LEFT JOIN electoral_areas ea ON c.electoral_area_id = ea.id
      LEFT JOIN local_areas la ON c.local_area_id = la.id
      LEFT JOIN properties p ON c.id = p.customer_id
      LEFT JOIN businesses b ON c.id = b.customer_id
      WHERE 1=1
    `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (c.full_name ILIKE $${paramIndex} OR c.phone_number ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        if (electoral_area_id) {
            query += ` AND c.electoral_area_id = $${paramIndex}`;
            queryParams.push(electoral_area_id);
            paramIndex++;
        }

        if (local_area_id) {
            query += ` AND c.local_area_id = $${paramIndex}`;
            queryParams.push(local_area_id);
            paramIndex++;
        }

        query += ` GROUP BY c.id, ea.name, la.name ORDER BY c.full_name`;

        // Add pagination
        const offset = (Number(page) - 1) * Number(limit);
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(Number(limit), offset);

        const result = await pool.query(query, queryParams);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM customers WHERE 1=1';
        const countParams: any[] = [];
        let countIndex = 1;

        if (search) {
            countQuery += ` AND (full_name ILIKE $${countIndex} OR phone_number ILIKE $${countIndex})`;
            countParams.push(`%${search}%`);
            countIndex++;
        }

        if (electoral_area_id) {
            countQuery += ` AND electoral_area_id = $${countIndex}`;
            countParams.push(electoral_area_id);
            countIndex++;
        }

        if (local_area_id) {
            countQuery += ` AND local_area_id = $${countIndex}`;
            countParams.push(local_area_id);
        }

        const countResult = await pool.query(countQuery, countParams);
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
        console.error('Error listing customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customers',
        });
    }
});

/**
 * PUT /api/customers/:id
 * Update customer information
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { error, value } = customerSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const {
            full_name,
            phone_number,
            email,
            gps_address,
            physical_location,
            landmark,
            electoral_area_id,
            local_area_id,
        } = value;

        const result = await pool.query(
            `UPDATE customers SET
        full_name = $1,
        phone_number = $2,
        email = $3,
        gps_address = $4,
        physical_location = $5,
        landmark = $6,
        electoral_area_id = $7,
        local_area_id = $8
       WHERE id = $9
       RETURNING *`,
            [
                full_name,
                phone_number,
                email || null,
                gps_address || null,
                physical_location || null,
                landmark || null,
                electoral_area_id || null,
                local_area_id || null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Customer updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update customer',
        });
    }
});

/**
 * DELETE /api/customers/:id
 * Soft delete customer (sets related records to inactive)
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Set properties to inactive
            await client.query(
                `UPDATE properties SET status = 'INACTIVE' WHERE customer_id = $1`,
                [id]
            );

            // Set businesses to inactive
            await client.query(
                `UPDATE businesses SET status = 'INACTIVE' WHERE customer_id = $1`,
                [id]
            );

            // Delete customer
            const result = await client.query(
                'DELETE FROM customers WHERE id = $1 RETURNING id',
                [id]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'Customer not found',
                });
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Customer deleted successfully',
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error deleting customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete customer',
        });
    }
});

export default router;
