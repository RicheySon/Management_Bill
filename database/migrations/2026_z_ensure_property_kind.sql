-- Ensure property_kind exists for residential vs business-property list filtering.
-- Runtime also self-heals via ensurePropertyKindSchema(); this covers migrate.js.

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS property_kind VARCHAR(30) NOT NULL DEFAULT 'RESIDENTIAL';

UPDATE properties
SET property_kind = 'RESIDENTIAL'
WHERE property_kind IS NULL OR TRIM(property_kind) = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'properties_property_kind_check'
    ) THEN
        ALTER TABLE properties
            ADD CONSTRAINT properties_property_kind_check
            CHECK (property_kind IN ('RESIDENTIAL', 'BUSINESS_PROPERTY'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_kind ON properties(property_kind);
