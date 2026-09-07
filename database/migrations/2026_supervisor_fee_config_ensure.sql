-- Ensure Supervisor always has Fee Configuration (configure_rates).
-- Safe to re-run; mirrors login self-heal for environments that only apply migrations.

UPDATE roles
SET description = 'Review, approval, and fee configuration access'
WHERE name = 'Supervisor';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Supervisor'
  AND p.code = 'configure_rates'
ON CONFLICT DO NOTHING;
