-- Customer / property / BOP codes:
--   Property Rate:      GNPRO{EA3}{COMM3}{######}
--   Business Property:  GNBPRO{EA3}{COMM3}{######}
--   BOP:                GNBOP{EA3}{COMM3}{######}
-- Sequence resets per electoral area (and per code type).
-- Example: Tantra + Baabs property → GNPROTANBAA000001

-- Per-electoral-area counters for customer codes
CREATE TABLE IF NOT EXISTS area_sequences (
    id SERIAL PRIMARY KEY,
    sequence_type VARCHAR(30) NOT NULL,
    electoral_area_id INTEGER NOT NULL REFERENCES electoral_areas(id),
    last_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sequence_type, electoral_area_id)
);

CREATE INDEX IF NOT EXISTS idx_area_sequences_lookup
    ON area_sequences (sequence_type, electoral_area_id);

-- First 3 letters of a name (A–Z only), padded with X if shorter
CREATE OR REPLACE FUNCTION area_name_code(p_name TEXT)
RETURNS VARCHAR(3) AS $$
DECLARE
    v_letters TEXT;
BEGIN
    v_letters := UPPER(REGEXP_REPLACE(COALESCE(p_name, ''), '[^A-Za-z]', '', 'g'));
    IF LENGTH(v_letters) = 0 THEN
        RETURN 'XXX';
    END IF;
    RETURN RPAD(LEFT(v_letters, 3), 3, 'X');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate customer code with location + per-electoral-area sequence
CREATE OR REPLACE FUNCTION generate_customer_code(
    p_sequence_type VARCHAR,
    p_electoral_area_id INTEGER,
    p_local_area_id INTEGER
)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_ea_name TEXT;
    v_la_name TEXT;
    v_ea_code VARCHAR(3);
    v_la_code VARCHAR(3);
    v_next_number INTEGER;
    v_resolved_ea_id INTEGER;
BEGIN
    IF p_local_area_id IS NULL THEN
        RAISE EXCEPTION 'local_area_id is required to generate customer code';
    END IF;

    SELECT name, electoral_area_id
    INTO v_la_name, v_resolved_ea_id
    FROM local_areas
    WHERE id = p_local_area_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'local_area_id % not found', p_local_area_id;
    END IF;

    v_resolved_ea_id := COALESCE(p_electoral_area_id, v_resolved_ea_id);

    IF v_resolved_ea_id IS NULL THEN
        RAISE EXCEPTION 'electoral_area_id is required to generate customer code';
    END IF;

    SELECT name INTO v_ea_name
    FROM electoral_areas
    WHERE id = v_resolved_ea_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'electoral_area_id % not found', v_resolved_ea_id;
    END IF;

    v_prefix := CASE p_sequence_type
        WHEN 'PROPERTY' THEN 'GNPRO'
        WHEN 'BUSINESS_PROPERTY' THEN 'GNBPRO'
        WHEN 'BUSINESS' THEN 'GNBOP'
        ELSE NULL
    END;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'unsupported customer code sequence type: %', p_sequence_type;
    END IF;

    v_ea_code := area_name_code(v_ea_name);
    v_la_code := area_name_code(v_la_name);

    -- Lock / create per-(type, electoral area) sequence
    SELECT last_number + 1
    INTO v_next_number
    FROM area_sequences
    WHERE sequence_type = p_sequence_type
      AND electoral_area_id = v_resolved_ea_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO area_sequences (sequence_type, electoral_area_id, last_number)
        VALUES (p_sequence_type, v_resolved_ea_id, 1)
        ON CONFLICT (sequence_type, electoral_area_id)
        DO UPDATE SET
            last_number = area_sequences.last_number + 1,
            updated_at = CURRENT_TIMESTAMP
        RETURNING last_number INTO v_next_number;
    ELSE
        UPDATE area_sequences
        SET last_number = v_next_number,
            updated_at = CURRENT_TIMESTAMP
        WHERE sequence_type = p_sequence_type
          AND electoral_area_id = v_resolved_ea_id;
    END IF;

    RETURN v_prefix || v_ea_code || v_la_code || LPAD(v_next_number::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Property trigger: GNPRO / GNBPRO + area codes + sequence
CREATE OR REPLACE FUNCTION trg_generate_property_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.property_number IS NULL OR NEW.property_number = '' THEN
        IF COALESCE(NEW.property_kind, 'RESIDENTIAL') = 'BUSINESS_PROPERTY' THEN
            NEW.property_number := generate_customer_code(
                'BUSINESS_PROPERTY',
                NEW.electoral_area_id,
                NEW.local_area_id
            );
        ELSE
            NEW.property_number := generate_customer_code(
                'PROPERTY',
                NEW.electoral_area_id,
                NEW.local_area_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Business (BOP) trigger: GNBOP + area codes + sequence
CREATE OR REPLACE FUNCTION trg_generate_business_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.business_number IS NULL OR NEW.business_number = '' THEN
        NEW.business_number := generate_customer_code(
            'BUSINESS',
            NEW.electoral_area_id,
            NEW.local_area_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Keep year-based generate_auto_number for BILL / RECEIPT only;
-- refresh default prefixes for documentation / any leftover callers.
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
                WHEN 'PROPERTY' THEN 'GNPRO'
                WHEN 'BUSINESS_PROPERTY' THEN 'GNBPRO'
                WHEN 'BUSINESS' THEN 'GNBOP'
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
