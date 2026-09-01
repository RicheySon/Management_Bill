-- Role, payment attribution, privileged-action approvals, arrears ops
-- Safe to run on existing databases (IF NOT EXISTS / ON CONFLICT)

-- =====================================================
-- 1. Payment recorded_by (cashier / officer attribution)
-- =====================================================
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES system_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);

-- =====================================================
-- 2. Privileged action requests (print / delete approvals)
-- =====================================================
CREATE TABLE IF NOT EXISTS privileged_action_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('PRINT_BILL', 'DELETE_BILL')),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    requested_by UUID NOT NULL REFERENCES system_users(id),
    reviewed_by UUID REFERENCES system_users(id),
    reviewed_at TIMESTAMP,
    review_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_par_status ON privileged_action_requests(status);
CREATE INDEX IF NOT EXISTS idx_par_bill ON privileged_action_requests(bill_id);
CREATE INDEX IF NOT EXISTS idx_par_requested_by ON privileged_action_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_par_action ON privileged_action_requests(action_type);

DROP TRIGGER IF EXISTS update_privileged_action_requests_timestamp ON privileged_action_requests;
CREATE TRIGGER update_privileged_action_requests_timestamp
BEFORE UPDATE ON privileged_action_requests
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

-- =====================================================
-- 3. New permissions
-- =====================================================
INSERT INTO permissions (code, description) VALUES
    ('request_print', 'Request approval to print a bill'),
    ('request_delete', 'Request approval to delete a bill'),
    ('approve_privileged_actions', 'Approve or reject print/delete action requests')
ON CONFLICT (code) DO NOTHING;

-- Super Admin gets any new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Super Admin'
  AND p.code IN ('request_print', 'request_delete', 'approve_privileged_actions')
ON CONFLICT DO NOTHING;

-- Admin can approve privileged actions and delete bills after approval path
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
  AND p.code IN ('approve_privileged_actions', 'delete_bill', 'print_bill')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. Supervisor = Supervisor + Data Entry capabilities
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Supervisor'
  AND p.code IN (
      'create_customer', 'view_customer',
      'register_property', 'register_business',
      'view_reports', 'bulk_print', 'edit_customer'
  )
ON CONFLICT DO NOTHING;

-- Link existing Supervisor users to the Data Entry role as well
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, de.id
FROM user_roles ur
JOIN roles s ON ur.role_id = s.id AND s.name = 'Supervisor'
CROSS JOIN roles de
WHERE de.name = 'Data Entry'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. Revenue Officer: reports + request print/delete (no direct print)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Revenue Officer'
  AND p.code IN ('view_reports', 'request_print', 'request_delete')
ON CONFLICT DO NOTHING;

-- Remove direct print from Revenue Officer (must request admin approval)
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'Revenue Officer')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'print_bill');

-- =====================================================
-- 6. Revenue Collector: request print/delete
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Revenue Collector'
  AND p.code IN ('request_print', 'request_delete', 'view_customer')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. Cashier: ensure billing/payment access stays solid
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Cashier'
  AND p.code IN ('view_customer', 'record_payment', 'print_bill')
ON CONFLICT DO NOTHING;
