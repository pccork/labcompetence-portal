CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO hospitals (name)
VALUES ('CUH')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id) ON DELETE RESTRICT;

ALTER TABLE labs
ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id) ON DELETE RESTRICT;

ALTER TABLE labs
ADD COLUMN IF NOT EXISTS is_poc BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET hospital_id = (SELECT id FROM hospitals WHERE name = 'CUH')
WHERE hospital_id IS NULL;

UPDATE labs
SET hospital_id = (SELECT id FROM hospitals WHERE name = 'CUH')
WHERE hospital_id IS NULL;

ALTER TABLE users
ALTER COLUMN hospital_id SET NOT NULL;

ALTER TABLE labs
ALTER COLUMN hospital_id SET NOT NULL;

ALTER TABLE labs
DROP CONSTRAINT IF EXISTS labs_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'labs_hospital_id_name_key'
  ) THEN
    ALTER TABLE labs
    ADD CONSTRAINT labs_hospital_id_name_key UNIQUE (hospital_id, name);
  END IF;
END $$;
