-- Electoral/community admin support + optional business category
-- Communities must belong to an electoral area (already FK'd).
-- Make businesses.category_id optional (fee grade is business_category_class A/B/C/D).

ALTER TABLE businesses ALTER COLUMN category_id DROP NOT NULL;

-- Seed default communities for GA North electoral areas (idempotent)
INSERT INTO local_areas (name, electoral_area_id)
SELECT v.community, ea.id
FROM (VALUES
    ('Ofankor Barrier', 'OFANKOR NORTH'),
    ('Ahenbronum', 'OFANKOR NORTH'),
    ('Spot M', 'OFANKOR NORTH'),
    ('South Ofankor', 'OFANKOR SOUTH'),
    ('Police Station Area', 'OFANKOR SOUTH'),
    ('Market Area', 'OFANKOR SOUTH'),
    ('Amamoley Township', 'AMAMORLEY'),
    ('New Amamoley', 'AMAMORLEY'),
    ('Abease Community', 'AMAMORLEY'),
    ('Amanfrom', 'AMANFROM'),
    ('Peace Village', 'AMANFROM'),
    ('John Teye', 'AMANFROM'),
    ('Pokuase Township', 'POKUASE'),
    ('ACP Estates', 'POKUASE'),
    ('Guinness Depot', 'POKUASE'),
    ('Tantra Hill', 'TANTRA'),
    ('St. Johns', 'TANTRA'),
    ('Kingsby', 'TANTRA'),
    ('Asofan Township', 'ASOFAN'),
    ('Asofan Estate', 'ASOFAN'),
    ('Pipeline', 'ASOFAN'),
    ('Fise Township', 'FISE'),
    ('Hebron', 'FISE'),
    ('Kuotam', 'FISE'),
    ('Ayawaso', 'AYAWASO'),
    ('Nii Ankraman', 'AYAWASO'),
    ('Ga Odumase', 'AYAWASO'),
    ('Omanjor', 'OMANJOR'),
    ('Dwenewoho', 'OMANJOR'),
    ('Sowutuom Border', 'OMANJOR'),
    ('Afiaman', 'AFIAMAN'),
    ('Mayera', 'AFIAMAN'),
    ('Manhean', 'AFIAMAN'),
    ('Trobu', 'TROBU'),
    ('Mile 7', 'TROBU'),
    ('Antieku', 'TROBU'),
    ('Abensu', 'ABENSU'),
    ('Abesey', 'ABENSU'),
    ('New Pokuase', 'ABENSU'),
    ('Abease Township', 'ABEASE'),
    ('New Abease', 'ABEASE')
) AS v(community, ea_name)
JOIN electoral_areas ea ON ea.name = v.ea_name
WHERE NOT EXISTS (
    SELECT 1 FROM local_areas la
    WHERE la.name = v.community AND la.electoral_area_id = ea.id
);
