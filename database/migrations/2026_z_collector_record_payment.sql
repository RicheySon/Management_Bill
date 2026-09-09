-- Revenue Collectors can record payments on bills in their assigned electoral areas.
-- Bill view/pay APIs enforce area scoping separately in the backend.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Revenue Collector'
  AND p.code = 'record_payment'
ON CONFLICT DO NOTHING;
