BEGIN;

-- Campos administrativos necessários para o kickoff sem reescrever a migration inicial.
ALTER TABLE companies ADD COLUMN trade_name text;
ALTER TABLE companies ADD COLUMN notes text;
ALTER TABLE companies ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE diagnostics ADD COLUMN expected_interview_count integer
  CHECK (expected_interview_count IS NULL OR expected_interview_count >= 0);
ALTER TABLE diagnostics ADD COLUMN notes text;

ALTER TABLE departments ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE positions ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE positions ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE people ADD COLUMN position_id uuid REFERENCES positions(id) ON DELETE SET NULL;

-- Pessoas pertencem à empresa, mas podem participar apenas de diagnósticos selecionados.
CREATE TABLE diagnostic_people (
  diagnostic_id uuid NOT NULL REFERENCES diagnostics(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (diagnostic_id, person_id)
);

ALTER TABLE questions ADD COLUMN required boolean NOT NULL DEFAULT true;
ALTER TABLE lcod_topics ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- PostgreSQL considera NULLs distintos por padrão; respostas sem pessoa relacionada
-- precisam continuar únicas para que o autosave seja idempotente.
ALTER TABLE answers DROP CONSTRAINT answers_interview_id_question_id_related_person_id_key;
ALTER TABLE answers ADD CONSTRAINT answers_interview_question_person_unique
  UNIQUE NULLS NOT DISTINCT (interview_id, question_id, related_person_id);

ALTER TABLE interview_people DROP CONSTRAINT interview_people_relationship_order_check;
ALTER TABLE interview_people ADD CONSTRAINT interview_people_relationship_order_check
  CHECK (relationship_order BETWEEN 1 AND 4);

CREATE INDEX idx_departments_company_order ON departments(company_id, sort_order);
CREATE INDEX idx_positions_company_department ON positions(company_id, department_id, sort_order);
CREATE INDEX idx_people_company_role ON people(company_id, role) WHERE active;
CREATE INDEX idx_diagnostic_people_diagnostic ON diagnostic_people(diagnostic_id) WHERE active;
CREATE INDEX idx_lcod_topics_category_order ON lcod_topics(lcod_category_id, sort_order) WHERE active;

INSERT INTO schema_migrations(version) VALUES ('003_configuration_crud.sql');
COMMIT;
