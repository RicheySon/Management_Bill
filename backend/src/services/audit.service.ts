import pool from '../config/database';

export const logAction = async (
    userId: string | null,
    action: string,
    entityType?: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string,
    userAgent?: string
) => {
    try {
        const query = `
            INSERT INTO audit_logs (
                user_id, action, entity_type, entity_id, 
                old_values, new_values, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await pool.query(query, [
            userId,
            action,
            entityType,
            entityId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress,
            userAgent
        ]);
    } catch (err) {
        console.error('Audit logging failed:', err);
    }
};
