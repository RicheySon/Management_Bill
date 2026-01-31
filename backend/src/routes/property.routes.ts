import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import Joi from 'joi';

const router = Router();

// Apply authentication to all property routes
router.use(authenticateToken);

/**
 * Validation Schema
 */
const propertySchema = Joi.object({
    customer_id: Joi.string().uuid().required(),
    classification_id: Joi.number().integer().required(),
    street_name: Joi.string().optional().allow(''),
    gps_address: Joi.string().optional().allow('').max(50),
    physical_location: Joi.string().optional().allow(''),
    landmark: Joi.string().optional().allow(''),
    electoral_area_id: Joi.number().integer().optional(),
    local_area_id: Joi.number().integer().optional(),
    property_size: Joi.number().positive().optional(),
    year_registered: Joi.number().integer().min(2000).max(2100).optional(),
});

/**
 * POST /api/properties
 * Register a new property
 */
router.post('/', authorize(['register_property']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = propertySchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const {
            customer_id,
            classification_id,
            street_name,
            gps_address,
            physical_location,
            landmark,
            electoral_area_id,
            local_area_id,
            property_size,
            year_registered,
        } = value;

        const currentYear = new Date().getFullYear();
        const regYear = year_registered || currentYear;

        const result = await pool.query(
            `INSERT INTO properties (
                customer_id, classification_id, street_name, gps_address,
                physical_location, landmark, electoral_area_id, local_area_id,
                property_size, year_registered
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                customer_id,
                classification_id,
                street_name || null,
                gps_address || null,
                physical_location || null,
                landmark || null,
                electoral_area_id || null,
                local_area_id || null,
                property_size || null,
                regYear,
            ]
        );

        const propertyWithDetails = await pool.query(
            `SELECT p.*,
                c.full_name as owner_name,
                c.phone_number as owner_phone,
                pc.name as classification_name,
                pc.base_rate,
                ea.name as electoral_area_name,
                la.name as local_area_name
            FROM properties p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN property_classifications pc ON p.classification_id = pc.id
            LEFT JOIN electoral_areas ea ON p.electoral_area_id = ea.id
            LEFT JOIN local_areas la ON p.local_area_id = la.id
            WHERE p.id = $1`,
            [result.rows[0].id]
        );

        res.status(201).json({
            success: true,
            data: propertyWithDetails.rows[0],
            message: `Property registered successfully. Property Number: ${propertyWithDetails.rows[0].property_number}`,
        });
    } catch (error: any) {
        console.error('Error creating property:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register property',
        });
    }
});

/**
 * GET /api/properties/:id
 * Get property details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT p.*,
                c.full_name as owner_name,
                c.phone_number as owner_phone,
                c.gps_address as owner_gps,
                pc.name as classification_name,
                pc.base_rate,
                ea.name as electoral_area_name,
                la.name as local_area_name
            FROM properties p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN property_classifications pc ON p.classification_id = pc.id
            LEFT JOIN electoral_areas ea ON p.electoral_area_id = ea.id
            LEFT JOIN local_areas la ON p.local_area_id = la.id
            WHERE p.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found',
            });
        }

        const billsResult = await pool.query(
            `SELECT * FROM bills
            WHERE property_id = $1
            ORDER BY issue_date DESC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                property: result.rows[0],
                bills: billsResult.rows,
            },
        });
    } catch (error: any) {
        console.error('Error fetching property:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property details',
        });
    }
});

/**
 * GET /api/properties
 * List properties with filters
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            search,
            classification_id,
            electoral_area_id,
            customer_id,
            status = 'ACTIVE',
            page = 1,
            limit = 50,
        } = req.query;

        let query = `
            SELECT p.*,
                c.full_name as owner_name,
                c.phone_number as owner_phone,
                pc.name as classification_name,
                ea.name as electoral_area_name
            FROM properties p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN property_classifications pc ON p.classification_id = pc.id
            LEFT JOIN electoral_areas ea ON p.electoral_area_id = ea.id
            WHERE 1=1
        `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND p.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (search) {
            query += ` AND (p.property_number ILIKE $${paramIndex} OR c.full_name ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        if (classification_id) {
            query += ` AND p.classification_id = $${paramIndex}`;
            queryParams.push(classification_id);
            paramIndex++;
        }

        if (electoral_area_id) {
            query += ` AND p.electoral_area_id = $${paramIndex}`;
            queryParams.push(electoral_area_id);
            paramIndex++;
        }

        if (customer_id) {
            query += ` AND p.customer_id = $${paramIndex}`;
            queryParams.push(customer_id);
            paramIndex++;
        }

        query += ` ORDER BY p.created_at DESC`;

        const offset = (Number(page) - 1) * Number(limit);
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(Number(limit), offset);

        const result = await pool.query(query, queryParams);

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM properties WHERE status = $1',
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
        console.error('Error listing properties:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch properties',
        });
    }
});

/**
 * PUT /api/properties/:id
 * Update property information
 */
router.put('/:id', authorize(['edit_property']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const updateSchema = Joi.object({
            street_name: Joi.string().optional().allow(''),
            gps_address: Joi.string().optional().allow('').max(50),
            physical_location: Joi.string().optional().allow(''),
            landmark: Joi.string().optional().allow(''),
            electoral_area_id: Joi.number().integer().optional(),
            local_area_id: Joi.number().integer().optional(),
            property_size: Joi.number().positive().optional(),
            status: Joi.string().valid('ACTIVE', 'INACTIVE', 'DEMOLISHED').optional(),
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
            `UPDATE properties SET ${setClause} WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Property updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating property:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update property',
        });
    }
});

export default router;
