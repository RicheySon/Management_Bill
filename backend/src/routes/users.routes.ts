import { Router, Response } from 'express';
import pool from '../config/database';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import { getAuditContext, logAction } from '../services/audit.service';

const router = Router();

// Get all users
router.get('/', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.status, u.last_login, u.created_at,
                    array_agg(DISTINCT r.name) as roles
             FROM system_users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// Get all roles (for dropdown)
router.get('/roles', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY name');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch roles' });
    }
});

// Create new user
router.post('/', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    // Validate input
    const schema = Joi.object({
        full_name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        role_id: Joi.number().integer().required(),
        electoral_areas: Joi.array().items(Joi.number().integer()).optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if email exists
        const userExists = await client.query('SELECT id FROM system_users WHERE email = $1', [value.email]);
        if (userExists.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(value.password, salt);

        // Insert user
        const userResult = await client.query(
            `INSERT INTO system_users (full_name, email, password_hash, status)
             VALUES ($1, $2, $3, 'ACTIVE')
             RETURNING id, full_name, email`,
            [value.full_name, value.email, passwordHash]
        );
        const newUser = userResult.rows[0];

        // Assign role
        await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
            [newUser.id, value.role_id]
        );

        // Supervisor is also linked to Data Entry role
        const roleInfo = await client.query('SELECT name FROM roles WHERE id = $1', [value.role_id]);
        if (roleInfo.rows[0]?.name === 'Supervisor') {
            const dataEntry = await client.query(`SELECT id FROM roles WHERE name = 'Data Entry'`);
            if (dataEntry.rows[0]) {
                await client.query(
                    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [newUser.id, dataEntry.rows[0].id]
                );
            }
        }

        // Assign electoral areas if provided
        if (value.electoral_areas && value.electoral_areas.length > 0) {
            for (const areaId of value.electoral_areas) {
                await client.query(
                    `INSERT INTO user_electoral_areas (user_id, electoral_area_id) VALUES ($1, $2)`,
                    [newUser.id, areaId]
                );
            }
        }

        await logAction(
            req.user!.id,
            'USER_CREATED',
            'system_users',
            newUser.id,
            null,
            { email: newUser.email, full_name: newUser.full_name, role_id: value.role_id },
            getAuditContext(req)
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: newUser,
            message: 'User created successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, error: 'Failed to create user' });
    } finally {
        client.release();
    }
});

const isSuperAdminUser = async (userId: string) => {
    const result = await pool.query(
        `SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.name = 'Super Admin'
         LIMIT 1`,
        [userId]
    );
    return result.rows.length > 0;
};

const syncUserRole = async (client: any, userId: string, roleId: number) => {
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, roleId]
    );

    const roleInfo = await client.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    if (roleInfo.rows[0]?.name === 'Supervisor') {
        const dataEntry = await client.query(`SELECT id FROM roles WHERE name = 'Data Entry'`);
        if (dataEntry.rows[0]) {
            await client.query(
                `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [userId, dataEntry.rows[0].id]
            );
        }
    }
};

const syncElectoralAreas = async (client: any, userId: string, electoralAreas?: number[]) => {
    await client.query('DELETE FROM user_electoral_areas WHERE user_id = $1', [userId]);
    if (electoralAreas && electoralAreas.length > 0) {
        for (const areaId of electoralAreas) {
            await client.query(
                `INSERT INTO user_electoral_areas (user_id, electoral_area_id) VALUES ($1, $2)`,
                [userId, areaId]
            );
        }
    }
};

// Get single user
router.get('/:id', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.status, u.last_login, u.created_at,
                    COALESCE(
                        (SELECT ur.role_id FROM user_roles ur
                         JOIN roles r ON r.id = ur.role_id
                         WHERE ur.user_id = u.id
                         ORDER BY CASE WHEN r.name = 'Super Admin' THEN 0
                                       WHEN r.name = 'Supervisor' THEN 1
                                       ELSE 2 END
                         LIMIT 1),
                        (SELECT ur2.role_id FROM user_roles ur2 WHERE ur2.user_id = u.id LIMIT 1)
                    ) AS role_id,
                    COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
                    COALESCE(
                        (SELECT array_agg(uea.electoral_area_id ORDER BY uea.electoral_area_id)
                         FROM user_electoral_areas uea WHERE uea.user_id = u.id),
                        '{}'
                    ) AS electoral_areas
             FROM system_users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE u.id = $1
             GROUP BY u.id`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
});

// Update user profile / role / areas
router.put('/:id', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    const schema = Joi.object({
        full_name: Joi.string().required(),
        email: Joi.string().email().required(),
        role_id: Joi.number().integer().required(),
        electoral_areas: Joi.array().items(Joi.number().integer()).optional(),
        status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT id, full_name, email, status FROM system_users WHERE id = $1`,
            [id]
        );
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const targetIsSuperAdmin = await isSuperAdminUser(id);
        if (targetIsSuperAdmin) {
            const roleInfo = await client.query('SELECT name FROM roles WHERE id = $1', [value.role_id]);
            if (roleInfo.rows[0]?.name !== 'Super Admin') {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'Cannot change Super Admin role' });
            }
            if (value.status && value.status !== 'ACTIVE') {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'Cannot deactivate Super Admin' });
            }
        }

        const emailClash = await client.query(
            `SELECT id FROM system_users WHERE email = $1 AND id <> $2`,
            [value.email, id]
        );
        if (emailClash.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const nextStatus = value.status || existing.rows[0].status;
        const updated = await client.query(
            `UPDATE system_users
             SET full_name = $1, email = $2, status = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, full_name, email, status`,
            [value.full_name, value.email, nextStatus, id]
        );

        if (!targetIsSuperAdmin) {
            await syncUserRole(client, id, value.role_id);
        }
        await syncElectoralAreas(client, id, value.electoral_areas || []);

        await logAction(
            req.user!.id,
            'USER_UPDATED',
            'system_users',
            id,
            existing.rows[0],
            {
                full_name: value.full_name,
                email: value.email,
                role_id: value.role_id,
                status: nextStatus,
                electoral_areas: value.electoral_areas || [],
            },
            getAuditContext(req)
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            data: updated.rows[0],
            message: 'User updated successfully',
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating user:', err);
        res.status(500).json({ success: false, error: 'Failed to update user' });
    } finally {
        client.release();
    }
});

// Admin reset / change password
router.patch('/:id/password', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    const schema = Joi.object({
        password: Joi.string().min(6).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { id } = req.params;
    try {
        const existing = await pool.query('SELECT id, email FROM system_users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(value.password, salt);
        await pool.query(
            `UPDATE system_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [passwordHash, id]
        );

        await logAction(
            req.user!.id,
            'USER_PASSWORD_CHANGED',
            'system_users',
            id,
            null,
            { email: existing.rows[0].email, changed_by_admin: true },
            getAuditContext(req)
        );

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});

// Update user status (Deactivate/Activate)
router.patch('/:id/status', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    try {
        if (req.user?.id === id && status === 'INACTIVE') {
            return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
        }
        if (await isSuperAdminUser(id) && status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: 'Cannot deactivate Super Admin' });
        }

        const existing = await pool.query('SELECT id, status FROM system_users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await pool.query(
            'UPDATE system_users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [status, id]
        );

        await logAction(
            req.user!.id,
            'USER_STATUS_CHANGED',
            'system_users',
            id,
            { status: existing.rows[0].status },
            { status },
            getAuditContext(req)
        );

        res.json({ success: true, message: 'User status updated successfully' });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ success: false, error: 'Failed to update user status' });
    }
});

// Delete user
router.delete('/:id', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        if (req.user?.id === id) {
            return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
        }
        if (await isSuperAdminUser(id)) {
            return res.status(400).json({ success: false, error: 'Cannot delete Super Admin' });
        }

        const existing = await pool.query(
            'SELECT id, email, full_name FROM system_users WHERE id = $1',
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await pool.query('DELETE FROM system_users WHERE id = $1', [id]);

        await logAction(
            req.user!.id,
            'USER_DELETED',
            'system_users',
            id,
            existing.rows[0],
            null,
            getAuditContext(req)
        );

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

export default router;
