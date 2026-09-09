-- Re-assert cheque clearance is Revenue Officer only (idempotent self-heal for production)

INSERT INTO permissions (code, description)
VALUES ('approve_cheque_payments', 'Approve or decline pending cheque payments after bank clearance')
ON CONFLICT (code) DO NOTHING;

DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'approve_cheque_payments')
  AND role_id IN (
    SELECT id FROM roles
    WHERE name IN (
      'Super Admin', 'Admin', 'Approver', 'Supervisor',
      'Cashier', 'Revenue Collector'
    )
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Revenue Officer'
  AND p.code IN ('approve_cheque_payments', 'view_reports')
ON CONFLICT DO NOTHING;
