ALTER TABLE interviews ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS schedule_notes text;

CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at
  ON interviews(diagnostic_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'not_started';
