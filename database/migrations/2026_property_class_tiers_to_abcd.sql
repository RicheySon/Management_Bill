-- After class-tier migration: use Category A–D labels (fee-fixing CAT A–D).
-- Prefer renaming 1st–4th → Category A–D; if Category labels already exist, drop unused tier duplicates.

-- Rename when the Category label is not already taken
UPDATE property_classifications pc
SET name = 'Category A',
    description = 'Category A — fee fixing CAT A / 1st class column'
WHERE pc.name = '1st Class'
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category A');

UPDATE property_classifications pc
SET name = 'Category B',
    description = 'Category B — fee fixing CAT B / 2nd class column'
WHERE pc.name = '2nd Class'
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category B');

UPDATE property_classifications pc
SET name = 'Category C',
    description = 'Category C — fee fixing CAT C / 3rd class column'
WHERE pc.name = '3rd Class'
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category C');

UPDATE property_classifications pc
SET name = 'Category D',
    description = 'Category D — fee fixing CAT D / 4th class column'
WHERE pc.name = '4th Class'
  AND NOT EXISTS (SELECT 1 FROM property_classifications x WHERE x.name = 'Category D');

-- Ensure the four categories exist
INSERT INTO property_classifications (name, description, base_rate)
SELECT v.name, v.description, v.base_rate
FROM (VALUES
    ('Category A', 'Category A — fee fixing CAT A / 1st class column', 12.00),
    ('Category B', 'Category B — fee fixing CAT B / 2nd class column', 10.00),
    ('Category C', 'Category C — fee fixing CAT C / 3rd class column', 8.00),
    ('Category D', 'Category D — fee fixing CAT D / 4th class column', 6.00)
) AS v(name, description, base_rate)
WHERE NOT EXISTS (
    SELECT 1 FROM property_classifications pc WHERE pc.name = v.name
);

-- Re-point any properties still on leftover 1st–4th Class rows onto Category A–D, then remove leftovers
UPDATE properties p
SET classification_id = cat.id
FROM property_classifications old
JOIN property_classifications cat ON cat.name = CASE old.name
    WHEN '1st Class' THEN 'Category A'
    WHEN '2nd Class' THEN 'Category B'
    WHEN '3rd Class' THEN 'Category C'
    WHEN '4th Class' THEN 'Category D'
END
WHERE p.classification_id = old.id
  AND old.name IN ('1st Class', '2nd Class', '3rd Class', '4th Class');

DELETE FROM property_classifications
WHERE name IN ('1st Class', '2nd Class', '3rd Class', '4th Class');
