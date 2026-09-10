-- Ensure payment clearance columns exist (fixes bill detail 500 for all roles)
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS clearance_status VARCHAR(20) NOT NULL DEFAULT 'CLEARED';

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS cleared_by UUID REFERENCES system_users(id) ON DELETE SET NULL;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS clearance_note TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_clearance_status_check'
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_clearance_status_check
            CHECK (clearance_status IN ('PENDING', 'CLEARED', 'REJECTED'));
    END IF;
END $$;

UPDATE payments SET clearance_status = 'CLEARED'
WHERE clearance_status IS NULL OR TRIM(clearance_status) = '';

CREATE INDEX IF NOT EXISTS idx_payments_clearance_status ON payments(clearance_status);

-- Paying roles can record payments (Super Admin already has all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Admin', 'Cashier', 'Revenue Officer', 'Revenue Collector')
  AND p.code = 'record_payment'
ON CONFLICT DO NOTHING;
