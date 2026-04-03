ALTER TABLE users
ADD COLUMN IF NOT EXISTS staff_type TEXT NOT NULL DEFAULT 'basic_grade_scientist';

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS form_family_reference TEXT NOT NULL DEFAULT 'FOR-CUH-PAT-2';

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS template_kind TEXT NOT NULL DEFAULT 'training_event_competency';

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS target_staff_type TEXT NOT NULL DEFAULT 'basic_grade_scientist';

CREATE TABLE IF NOT EXISTS training_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  lab_id INTEGER NOT NULL REFERENCES labs(id) ON DELETE RESTRICT,
  assigned_by INTEGER REFERENCES users(id),
  renewal_interval_months INTEGER NOT NULL DEFAULT 12,
  next_due_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, template_id)
);

ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS assigned_trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS training_assignment_id INTEGER REFERENCES training_assignments(id) ON DELETE SET NULL;

ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS trainee_signed_at TIMESTAMP;

ALTER TABLE training_records
ADD COLUMN IF NOT EXISTS assessment_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS training_record_specimens (
  id SERIAL PRIMARY KEY,
  training_record_id INTEGER NOT NULL REFERENCES training_records(id) ON DELETE CASCADE,
  specimen_label TEXT NOT NULL,
  specimen_type TEXT,
  analyser_reference TEXT,
  processed_at TIMESTAMP,
  result_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
