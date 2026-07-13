import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is required in production');
        }
        console.warn('WARNING: JWT_SECRET not set; using insecure development fallback');
        return 'dev-only-insecure-secret-change-me';
    }
    return secret;
};

export const JWT_SECRET = (() => {
    try {
        return getJwtSecret();
    } catch {
        // Defer hard fail to server boot in production
        return process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
    }
})();

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        permissions: string[];
        roles?: string[];
        electoral_area_ids?: number[];
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
};

export const authorize = (requiredPermissions: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required.' });
            return;
        }

        const hasPermission = requiredPermissions.every((perm) =>
            req.user?.permissions?.includes(perm)
        );

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                error: 'Permission denied. You do not have the required access for this action.',
            });
            return;
        }

        next();
    };
};

/**
 * Load electoral area IDs for a user (Revenue Collector scoping).
 */
export const loadUserElectoralAreas = async (userId: string): Promise<number[]> => {
    const result = await pool.query(
        'SELECT electoral_area_id FROM user_electoral_areas WHERE user_id = $1',
        [userId]
    );
    return result.rows.map((r) => Number(r.electoral_area_id));
};

/**
 * Returns SQL fragment + params to restrict by collector electoral areas.
 * If user is not a Revenue Collector or has no areas, returns empty filter.
 */
export const getCollectorAreaFilter = (
    req: AuthRequest,
    columnSql: string,
    startParamIndex: number
): { clause: string; params: number[]; nextIndex: number } => {
    const roles = req.user?.roles || [];
    const isCollector = roles.includes('Revenue Collector');
    const areaIds = req.user?.electoral_area_ids || [];

    if (!isCollector || areaIds.length === 0) {
        return { clause: '', params: [], nextIndex: startParamIndex };
    }

    return {
        clause: ` AND ${columnSql} = ANY($${startParamIndex}::int[])`,
        params: [areaIds as any],
        nextIndex: startParamIndex + 1,
    };
};
