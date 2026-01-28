import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

/**
 * GET /api/lookups/electoral-areas
 * Get all electoral areas
 */
router.get('/electoral-areas', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT * FROM electoral_areas ORDER BY name'
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching electoral areas:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch electoral areas',
        });
    }
});

/**
 * GET /api/lookups/local-areas
 * Get local areas, optionally filtered by electoral area
 */
router.get('/local-areas', async (req: Request, res: Response) => {
    try {
        const { electoral_area_id } = req.query;

        let query = 'SELECT la.*, ea.name as electoral_area_name FROM local_areas la LEFT JOIN electoral_areas ea ON la.electoral_area_id = ea.id WHERE 1=1';
        const queryParams: any[] = [];

        if (electoral_area_id) {
            query += ' AND la.electoral_area_id = $1';
            queryParams.push(electoral_area_id);
        }

        query += ' ORDER BY la.name';

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching local areas:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch local areas',
        });
    }
});

/**
 * GET /api/lookups/property-classifications
 * Get all property classifications
 */
router.get('/property-classifications', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT * FROM property_classifications ORDER BY name'
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching property classifications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property classifications',
        });
    }
});

/**
 * GET /api/lookups/business-categories
 * Get all business categories
 */
router.get('/business-categories', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT * FROM business_categories ORDER BY name'
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching business categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business categories',
        });
    }
});

export default router;
