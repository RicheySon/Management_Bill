import pool from '../config/database';

/**
 * Ensure Supervisor role always has Fee Configuration access.
 * Self-heals DBs that never ran the supervisor configure_rates migration.
 */
export const ensureSupervisorConfigureRates = async (): Promise<void> => {
    await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         CROSS JOIN permissions p
         WHERE r.name = 'Supervisor'
           AND p.code = 'configure_rates'
         ON CONFLICT DO NOTHING`
    );
};

/**
 * Load roles + permission codes for a user (after optional role grants).
 */
export const loadUserRolesAndPermissions = async (
    userId: string
): Promise<{ roles: string[]; permissions: string[] }> => {
    await ensureSupervisorConfigureRates();

    const result = await pool.query(
        `SELECT
            array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
            array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL) AS permissions
         FROM system_users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         LEFT JOIN role_permissions rp ON r.id = rp.role_id
         LEFT JOIN permissions p ON rp.permission_id = p.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
    );

    const row = result.rows[0] || {};
    let roles = (row.roles || []).filter(Boolean) as string[];
    let permissions = (row.permissions || []).filter(Boolean) as string[];

    // Belt-and-suspenders: Supervisors always get configure_rates in the session
    if (roles.includes('Supervisor') && !permissions.includes('configure_rates')) {
        permissions = [...permissions, 'configure_rates'];
    }

    return { roles, permissions };
};
