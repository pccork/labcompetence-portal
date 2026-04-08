ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE training_records
SET is_active = TRUE
WHERE is_active IS NULL;
