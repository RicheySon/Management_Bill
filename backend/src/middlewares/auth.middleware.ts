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
            // Collectors may record payments (bill APIs still enforce assigned areas)
            if (perm === 'record_payment' && roles.includes('Revenue Collector')) return true;
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
 * Normalize JWT/session electoral_area_ids into a positive int array.
 * Handles missing values, a bare number/string (single area), and arrays.
 * Never throws — callers can safely .length-check the result.
 */
export const normalizeElectoralAreaIds = (raw: unknown): number[] => {
    if (raw == null || raw === '') return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
};

/**
 * Returns SQL fragment + params to restrict by collector electoral areas.
 * Non-collectors: no filter. Collectors with no valid areas: match nothing
 * (fail-closed — must stay aligned with assertCollectorCanAccessBill).
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
    if (!isCollector) {
        return { clause: '', params: [], nextIndex: startParamIndex };
    }

    const areaIds = normalizeElectoralAreaIds(req.user?.electoral_area_ids);
    // Fail-closed: collectors with no areas must not see the global bill list
    // (assertCollectorCanAccessBill would 403 every detail open).
    if (areaIds.length === 0) {
        return { clause: ' AND FALSE', params: [], nextIndex: startParamIndex };
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

/**
 * Ensure a Revenue Collector may access a bill in their assigned electoral areas.
 * Non-collectors always pass. Collectors with no areas get no bill access.
 * Must not throw — exceptions here are caught by GET /bills/:id and surfaced as
 * the generic "Failed to fetch bill details" 500.
 */
export const assertCollectorCanAccessBill = async (
    req: AuthRequest,
    billId: string
): Promise<{ allowed: boolean; status: number; error?: string }> => {
    try {
        const roles = req.user?.roles || [];
        if (!roles.includes('Revenue Collector')) {
            return { allowed: true, status: 200 };
        }

        const areaIds = normalizeElectoralAreaIds(req.user?.electoral_area_ids);

        if (areaIds.length === 0) {
            return {
                allowed: false,
                status: 403,
                error: 'No electoral area assigned. Contact an administrator to assign your collection areas.',
            };
        }

        const result = await pool.query(
            `SELECT b.id
             FROM bills b
             LEFT JOIN customers c ON b.customer_id = c.id
             LEFT JOIN properties p ON b.property_id = p.id
             LEFT JOIN businesses bus ON b.business_id = bus.id
             LEFT JOIN local_areas la_p ON p.local_area_id = la_p.id
             LEFT JOIN local_areas la_bus ON bus.local_area_id = la_bus.id
             LEFT JOIN local_areas la_c ON c.local_area_id = la_c.id
             WHERE b.id = $1
               AND COALESCE(
                    p.electoral_area_id, bus.electoral_area_id, c.electoral_area_id,
                    la_p.electoral_area_id, la_bus.electoral_area_id, la_c.electoral_area_id
               ) = ANY($2::int[])`,
            [billId, areaIds]
        );

        if (result.rows.length === 0) {
            const exists = await pool.query('SELECT id FROM bills WHERE id = $1', [billId]);
            if (exists.rows.length === 0) {
                return { allowed: false, status: 404, error: 'Bill not found' };
            }
            return {
                allowed: false,
                status: 403,
                error: 'This bill is outside your assigned electoral area(s).',
            };
        }

        return { allowed: true, status: 200 };
    } catch (err: any) {
        console.error('assertCollectorCanAccessBill failed:', err?.message || err);
        return {
            allowed: false,
            status: 500,
            error: 'Failed to verify bill access. Please try again or contact support.',
        };
    }
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
