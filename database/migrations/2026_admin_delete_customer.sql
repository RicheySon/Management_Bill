-- Grant Admin the same customer cascade-delete privilege as Super Admin.
-- delete_customer already exists; Super Admin already has all permissions.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
  AND p.code = 'delete_customer'
ON CONFLICT DO NOTHING;

UPDATE permissions
SET description = 'Permanently delete a customer and wipe related properties, businesses, bills, and payments'
WHERE code = 'delete_customer';
