-- Property rate zones: class-tier fees (1st–4th) aligned with fee-fixing Excel
-- Safe to run repeatedly

ALTER TABLE property_rate_zones
    ADD COLUMN IF NOT EXISTS cat_a_fee DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS cat_b_fee DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS cat_c_fee DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS cat_d_fee DECIMAL(10,2);

-- Backfill CAT A from legacy minimum when empty
UPDATE property_rate_zones
SET cat_a_fee = minimum_rate_min
WHERE cat_a_fee IS NULL
  AND minimum_rate_min IS NOT NULL;
