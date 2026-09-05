-- Persist assessed bill amounts chosen at registration time
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS assessed_amount DECIMAL(12, 2);

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS assessed_amount DECIMAL(12, 2);

COMMENT ON COLUMN properties.assessed_amount IS 'Annual property rate amount set at registration or by admin; used when generating bills';
COMMENT ON COLUMN businesses.assessed_amount IS 'Annual BOP fee set at registration or by admin; used when generating bills';
