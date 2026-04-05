ALTER TABLE poc_training_requests
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE poc_training_requests
ADD COLUMN IF NOT EXISTS requested_hospital_id INTEGER REFERENCES hospitals(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS requested_name TEXT,
ADD COLUMN IF NOT EXISTS requested_email TEXT,
ADD COLUMN IF NOT EXISTS requested_staff_type TEXT;

UPDATE poc_training_requests ptr
SET
  requested_hospital_id = u.hospital_id,
  requested_name = u.name,
  requested_email = u.email,
  requested_staff_type = u.staff_type
FROM users u
WHERE ptr.user_id = u.id
  AND (
    ptr.requested_hospital_id IS NULL
    OR ptr.requested_name IS NULL
    OR ptr.requested_email IS NULL
    OR ptr.requested_staff_type IS NULL
  );

ALTER TABLE poc_training_requests
ALTER COLUMN requested_hospital_id SET NOT NULL,
ALTER COLUMN requested_name SET NOT NULL,
ALTER COLUMN requested_email SET NOT NULL,
ALTER COLUMN requested_staff_type SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poc_training_requests_pending_requester_idx
ON poc_training_requests (registration_link_id, lower(requested_email))
WHERE user_id IS NULL;
