-- Enforce unique GCR numbers across all payments (one GCR = one payment)

-- Normalize any whitespace
UPDATE payments
SET gcr_number = TRIM(gcr_number)
WHERE gcr_number IS NOT NULL AND gcr_number <> TRIM(gcr_number);

-- If legacy duplicates exist, keep the earliest payment and suffix later ones so the unique index can apply.
WITH ranked AS (
    SELECT id,
           gcr_number,
           ROW_NUMBER() OVER (PARTITION BY gcr_number ORDER BY created_at ASC, id ASC) AS rn
    FROM payments
    WHERE gcr_number IS NOT NULL
      AND TRIM(gcr_number) <> ''
      AND UPPER(TRIM(gcr_number)) <> 'N/A'
)
UPDATE payments p
SET gcr_number = p.gcr_number || '-DUP' || ranked.rn::text
FROM ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gcr_number_unique
ON payments (gcr_number)
WHERE gcr_number IS NOT NULL
  AND TRIM(gcr_number) <> ''
  AND UPPER(TRIM(gcr_number)) <> 'N/A';
