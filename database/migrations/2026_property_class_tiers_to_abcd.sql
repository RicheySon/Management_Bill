-- Normalize property classifications to Category A–D (fee-fixing CAT A–D).
-- Handles legacy labels: Residential/Commercial/Industrial and 1st–4th Class.

-- 1) Rename legacy use-type / class-tier names when Category label is free
UPDATE property_classifications pc
SET name = 'Category A',
    description = 'Category A — fee fixing CAT A column'
WHERE pc.name IN ('1st Class', 'Residential')
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category A');

UPDATE property_classifications pc
SET name = 'Category B',
    description = 'Category B — fee fixing CAT B column'
WHERE pc.name IN ('2nd Class', 'Commercial')
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category B');

UPDATE property_classifications pc
SET name = 'Category C',
    description = 'Category C — fee fixing CAT C column'
WHERE pc.name IN ('3rd Class', 'Industrial')
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category C');

UPDATE property_classifications pc
SET name = 'Category D',
    description = 'Category D — fee fixing CAT D column'
WHERE pc.name IN ('4th Class', 'Mixed Use')
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category D');

-- 2) Ensure Category A–D exist
INSERT INTO property_classifications (name, description, base_rate)
SELECT v.name, v.description, v.base_rate
FROM (VALUES
    ('Category A', 'Category A — fee fixing CAT A column', 12.00),
    ('Category B', 'Category B — fee fixing CAT B column', 10.00),
    ('Category C', 'Category C — fee fixing CAT C column', 8.00),
    ('Category D', 'Category D — fee fixing CAT D column', 6.00)
) AS v(name, description, base_rate)
WHERE NOT EXISTS (
    SELECT 1 FROM property_classifications pc WHERE pc.name = v.name
);

-- 3) Re-point properties still on leftover legacy rows onto Category A–D
UPDATE properties p
SET classification_id = cat.id
FROM property_classifications old
JOIN property_classifications cat ON cat.name = CASE old.name
    WHEN '1st Class' THEN 'Category A'
    WHEN 'Residential' THEN 'Category A'
    WHEN '2nd Class' THEN 'Category B'
    WHEN 'Commercial' THEN 'Category B'
    WHEN '3rd Class' THEN 'Category C'
    WHEN 'Industrial' THEN 'Category C'
    WHEN '4th Class' THEN 'Category D'
    WHEN 'Mixed Use' THEN 'Category D'
END
WHERE p.classification_id = old.id
  AND old.name IN (
      '1st Class', '2nd Class', '3rd Class', '4th Class',
      'Residential', 'Commercial', 'Industrial', 'Mixed Use'
  );

-- 4) Remove leftover legacy labels
DELETE FROM property_classifications
WHERE name IN (
    '1st Class', '2nd Class', '3rd Class', '4th Class',
    'Residential', 'Commercial', 'Industrial', 'Mixed Use'
);
