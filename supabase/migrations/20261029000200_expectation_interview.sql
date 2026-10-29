ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'employee';

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_kind_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_kind_check
  CHECK (kind IN ('expectation','employee'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_interviews_expectation_per_diagnostic
  ON interviews(diagnostic_id) WHERE kind='expectation';

CREATE TABLE IF NOT EXISTS category_expectations (
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  expectation text NOT NULL CHECK (btrim(expectation) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(interview_id,category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_expectations_interview
  ON category_expectations(interview_id);
