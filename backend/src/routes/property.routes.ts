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
    property_use: Joi.string().optional().allow(''),
    building_type: Joi.string().optional().allow(''),
    no_of_storeys: Joi.number().integer().min(0).optional(),
    ownership: Joi.string().optional().allow(''),
    building_permit_status: Joi.string().optional().allow(''),
    account_number: Joi.string().optional().allow(''),
    parcel_number: Joi.string().optional().allow(''),
    house_number: Joi.string().optional().allow(''),
    source_of_water: Joi.string().optional().allow(''),
    sanitation_facility: Joi.string().optional().allow(''),
    solid_waste_disposal: Joi.string().optional().allow(''),
    liquid_waste_disposal: Joi.string().optional().allow(''),
    no_of_people: Joi.number().integer().min(0).optional(),
    no_of_bedrooms: Joi.number().integer().min(0).optional(),
    no_of_washrooms: Joi.number().integer().min(0).optional(),
    no_of_other_rooms: Joi.number().integer().min(0).optional(),
    street_name: Joi.string().optional().allow(''),
    gps_address: Joi.string().optional().allow('').max(50),
    latitude: Joi.number().precision(8).min(-90).max(90).optional().allow(null),
    longitude: Joi.number().precision(8).min(-180).max(180).optional().allow(null),
    town: Joi.string().optional().allow(''),
    physical_location: Joi.string().optional().allow(''),
    landmark: Joi.string().optional().allow(''),
    electoral_area_id: Joi.number().integer().optional(),
    local_area_id: Joi.number().integer().optional(),
    population_density: Joi.string().optional().allow(''),
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
            customer_id, classification_id,
            property_use, building_type, no_of_storeys, ownership,
            building_permit_status, account_number, parcel_number, house_number,
            source_of_water, sanitation_facility, solid_waste_disposal, liquid_waste_disposal,
            no_of_people, no_of_bedrooms, no_of_washrooms, no_of_other_rooms,
            street_name, gps_address, latitude, longitude, town, physical_location, landmark,
            electoral_area_id, local_area_id, population_density,
            property_size, year_registered,
        } = value;

        const currentYear = new Date().getFullYear();
        const regYear = year_registered || currentYear;

        const result = await pool.query(
            `INSERT INTO properties (
                customer_id, classification_id,
                property_use, building_type, no_of_storeys, ownership,
                building_permit_status, account_number, parcel_number, house_number,
                source_of_water, sanitation_facility, solid_waste_disposal, liquid_waste_disposal,
                no_of_people, no_of_bedrooms, no_of_washrooms, no_of_other_rooms,
                street_name, gps_address, latitude, longitude, town, physical_location, landmark,
                electoral_area_id, local_area_id, population_density,
                property_size, year_registered
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
            RETURNING *`,
            [
                customer_id, classification_id,
                property_use || null, building_type || null, no_of_storeys || 0, ownership || null,
                building_permit_status || null, account_number || null, parcel_number || null, house_number || null,
                source_of_water || null, sanitation_facility || null, solid_waste_disposal || null, liquid_waste_disposal || null,
                no_of_people || 0, no_of_bedrooms || 0, no_of_washrooms || 0, no_of_other_rooms || 0,
                street_name || null, gps_address || null, latitude || null, longitude || null, town || null, physical_location || null, landmark || null,
                electoral_area_id || null, local_area_id || null, population_density || null,
                property_size || null, regYear,
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
            latitude: Joi.number().precision(8).min(-90).max(90).optional().allow(null),
            longitude: Joi.number().precision(8).min(-180).max(180).optional().allow(null),
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
