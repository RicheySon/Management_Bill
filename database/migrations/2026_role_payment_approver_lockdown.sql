-- Approver additive role + harden Cashier/Revenue Officer bill actions
-- Safe to run on existing databases (IF NOT EXISTS / ON CONFLICT)

-- =====================================================
-- 1. Approver role (assignable approval rule)
-- =====================================================
INSERT INTO roles (name, description)
VALUES ('Approver', 'Approve privileged print/delete action requests')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Approver'
  AND p.code IN ('approve_privileged_actions', 'view_customer')
ON CONFLICT DO NOTHING;

-- Keep Super Admin / Admin approval capability intact
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Super Admin', 'Admin')
  AND p.code = 'approve_privileged_actions'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. Strip accidental delete_bill from front-line roles
-- =====================================================
DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'delete_bill')
  AND role_id IN (
      SELECT id FROM roles
      WHERE name IN ('Cashier', 'Revenue Officer', 'Revenue Collector', 'Data Entry', 'Auditor')
  );

-- =====================================================
-- 3. No delete icon path for Cashier / RO / Collector
--    (remove request_delete so trash is not shown)
-- =====================================================
DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'request_delete')
  AND role_id IN (
      SELECT id FROM roles
      WHERE name IN ('Cashier', 'Revenue Officer', 'Revenue Collector')
  );

-- Cashier / RO must not edit customer/property/business names from billing
DELETE FROM role_permissions
WHERE permission_id IN (
      SELECT id FROM permissions
      WHERE code IN ('edit_customer', 'edit_property', 'edit_business')
  )
  AND role_id IN (
      SELECT id FROM roles
      WHERE name IN ('Cashier', 'Revenue Officer', 'Revenue Collector')
  );
