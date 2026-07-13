-- Trust Phase Migration: amount approvals, audit enrichment, schema drift, arrears roll-forward
-- Safe to run on existing databases (IF NOT EXISTS / ON CONFLICT)

-- =====================================================
-- 1. Schema drift: fee linkage columns
-- =====================================================
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS property_rate_zone_id INTEGER REFERENCES property_rate_zones(id) ON DELETE SET NULL;

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS fee_item_id INTEGER REFERENCES business_fee_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_rate_zone ON properties(property_rate_zone_id);
CREATE INDEX IF NOT EXISTS idx_businesses_fee_item ON businesses(fee_item_id);

-- =====================================================
-- 2. Arrears roll-forward
-- =====================================================
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS rolled_into_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_rolled_into ON bills(rolled_into_bill_id);

-- =====================================================
-- 3. Audit enrichment
-- =====================================================
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS mac_address VARCHAR(64),
    ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128),
    ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- =====================================================
-- 4. Amount change requests
-- =====================================================
CREATE TABLE IF NOT EXISTS amount_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('BILL', 'PROPERTY_RATE_ZONE', 'BUSINESS_FEE_ITEM')),
    entity_id VARCHAR(50) NOT NULL,
    field_changes JSONB,
    old_values JSONB NOT NULL,
    new_values JSONB NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_by UUID NOT NULL REFERENCES system_users(id),
    reviewed_by UUID REFERENCES system_users(id),
    reviewed_at TIMESTAMP,
    review_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_acr_status ON amount_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_acr_entity ON amount_change_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_acr_requested_by ON amount_change_requests(requested_by);

-- =====================================================
-- 5. Permissions
-- =====================================================
INSERT INTO permissions (code, description)
VALUES ('approve_amount_changes', 'Approve or reject pending amount changes on bills and fee rates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Super Admin' AND p.code = 'approve_amount_changes'
ON CONFLICT DO NOTHING;
