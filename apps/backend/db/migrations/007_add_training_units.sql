CREATE TABLE IF NOT EXISTS training_units (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (lab_id, name)
);

CREATE TABLE IF NOT EXISTS user_training_units (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  training_unit_id INTEGER NOT NULL REFERENCES training_units(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, training_unit_id)
);

INSERT INTO training_units (lab_id, name)
SELECT l.id, l.name
FROM labs l
ON CONFLICT (lab_id, name) DO NOTHING;

INSERT INTO user_training_units (user_id, training_unit_id, assigned_at)
SELECT
  ul.user_id,
  tu.id,
  ul.assigned_at
FROM user_labs ul
INNER JOIN labs l ON l.id = ul.lab_id
INNER JOIN training_units tu
  ON tu.lab_id = l.id
  AND tu.name = l.name
ON CONFLICT (user_id, training_unit_id) DO NOTHING;

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS training_unit_id INTEGER REFERENCES training_units(id) ON DELETE CASCADE;

UPDATE templates t
SET training_unit_id = tu.id
FROM training_units tu
INNER JOIN labs l ON l.id = tu.lab_id
WHERE t.lab_id = l.id
  AND tu.name = l.name
  AND t.training_unit_id IS NULL;

UPDATE templates t
SET training_unit_id = (
  SELECT tu.id
  FROM training_units tu
  WHERE tu.lab_id = t.lab_id
  ORDER BY tu.id ASC
  LIMIT 1
)
WHERE t.training_unit_id IS NULL
  AND t.lab_id IS NOT NULL;

ALTER TABLE training_assignments
ADD COLUMN IF NOT EXISTS training_unit_id INTEGER REFERENCES training_units(id) ON DELETE RESTRICT;

UPDATE training_assignments ta
SET training_unit_id = tu.id
FROM training_units tu
INNER JOIN labs l ON l.id = tu.lab_id
WHERE ta.lab_id = l.id
  AND tu.name = l.name
  AND ta.training_unit_id IS NULL;

UPDATE training_assignments ta
SET training_unit_id = (
  SELECT tu.id
  FROM training_units tu
  WHERE tu.lab_id = ta.lab_id
  ORDER BY tu.id ASC
  LIMIT 1
)
WHERE ta.training_unit_id IS NULL;

ALTER TABLE poc_registration_links
ADD COLUMN IF NOT EXISTS training_unit_id INTEGER REFERENCES training_units(id) ON DELETE CASCADE;

UPDATE poc_registration_links prl
SET training_unit_id = tu.id
FROM training_units tu
INNER JOIN labs l ON l.id = tu.lab_id
WHERE prl.lab_id = l.id
  AND tu.name = l.name
  AND prl.training_unit_id IS NULL;

UPDATE poc_registration_links prl
SET training_unit_id = (
  SELECT tu.id
  FROM training_units tu
  WHERE tu.lab_id = prl.lab_id
  ORDER BY tu.id ASC
  LIMIT 1
)
WHERE prl.training_unit_id IS NULL;

ALTER TABLE poc_training_requests
ADD COLUMN IF NOT EXISTS training_unit_id INTEGER REFERENCES training_units(id) ON DELETE CASCADE;

UPDATE poc_training_requests ptr
SET training_unit_id = tu.id
FROM training_units tu
INNER JOIN labs l ON l.id = tu.lab_id
WHERE ptr.lab_id = l.id
  AND tu.name = l.name
  AND ptr.training_unit_id IS NULL;

UPDATE poc_training_requests ptr
SET training_unit_id = (
  SELECT tu.id
  FROM training_units tu
  WHERE tu.lab_id = ptr.lab_id
  ORDER BY tu.id ASC
  LIMIT 1
)
WHERE ptr.training_unit_id IS NULL;

ALTER TABLE templates
ALTER COLUMN training_unit_id SET NOT NULL;

ALTER TABLE training_assignments
ALTER COLUMN training_unit_id SET NOT NULL;

ALTER TABLE poc_registration_links
ALTER COLUMN training_unit_id SET NOT NULL;

ALTER TABLE poc_training_requests
ALTER COLUMN training_unit_id SET NOT NULL;
