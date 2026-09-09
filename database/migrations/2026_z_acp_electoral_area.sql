-- Add ACP electoral area (was only a community "ACP Estates" under POKUASE)
INSERT INTO electoral_areas (name, code)
SELECT 'ACP', 'ACP'
WHERE NOT EXISTS (
    SELECT 1 FROM electoral_areas WHERE code = 'ACP' OR UPPER(TRIM(name)) = 'ACP'
);

-- Link ACP Estates / ACP communities to the ACP electoral area when present
UPDATE local_areas la
SET electoral_area_id = ea.id
FROM electoral_areas ea
WHERE ea.code = 'ACP'
  AND la.name ILIKE 'ACP%'
  AND la.electoral_area_id IS DISTINCT FROM ea.id;
