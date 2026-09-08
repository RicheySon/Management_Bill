-- Business Property billing sector (building rate, distinct from BOP and residential Property Rate)

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS property_kind VARCHAR(30) NOT NULL DEFAULT 'RESIDENTIAL';

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

-- Allow BUSINESS_PROPERTY bills that target a property_id (same as PROPERTY_RATE target)
ALTER TABLE bills DROP CONSTRAINT IF EXISTS chk_bill_target;
ALTER TABLE bills ADD CONSTRAINT chk_bill_target CHECK (
    (bill_type = 'PROPERTY_RATE' AND property_id IS NOT NULL AND business_id IS NULL)
    OR (bill_type = 'BUSINESS_PROPERTY' AND property_id IS NOT NULL AND business_id IS NULL)
    OR (bill_type = 'BOP' AND business_id IS NOT NULL AND property_id IS NULL)
);

-- Sequence for GN-BP numbers
INSERT INTO system_sequences (sequence_type, year, last_number, prefix)
VALUES ('BUSINESS_PROPERTY', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 0, 'GN-BP')
ON CONFLICT (sequence_type, year) DO NOTHING;

-- Auto-number: BUSINESS_PROPERTY → GN-BP-YYYY-######
CREATE OR REPLACE FUNCTION generate_auto_number(
    p_sequence_type VARCHAR,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_next_number INTEGER;
    v_auto_number VARCHAR(30);
BEGIN
    SELECT prefix, last_number + 1
    INTO v_prefix, v_next_number
    FROM system_sequences
    WHERE sequence_type = p_sequence_type AND year = p_year
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO system_sequences (sequence_type, year, last_number, prefix)
        VALUES (
            p_sequence_type,
            p_year,
            1,
            CASE p_sequence_type
                WHEN 'PROPERTY' THEN 'GN-PR'
                WHEN 'BUSINESS_PROPERTY' THEN 'GN-BP'
                WHEN 'BUSINESS' THEN 'GN-BOP'
                WHEN 'BILL' THEN 'GN-BILL'
                WHEN 'RECEIPT' THEN 'GN-RCT'
                ELSE 'GN'
            END
        )
        RETURNING prefix, last_number INTO v_prefix, v_next_number;
    ELSE
        UPDATE system_sequences
        SET last_number = v_next_number,
            updated_at = CURRENT_TIMESTAMP
        WHERE sequence_type = p_sequence_type AND year = p_year;
    END IF;

    v_auto_number := v_prefix || '-' || p_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
    RETURN v_auto_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_generate_property_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.property_number IS NULL OR NEW.property_number = '' THEN
        IF COALESCE(NEW.property_kind, 'RESIDENTIAL') = 'BUSINESS_PROPERTY' THEN
            NEW.property_number := generate_auto_number('BUSINESS_PROPERTY', NEW.year_registered);
        ELSE
            NEW.property_number := generate_auto_number('PROPERTY', NEW.year_registered);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
