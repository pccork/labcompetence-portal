ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET is_global_admin = TRUE
WHERE email = 'admin@test.com';

UPDATE users
SET is_global_admin = TRUE
WHERE id = (
  SELECT id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM users
  WHERE is_global_admin = TRUE
);
