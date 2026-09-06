-- Replace use-type labels (Residential/Commercial/Industrial) with property class tiers.
-- Existing property FKs keep the same classification ids.

UPDATE property_classifications
SET name = '1st Class',
    description = 'First class properties',
    base_rate = 12.00
WHERE name = 'Residential';

UPDATE property_classifications
SET name = '2nd Class',
    description = 'Second class properties',
    base_rate = 10.00
WHERE name = 'Commercial';

UPDATE property_classifications
SET name = '3rd Class',
    description = 'Third class properties',
    base_rate = 8.00
WHERE name = 'Industrial';

INSERT INTO property_classifications (name, description, base_rate)
SELECT '4th Class', 'Fourth class properties', 6.00
WHERE NOT EXISTS (
    SELECT 1 FROM property_classifications WHERE name = '4th Class'
);

-- Ensure names exist even on databases that never had the old seeds
INSERT INTO property_classifications (name, description, base_rate)
SELECT v.name, v.description, v.base_rate
FROM (VALUES
    ('1st Class', 'First class properties', 12.00),
    ('2nd Class', 'Second class properties', 10.00),
    ('3rd Class', 'Third class properties', 8.00),
    ('4th Class', 'Fourth class properties', 6.00)
) AS v(name, description, base_rate)
WHERE NOT EXISTS (
    SELECT 1 FROM property_classifications pc WHERE pc.name = v.name
);
