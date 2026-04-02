-- HOSPITALS
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER REFERENCES hospitals(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LABS
CREATE TABLE IF NOT EXISTS labs (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER REFERENCES hospitals(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_poc BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (hospital_id, name)
);

-- USER_LABS
CREATE TABLE IF NOT EXISTS user_labs (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, lab_id)
);

-- TEMPLATES
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- TEMPLATE VERSIONS
CREATE TABLE IF NOT EXISTS template_versions (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  schema_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (template_id, version_number)
);

-- TRAINING RECORDS
CREATE TABLE IF NOT EXISTS training_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  template_version_id INTEGER REFERENCES template_versions(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ACKNOWLEDGEMENTS
CREATE TABLE IF NOT EXISTS acknowledgements (
  id SERIAL PRIMARY KEY,
  training_record_id INTEGER REFERENCES training_records(id) ON DELETE CASCADE,
  trainer_id INTEGER REFERENCES users(id),
  acknowledged_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (training_record_id)
);
