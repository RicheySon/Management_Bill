-- Ensure ACP electoral area exists (idempotent; also self-healed at runtime)
INSERT INTO electoral_areas (name, code)
SELECT 'ACP', 'ACP'
WHERE NOT EXISTS (
    SELECT 1 FROM electoral_areas WHERE code = 'ACP' OR UPPER(TRIM(name)) = 'ACP'
);

UPDATE local_areas la
SET electoral_area_id = ea.id
FROM electoral_areas ea
WHERE ea.code = 'ACP'
  AND la.name ILIKE 'ACP%'
  AND la.electoral_area_id IS DISTINCT FROM ea.id;
