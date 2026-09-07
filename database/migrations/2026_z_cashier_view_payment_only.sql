-- Cashier: view + payment only (no print / delete / request-print / request-delete)
-- Filename sorted after other 2026_* role migrations so it is the final Cashier permission state.

UPDATE roles
SET description = 'View bills and record payments only'
WHERE name = 'Cashier';

-- Remove privileged bill actions from Cashier
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'Cashier')
  AND permission_id IN (
      SELECT id FROM permissions
      WHERE code IN (
          'print_bill',
          'bulk_print',
          'delete_bill',
          'request_print',
          'request_delete'
      )
  );

-- Ensure core Cashier permissions remain
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Cashier'
  AND p.code IN ('view_customer', 'record_payment')
ON CONFLICT DO NOTHING;
