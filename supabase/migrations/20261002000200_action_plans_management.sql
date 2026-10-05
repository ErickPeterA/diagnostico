BEGIN;

CREATE TYPE action_priority AS ENUM ('low','medium','high');

ALTER TABLE action_plans RENAME COLUMN title TO problem;
ALTER TABLE action_plans RENAME COLUMN action TO proposed_action;
ALTER TABLE action_plans ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE action_plans ADD COLUMN priority action_priority NOT NULL DEFAULT 'medium';
ALTER TABLE action_plans ADD COLUMN notes text;

UPDATE action_plans ap
SET company_id = d.company_id
FROM diagnostics d
WHERE d.id = ap.diagnostic_id;

UPDATE action_plans SET responsible = 'Não informado' WHERE responsible IS NULL;
UPDATE action_plans SET due_date = created_at::date WHERE due_date IS NULL;

ALTER TABLE action_plans ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE action_plans ALTER COLUMN responsible SET NOT NULL;
ALTER TABLE action_plans ALTER COLUMN due_date SET NOT NULL;

CREATE INDEX idx_action_plans_company ON action_plans(company_id);
CREATE INDEX idx_action_plans_company_status_due ON action_plans(company_id,status,due_date);

COMMIT;
