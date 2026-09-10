import pool from '../config/database';

let customerCodeEnsured = false;
let customerCodeBackfillDone = false;

/**
 * Ensure GNPRO / GNBPRO / GNBOP customer-code functions + triggers exist.
 * Production often deploys app code without running SQL migrations, so old
 * triggers keep issuing GN-BOP-2026-###### / GN-PR-2026-######.
 */
export const ensureCustomerCodeSchema = async (): Promise<void> => {
    if (customerCodeEnsured) return;

    // New codes are up to ~18 chars; placeholders during backfill need room for UUIDs
    await pool.query(`
        ALTER TABLE properties
            ALTER COLUMN property_number TYPE VARCHAR(64)
    `);
    await pool.query(`
        ALTER TABLE businesses
            ALTER COLUMN business_number TYPE VARCHAR(64)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS area_sequences (
            id SERIAL PRIMARY KEY,
            sequence_type VARCHAR(30) NOT NULL,
            electoral_area_id INTEGER NOT NULL REFERENCES electoral_areas(id),
            last_number INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (sequence_type, electoral_area_id)
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_area_sequences_lookup
            ON area_sequences (sequence_type, electoral_area_id)
    `);

    await pool.query(`
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
        $$ LANGUAGE plpgsql IMMUTABLE
    `);

    await pool.query(`
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
        $$ LANGUAGE plpgsql
    `);

    await pool.query(`
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
        $$ LANGUAGE plpgsql
    `);

    await pool.query(`
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
        $$ LANGUAGE plpgsql
    `);

    // Make sure insert triggers exist (idempotent recreate)
    await pool.query(`DROP TRIGGER IF EXISTS before_insert_property ON properties`);
    await pool.query(`
        CREATE TRIGGER before_insert_property
        BEFORE INSERT ON properties
        FOR EACH ROW
        EXECUTE FUNCTION trg_generate_property_number()
    `);

    await pool.query(`DROP TRIGGER IF EXISTS before_insert_business ON businesses`);
    await pool.query(`
        CREATE TRIGGER before_insert_business
        BEFORE INSERT ON businesses
        FOR EACH ROW
        EXECUTE FUNCTION trg_generate_business_number()
    `);

    customerCodeEnsured = true;
    console.log('✅ Customer code schema ensured (GNPRO / GNBPRO / GNBOP)');
};

/**
 * One-time backfill: rewrite legacy GN-PR-YYYY-###### / GN-BOP-YYYY-######
 * codes to the location-based format when electoral + local area are present.
 */
export const backfillLegacyCustomerCodes = async (): Promise<{
    properties: number;
    businesses: number;
}> => {
    await ensureCustomerCodeSchema();
    if (customerCodeBackfillDone) {
        return { properties: 0, businesses: 0 };
    }

    let propertiesUpdated = 0;
    let businessesUpdated = 0;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Raise area sequence watermarks from codes already in the new format
        // so backfilled numbers don't collide with them.
        const existingModern = await client.query(
            `
            SELECT 'PROPERTY'::text AS sequence_type, electoral_area_id,
                   MAX(SUBSTRING(property_number FROM length(property_number) - 5)::int) AS max_seq
            FROM properties
            WHERE property_number ~ '^GNPRO[A-Z]{6}[0-9]{6}$'
              AND electoral_area_id IS NOT NULL
            GROUP BY electoral_area_id
            UNION ALL
            SELECT 'BUSINESS_PROPERTY', electoral_area_id,
                   MAX(SUBSTRING(property_number FROM length(property_number) - 5)::int)
            FROM properties
            WHERE property_number ~ '^GNBPRO[A-Z]{6}[0-9]{6}$'
              AND electoral_area_id IS NOT NULL
            GROUP BY electoral_area_id
            UNION ALL
            SELECT 'BUSINESS', electoral_area_id,
                   MAX(SUBSTRING(business_number FROM length(business_number) - 5)::int)
            FROM businesses
            WHERE business_number ~ '^GNBOP[A-Z]{6}[0-9]{6}$'
              AND electoral_area_id IS NOT NULL
            GROUP BY electoral_area_id
            `
        );

        for (const row of existingModern.rows) {
            await client.query(
                `INSERT INTO area_sequences (sequence_type, electoral_area_id, last_number)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (sequence_type, electoral_area_id)
                 DO UPDATE SET
                    last_number = GREATEST(area_sequences.last_number, EXCLUDED.last_number),
                    updated_at = CURRENT_TIMESTAMP`,
                [row.sequence_type, row.electoral_area_id, row.max_seq]
            );
        }

        const props = await client.query(
            `SELECT id, property_kind, electoral_area_id, local_area_id
             FROM properties
             WHERE (
                    property_number ~ '^GN-PR-[0-9]{4}-'
                 OR property_number ~ '^GN-BP-[0-9]{4}-'
                 OR property_number ~ '^GN-BOP-[0-9]{4}-'
             )
             AND local_area_id IS NOT NULL
             ORDER BY COALESCE(electoral_area_id, 0), created_at ASC, id ASC`
        );

        for (const row of props.rows) {
            const seqType =
                row.property_kind === 'BUSINESS_PROPERTY' ? 'BUSINESS_PROPERTY' : 'PROPERTY';
            // Temporary unique placeholder avoids unique collisions while rewriting
            const placeholder = `TMP-PROP-${row.id}`;
            await client.query(`UPDATE properties SET property_number = $1 WHERE id = $2`, [
                placeholder,
                row.id,
            ]);
            const codeRes = await client.query(
                `SELECT generate_customer_code($1, $2, $3) AS code`,
                [seqType, row.electoral_area_id, row.local_area_id]
            );
            await client.query(`UPDATE properties SET property_number = $1 WHERE id = $2`, [
                codeRes.rows[0].code,
                row.id,
            ]);
            propertiesUpdated += 1;
        }

        const businesses = await client.query(
            `SELECT id, electoral_area_id, local_area_id
             FROM businesses
             WHERE (
                    business_number ~ '^GN-BOP-[0-9]{4}-'
                 OR business_number ~ '^GN-PR-[0-9]{4}-'
                 OR business_number ~ '^GN-BP-[0-9]{4}-'
             )
             AND local_area_id IS NOT NULL
             ORDER BY COALESCE(electoral_area_id, 0), created_at ASC, id ASC`
        );

        for (const row of businesses.rows) {
            const placeholder = `TMP-BIZ-${row.id}`;
            await client.query(`UPDATE businesses SET business_number = $1 WHERE id = $2`, [
                placeholder,
                row.id,
            ]);
            const codeRes = await client.query(
                `SELECT generate_customer_code($1, $2, $3) AS code`,
                ['BUSINESS', row.electoral_area_id, row.local_area_id]
            );
            await client.query(`UPDATE businesses SET business_number = $1 WHERE id = $2`, [
                codeRes.rows[0].code,
                row.id,
            ]);
            businessesUpdated += 1;
        }

        await client.query('COMMIT');
        customerCodeBackfillDone = true;
        console.log(
            `✅ Backfilled customer codes: ${propertiesUpdated} properties, ${businessesUpdated} businesses`
        );
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Customer code backfill failed:', err);
        throw err;
    } finally {
        client.release();
    }

    return { properties: propertiesUpdated, businesses: businessesUpdated };
};

/** Ensure schema + run backfill once (safe to call on login / register). */
export const ensureCustomerCodesReady = async (): Promise<void> => {
    await ensureCustomerCodeSchema();
    try {
        await backfillLegacyCustomerCodes();
    } catch (err) {
        // Don't block login/register if backfill fails; new inserts still use new triggers
        console.error('Customer code backfill skipped due to error:', err);
    }
};
