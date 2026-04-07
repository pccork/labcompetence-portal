CREATE TABLE IF NOT EXISTS email_dispatch_log (
  id SERIAL PRIMARY KEY,
  notification_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  reserved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS email_dispatch_log_lookup_idx
ON email_dispatch_log (notification_type, entity_type, entity_id, recipient_email);
