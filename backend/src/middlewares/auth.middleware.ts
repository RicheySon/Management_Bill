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

        const roles = req.user.roles || [];
        const perms = req.user.permissions || [];

        const hasPermission = requiredPermissions.every((perm) => {
            // Cheque clearance is Revenue Officer only — ignore stale Admin JWT grants
            if (perm === 'approve_cheque_payments') {
                return roles.includes('Revenue Officer');
            }
            if (perms.includes(perm)) return true;
            // Supervisors always allowed to configure fee schedules
            if (perm === 'configure_rates' && roles.includes('Supervisor')) return true;
            return false;
        });

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
 *
 * @param columnSql Electoral-area expression (may be COALESCE of several columns)
 * @param localAreaIdSql Optional local_area_id expression — also matches when the
 *   community's parent electoral area is assigned (covers records with null EA).
 */
export const getCollectorAreaFilter = (
    req: AuthRequest,
    columnSql: string,
    startParamIndex: number,
    localAreaIdSql?: string
): { clause: string; params: number[]; nextIndex: number } => {
    const roles = req.user?.roles || [];
    const isCollector = roles.includes('Revenue Collector');
    const areaIds = (req.user?.electoral_area_ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);

    if (!isCollector || areaIds.length === 0) {
        return { clause: '', params: [], nextIndex: startParamIndex };
    }

    const param = `$${startParamIndex}`;
    let clause = ` AND (${columnSql} = ANY(${param}::int[])`;
    if (localAreaIdSql) {
        clause += ` OR EXISTS (
            SELECT 1 FROM local_areas _collector_la
            WHERE _collector_la.id = ${localAreaIdSql}
              AND _collector_la.electoral_area_id = ANY(${param}::int[])
        )`;
    }
    clause += ')';

    return {
        clause,
        params: [areaIds as any],
        nextIndex: startParamIndex + 1,
    };
};

/** Derive electoral_area_id from local_area when EA was left blank. */
export const resolveElectoralAreaId = async (
    electoralAreaId: any,
    localAreaId: any
): Promise<number | null> => {
    const ea =
        electoralAreaId === '' || electoralAreaId === undefined || electoralAreaId === null
            ? null
            : Number(electoralAreaId);
    if (ea && Number.isFinite(ea)) return ea;

    const la =
        localAreaId === '' || localAreaId === undefined || localAreaId === null
            ? null
            : Number(localAreaId);
    if (!la || !Number.isFinite(la)) return null;

    const result = await pool.query(
        'SELECT electoral_area_id FROM local_areas WHERE id = $1',
        [la]
    );
    const derived = result.rows[0]?.electoral_area_id;
    return derived != null ? Number(derived) : null;
};
