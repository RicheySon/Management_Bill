import pool from '../config/database';

/**
 * Ensure ACP exists as an electoral area.
 * Production DBs that never ran 2026_z_acp_electoral_area.sql still miss ACP
 * in Bills filters and collector area assignment.
 */
export const ensureAcpElectoralArea = async (): Promise<void> => {
    await pool.query(
        `INSERT INTO electoral_areas (name, code)
         SELECT 'ACP', 'ACP'
         WHERE NOT EXISTS (
             SELECT 1 FROM electoral_areas
             WHERE code = 'ACP' OR UPPER(TRIM(name)) = 'ACP'
         )`
    );

    // Re-home ACP communities under the ACP electoral area when present
    await pool.query(
        `UPDATE local_areas la
         SET electoral_area_id = ea.id
         FROM electoral_areas ea
         WHERE ea.code = 'ACP'
           AND la.name ILIKE 'ACP%'
           AND la.electoral_area_id IS DISTINCT FROM ea.id`
    );
};
