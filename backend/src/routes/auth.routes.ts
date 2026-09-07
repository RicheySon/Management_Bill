import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { JWT_SECRET, loadUserElectoralAreas } from '../middlewares/auth.middleware';
import { getAuditContext, logAction } from '../services/audit.service';
import { loadUserRolesAndPermissions } from '../services/role-permissions.service';

const router = express.Router();

// Simple in-memory login rate limit (per IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 20;

const checkLoginRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || entry.resetAt < now) {
        loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return true;
    }
    entry.count += 1;
    return entry.count <= LOGIN_MAX_ATTEMPTS;
};

// Login Endpoint
router.post('/login', async (req, res) => {
    const { email, password, mac_address, device_fingerprint } = req.body;
    const auditCtx = getAuditContext(req, { mac_address, device_fingerprint });
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkLoginRateLimit(ip)) {
        await logAction(null, 'USER_LOGIN_FAILED', 'system_users', email || 'unknown', null, { email, reason: 'rate_limited', ip }, auditCtx);
        return res.status(429).json({ success: false, error: 'Too many login attempts. Try again later.' });
    }

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    try {
        const userQuery = `
            SELECT 
                u.id, u.full_name, u.email, u.password_hash, u.status
            FROM system_users u
            WHERE u.email = $1
        `;

        const result = await pool.query(userQuery, [email]);
        const user = result.rows[0];

        if (!user || user.status !== 'ACTIVE') {
            await logAction(null, 'USER_LOGIN_FAILED', 'system_users', email, null, { email, reason: 'invalid_or_inactive' }, auditCtx);
            return res.status(401).json({ success: false, error: 'Invalid credentials or account inactive' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            await logAction(user.id, 'USER_LOGIN_FAILED', 'system_users', user.id, null, { email, reason: 'bad_password' }, auditCtx);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const electoralAreaIds = await loadUserElectoralAreas(user.id);
        // Self-heals Supervisor → configure_rates if migration was never applied on this DB
        const { roles, permissions } = await loadUserRolesAndPermissions(user.id);

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                permissions,
                roles,
                electoral_area_ids: electoralAreaIds,
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        await pool.query('UPDATE system_users SET last_login = NOW() WHERE id = $1', [user.id]);

        await logAction(
            user.id,
            'USER_LOGIN',
            'system_users',
            user.id,
            null,
            { email: user.email, roles },
            auditCtx
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                roles,
                permissions,
                electoral_area_ids: electoralAreaIds,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

// Validate Token Endpoint — refresh roles/permissions so Fee Configuration appears after deploy
router.get('/validate', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        const result = await pool.query(
            'SELECT id, full_name, email, status FROM system_users WHERE id = $1',
            [decoded.id]
        );

        if (!result.rows[0] || result.rows[0].status !== 'ACTIVE') {
            return res.status(401).json({ success: false, error: 'User not found or inactive' });
        }

        const dbUser = result.rows[0];
        const electoralAreaIds = await loadUserElectoralAreas(dbUser.id);
        const { roles, permissions } = await loadUserRolesAndPermissions(dbUser.id);

        const freshToken = jwt.sign(
            {
                id: dbUser.id,
                email: dbUser.email,
                permissions,
                roles,
                electoral_area_ids: electoralAreaIds,
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            valid: true,
            token: freshToken,
            user: {
                id: dbUser.id,
                full_name: dbUser.full_name,
                email: dbUser.email,
                roles,
                permissions,
                electoral_area_ids: electoralAreaIds,
            },
        });
    } catch (err) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
});

// Logout (client-initiated audit trail)
router.post('/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const auditCtx = getAuditContext(req);

    let userId: string | null = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            userId = decoded.id;
        } catch {
            // ignore expired token on logout
        }
    }

    await logAction(userId, 'USER_LOGOUT', 'system_users', userId || undefined, null, null, auditCtx);
    res.json({ success: true, message: 'Logged out' });
});

export default router;
