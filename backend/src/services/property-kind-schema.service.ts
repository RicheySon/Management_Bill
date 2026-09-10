import pool from '../config/database';

let propertyKindEnsured = false;

/**
 * Ensure properties.property_kind exists.
 * Production DBs that skipped 2026_z_business_property_sector.sql break
 * GET /properties?property_kind=RESIDENTIAL (empty residential list in the UI).
 */
export const ensurePropertyKindSchema = async (): Promise<void> => {
    if (propertyKindEnsured) return;

    await pool.query(`
        ALTER TABLE properties
            ADD COLUMN IF NOT EXISTS property_kind VARCHAR(30) NOT NULL DEFAULT 'RESIDENTIAL'
    `);

    await pool.query(`
        UPDATE properties
        SET property_kind = 'RESIDENTIAL'
        WHERE property_kind IS NULL OR TRIM(property_kind) = ''
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'properties_property_kind_check'
            ) THEN
                ALTER TABLE properties
                    ADD CONSTRAINT properties_property_kind_check
                    CHECK (property_kind IN ('RESIDENTIAL', 'BUSINESS_PROPERTY'));
            END IF;
        END $$
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_properties_kind ON properties(property_kind)
    `);

    propertyKindEnsured = true;
};
