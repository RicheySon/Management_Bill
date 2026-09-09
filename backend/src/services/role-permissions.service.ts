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
 * Cheque clearance is Revenue Officer only.
 * Self-heals DBs where Admin/Super Admin still hold approve_cheque_payments
 * (migration not applied, or older seed still grants it).
 */
export const ensureRevenueOfficerChequeClearance = async (): Promise<void> => {
    await pool.query(
        `INSERT INTO permissions (code, description)
         VALUES (
           'approve_cheque_payments',
           'Approve or decline pending cheque payments after bank clearance'
         )
         ON CONFLICT (code) DO NOTHING`
    );

    await pool.query(
        `DELETE FROM role_permissions
         WHERE permission_id = (SELECT id FROM permissions WHERE code = 'approve_cheque_payments')
           AND role_id IN (
             SELECT id FROM roles
             WHERE name IN (
               'Super Admin', 'Admin', 'Approver', 'Supervisor',
               'Cashier', 'Revenue Collector'
             )
           )`
    );

    await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         CROSS JOIN permissions p
         WHERE r.name = 'Revenue Officer'
           AND p.code IN ('approve_cheque_payments', 'view_reports')
         ON CONFLICT DO NOTHING`
    );
};

/**
 * Revenue Collectors can record payments on bills in their assigned areas.
 * Self-heals DBs that never ran the collector record_payment migration.
 */
export const ensureRevenueCollectorRecordPayment = async (): Promise<void> => {
    await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         CROSS JOIN permissions p
         WHERE r.name = 'Revenue Collector'
           AND p.code = 'record_payment'
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
    await ensureRevenueOfficerChequeClearance();
    await ensureRevenueCollectorRecordPayment();

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

    // Collectors always get record_payment in the session (area checks still apply on APIs)
    if (roles.includes('Revenue Collector') && !permissions.includes('record_payment')) {
        permissions = [...permissions, 'record_payment'];
    }

    // Cheque clearance is role-gated to Revenue Officer only (strip stale Admin JWT grants)
    if (roles.includes('Revenue Officer')) {
        if (!permissions.includes('approve_cheque_payments')) {
            permissions = [...permissions, 'approve_cheque_payments'];
        }
        if (!permissions.includes('view_reports')) {
            permissions = [...permissions, 'view_reports'];
        }
    } else {
        permissions = permissions.filter((p) => p !== 'approve_cheque_payments');
    }

    return { roles, permissions };
};
