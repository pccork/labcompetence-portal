ALTER TABLE poc_registration_links
ADD COLUMN IF NOT EXISTS default_training_location TEXT,
ADD COLUMN IF NOT EXISTS default_training_time_details TEXT;

CREATE TABLE IF NOT EXISTS poc_training_requests (
  id SERIAL PRIMARY KEY,
  registration_link_id INTEGER NOT NULL REFERENCES poc_registration_links(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id INTEGER NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  is_training_approved BOOLEAN NOT NULL DEFAULT TRUE,
  trainer_reply_status TEXT NOT NULL DEFAULT 'pending_trainer_reply',
  training_location TEXT,
  training_time_details TEXT,
  trainer_message TEXT,
  responded_by INTEGER REFERENCES users(id),
  responded_at TIMESTAMP,
  requested_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (registration_link_id, user_id)
);
