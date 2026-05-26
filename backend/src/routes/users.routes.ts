import { Router, Response } from 'express';
import pool from '../config/database';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import { logAction } from '../services/audit.service';

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
            `Created user ${newUser.email}`
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

// Update user status (Deactivate/Activate)
router.patch('/:id/status', authenticateToken, authorize(['manage_users']), async (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    try {
        await pool.query('UPDATE system_users SET status = $1 WHERE id = $2', [status, id]);

        await logAction(
            req.user!.id,
            'USER_UPDATED',
            'system_users',
            id,
            `Updated user status to ${status}`
        );

        res.json({ success: true, message: 'User status updated successfully' });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ success: false, error: 'Failed to update user status' });
    }
});

export default router;
