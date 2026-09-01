import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(authorize(['view_logs']));

const buildAuditQuery = (req: AuthRequest) => {
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

    return { query, params };
};

// Get audit logs with filters
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { query, params } = buildAuditQuery(req);
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

/**
 * GET /api/audit/export
 * Export filtered audit logs as CSV
 */
router.get('/export', async (req: AuthRequest, res: Response) => {
    try {
        const limit = typeof req.query.limit === 'string' ? req.query.limit : '5000';
        req.query.limit = limit;
        const { query, params } = buildAuditQuery(req);
        const result = await pool.query(query, params);

        const escape = (val: any) => {
            if (val == null) return '';
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
        };

        const headers = [
            'created_at',
            'user_name',
            'user_email',
            'action',
            'entity_type',
            'entity_id',
            'ip_address',
            'mac_address',
            'device_fingerprint',
            'old_values',
            'new_values',
            'user_agent',
        ];

        const lines = [headers.join(',')];
        for (const row of result.rows) {
            lines.push(headers.map((h) => escape(row[h])).join(','));
        }

        const csv = lines.join('\n');
        const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ success: false, error: 'Failed to export audit logs' });
    }
});

export default router;
