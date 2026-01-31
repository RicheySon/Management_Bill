import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authorize } from '../middlewares/auth.middleware';

const router = Router();

// Get audit logs with filters
router.get('/', authorize(['view_audit_logs']), async (req: Request, res: Response) => {
    try {
        const { start_date, end_date, action_type, limit = 50 } = req.query;

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
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
});

export default router;
