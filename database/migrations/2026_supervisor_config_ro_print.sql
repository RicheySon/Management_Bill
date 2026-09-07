-- Supervisor gets Fee Configuration; Revenue Officer/Collector get direct bill download/print
-- instead of request-print approval (which left approved prints with nowhere useful to go).

-- =====================================================
-- 1. Supervisor → Fee Configuration (configure_rates)
-- =====================================================
UPDATE roles
SET description = 'Review, approval, and fee configuration access'
WHERE name = 'Supervisor';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Supervisor'
  AND p.code = 'configure_rates'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. Revenue Officer: direct print/download (drop request_print)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Revenue Officer'
  AND p.code = 'print_bill'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'Revenue Officer')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'request_print');

-- =====================================================
-- 3. Revenue Collector: same — direct print/download
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Revenue Collector'
  AND p.code = 'print_bill'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'Revenue Collector')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'request_print');
