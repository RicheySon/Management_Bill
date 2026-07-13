import pool from '../config/database';
import { Request } from 'express';

export interface AuditContext {
    ipAddress?: string;
    userAgent?: string;
    macAddress?: string;
    deviceFingerprint?: string;
    sessionId?: string;
}

/** Extract client audit metadata from an Express request */
export const getAuditContext = (req: Request, bodyExtras?: {
    mac_address?: string;
    device_fingerprint?: string;
    session_id?: string;
}): AuditContext => {
    const forwarded = req.headers['x-forwarded-for'];
    const ipFromForwarded = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : Array.isArray(forwarded) ? forwarded[0] : undefined;

    return {
        ipAddress: ipFromForwarded || req.ip || req.socket?.remoteAddress || undefined,
        userAgent: req.headers['user-agent'] || undefined,
        macAddress: bodyExtras?.mac_address || (req.body && req.body.mac_address) || 'unavailable',
        deviceFingerprint: bodyExtras?.device_fingerprint || (req.body && req.body.device_fingerprint) || undefined,
        sessionId: bodyExtras?.session_id || (req.body && req.body.session_id) || undefined,
    };
};

export const logAction = async (
    userId: string | null,
    action: string,
    entityType?: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any,
    ctx?: AuditContext | string,
    userAgent?: string
) => {
    try {
        // Back-compat: older callers passed (..., ipAddress, userAgent) as strings
        let context: AuditContext = {};
        if (typeof ctx === 'string') {
            context = { ipAddress: ctx, userAgent };
        } else if (ctx) {
            context = ctx;
        }

        const query = `
            INSERT INTO audit_logs (
                user_id, action, entity_type, entity_id,
                old_values, new_values, ip_address, user_agent,
                mac_address, device_fingerprint, session_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        await pool.query(query, [
            userId,
            action,
            entityType || null,
            entityId || null,
            oldValues != null ? JSON.stringify(oldValues) : null,
            newValues != null ? JSON.stringify(newValues) : null,
            context.ipAddress || null,
            context.userAgent || null,
            context.macAddress || 'unavailable',
            context.deviceFingerprint || null,
            context.sessionId || null,
        ]);
    } catch (err) {
        console.error('Audit logging failed:', err);
    }
};
