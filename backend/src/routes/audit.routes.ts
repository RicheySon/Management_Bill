import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(authorize(['view_logs']));

// Get audit logs with filters
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            start_date,
            end_date,
            action_type,
            user_id,
            ip_address,
            limit = 100,
        } = req.query;

        let query = `
            SELECT a.*, u.full_name as user_name, u.email as user_email
            FROM audit_logs a
            LEFT JOIN system_users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramIndex = 1;

        if (action_type) {
            query += ` AND a.action = $${paramIndex}`;
            params.push(action_type);
            paramIndex++;
        }

        if (user_id) {
            query += ` AND a.user_id = $${paramIndex}`;
            params.push(user_id);
            paramIndex++;
        }

        if (ip_address) {
            query += ` AND a.ip_address ILIKE $${paramIndex}`;
            params.push(`%${ip_address}%`);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND a.created_at >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND a.created_at <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex}`;
        params.push(Number(limit));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
});

export default router;
