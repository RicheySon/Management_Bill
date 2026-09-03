import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/lookups/electoral-areas
 * Get all electoral areas
 */
router.get('/electoral-areas', async (req: Request, res: Response) => {
    console.log('GET /api/lookups/electoral-areas - Fetching electoral areas');
    try {
        const result = await pool.query(
            'SELECT id, name, code FROM electoral_areas ORDER BY name'
        );

        console.log(`Found ${result.rows.length} electoral areas`);

        res.json({
            success: true,
            data: result.rows || [],
        });
    } catch (error: any) {
        console.error('Error fetching electoral areas:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch electoral areas',
            data: []
        });
    }
});

/**
 * GET /api/lookups/local-areas
 * Get local areas, optionally filtered by electoral area
 */
router.get('/local-areas', async (req: Request, res: Response) => {
    const { electoral_area_id } = req.query;
    console.log(`GET /api/lookups/local-areas - Fetching local areas for electoral_area_id: ${electoral_area_id}`);

    try {
        let query = 'SELECT la.id, la.name, la.electoral_area_id, ea.name as electoral_area_name FROM local_areas la LEFT JOIN electoral_areas ea ON la.electoral_area_id = ea.id WHERE 1=1';
        const queryParams: any[] = [];

        if (electoral_area_id && electoral_area_id !== 'undefined' && electoral_area_id !== '') {
            query += ' AND la.electoral_area_id = $1';
            queryParams.push(electoral_area_id);
        }

        query += ' ORDER BY la.name';

        const result = await pool.query(query, queryParams);
        console.log(`Found ${result.rows.length} local areas`);

        res.json({
            success: true,
            data: result.rows || [],
        });
    } catch (error: any) {
        console.error('Error fetching local areas:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch local areas',
            data: []
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

/**
 * Admin: create / update / delete electoral areas and communities
 */
router.post('/electoral-areas', authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.body?.name || '').trim();
        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!name || !code) {
            return res.status(400).json({ success: false, error: 'Name and code are required' });
        }
        const result = await pool.query(
            `INSERT INTO electoral_areas (name, code) VALUES ($1, $2)
             ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
             RETURNING *`,
            [name, code]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        console.error('Error creating electoral area:', error);
        res.status(500).json({
            success: false,
            error: error.code === '23505' ? 'Electoral area name or code already exists' : 'Failed to create electoral area',
        });
    }
});

router.put('/electoral-areas/:id', authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.body?.name || '').trim();
        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!name || !code) {
            return res.status(400).json({ success: false, error: 'Name and code are required' });
        }
        const result = await pool.query(
            `UPDATE electoral_areas SET name = $1, code = $2 WHERE id = $3 RETURNING *`,
            [name, code, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Electoral area not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        console.error('Error updating electoral area:', error);
        res.status(500).json({ success: false, error: 'Failed to update electoral area' });
    }
});

router.delete('/electoral-areas/:id', authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const linked = await pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM local_areas WHERE electoral_area_id = $1) AS communities,
                (SELECT COUNT(*)::int FROM customers WHERE electoral_area_id = $1) AS customers,
                (SELECT COUNT(*)::int FROM properties WHERE electoral_area_id = $1) AS properties,
                (SELECT COUNT(*)::int FROM businesses WHERE electoral_area_id = $1) AS businesses`,
            [req.params.id]
        );
        const counts = linked.rows[0];
        const total = counts.communities + counts.customers + counts.properties + counts.businesses;
        if (total > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: linked to ${counts.communities} communities, ${counts.customers} customers, ${counts.properties} properties, ${counts.businesses} businesses. Remove or reassign them first.`,
            });
        }
        const result = await pool.query(`DELETE FROM electoral_areas WHERE id = $1 RETURNING id`, [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Electoral area not found' });
        }
        res.json({ success: true, message: 'Electoral area deleted' });
    } catch (error: any) {
        console.error('Error deleting electoral area:', error);
        res.status(500).json({ success: false, error: 'Failed to delete electoral area' });
    }
});

router.post('/local-areas', authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.body?.name || '').trim();
        const electoralAreaId = parseInt(String(req.body?.electoral_area_id || ''), 10);
        if (!name || !electoralAreaId) {
            return res.status(400).json({ success: false, error: 'Community name and electoral area are required' });
        }
        const result = await pool.query(
            `INSERT INTO local_areas (name, electoral_area_id) VALUES ($1, $2) RETURNING *`,
            [name, electoralAreaId]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        console.error('Error creating local area:', error);
        res.status(500).json({ success: false, error: 'Failed to create community' });
    }
});

router.put('/local-areas/:id', authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.body?.name || '').trim();
        const electoralAreaId = parseInt(String(req.body?.electoral_area_id || ''), 10);
        if (!name || !electoralAreaId) {
            return res.status(400).json({ success: false, error: 'Community name and electoral area are required' });
        }
        const result = await pool.query(
            `UPDATE local_areas SET name = $1, electoral_area_id = $2 WHERE id = $3 RETURNING *`,
            [name, electoralAreaId, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Community not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        console.error('Error updating local area:', error);
        res.status(500).json({ success: false, error: 'Failed to update community' });
    }
});

router.delete('/local-areas/:id', authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const linked = await pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM customers WHERE local_area_id = $1) AS customers,
                (SELECT COUNT(*)::int FROM properties WHERE local_area_id = $1) AS properties,
                (SELECT COUNT(*)::int FROM businesses WHERE local_area_id = $1) AS businesses`,
            [req.params.id]
        );
        const counts = linked.rows[0];
        const total = counts.customers + counts.properties + counts.businesses;
        if (total > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: linked to ${counts.customers} customers, ${counts.properties} properties, ${counts.businesses} businesses.`,
            });
        }
        const result = await pool.query(`DELETE FROM local_areas WHERE id = $1 RETURNING id`, [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Community not found' });
        }
        res.json({ success: true, message: 'Community deleted' });
    } catch (error: any) {
        console.error('Error deleting local area:', error);
        res.status(500).json({ success: false, error: 'Failed to delete community' });
    }
});

export default router;
