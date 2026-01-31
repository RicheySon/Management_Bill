import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ganorth-municipal-secret-key-2026';

// Login Endpoint
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    try {
        // Fetch user with roles and permissions
        const userQuery = `
            SELECT 
                u.id, u.full_name, u.email, u.password_hash, u.status,
                array_agg(DISTINCT r.name) as roles,
                array_agg(DISTINCT p.code) as permissions
            FROM system_users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.email = $1
            GROUP BY u.id
        `;

        const result = await pool.query(userQuery, [email]);
        const user = result.rows[0];

        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, error: 'Invalid credentials or account inactive' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                permissions: user.permissions
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Update last login
        await pool.query('UPDATE system_users SET last_login = NOW() WHERE id = $1', [user.id]);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                roles: user.roles,
                permissions: user.permissions
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

export default router;
