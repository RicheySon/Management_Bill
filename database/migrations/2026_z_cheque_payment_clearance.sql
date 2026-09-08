-- Cheque payments stay pending until Revenue Officer confirms clearance (or declines bounce)

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

-- Existing payments already applied to bills
UPDATE payments SET clearance_status = 'CLEARED' WHERE clearance_status IS NULL OR clearance_status = '';

CREATE INDEX IF NOT EXISTS idx_payments_clearance_status ON payments(clearance_status);

INSERT INTO permissions (code, description)
VALUES ('approve_cheque_payments', 'Approve or decline pending cheque payments after bank clearance')
ON CONFLICT (code) DO NOTHING;

-- Revenue Officer is the only clearance approver (not Super Admin / Admin)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Revenue Officer'
  AND p.code = 'approve_cheque_payments'
ON CONFLICT DO NOTHING;
