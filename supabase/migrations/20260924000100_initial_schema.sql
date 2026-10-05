BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE diagnostic_status AS ENUM ('draft','active','collecting','analysis','completed','archived');
CREATE TYPE interview_status AS ENUM ('not_started','in_progress','completed','cancelled');
CREATE TYPE question_type AS ENUM ('yes_no','satisfaction_scale','open_text');
CREATE TYPE sentiment_type AS ENUM ('positive','negative','neutral','opportunity');
CREATE TYPE review_status AS ENUM ('pending','approved','edited','rejected');
CREATE TYPE action_status AS ENUM ('planned','in_progress','completed','cancelled');
CREATE TYPE person_role AS ENUM ('leader','director');

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  approximate_employee_count integer CHECK (approximate_employee_count IS NULL OR approximate_employee_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text NOT NULL,
  password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name text NOT NULL, description text, status diagnostic_status NOT NULL DEFAULT 'draft', starts_on date, ends_on date,
  favorable_threshold numeric(5,2) NOT NULL DEFAULT 75 CHECK (favorable_threshold BETWEEN 0 AND 100),
  critical_threshold numeric(5,2) NOT NULL DEFAULT 60 CHECK (critical_threshold BETWEEN 0 AND 100),
  minimum_sample_size integer NOT NULL DEFAULT 5 CHECK (minimum_sample_size >= 3),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,name)
);
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,name)
);
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, role person_role NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE people_departments (
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY(person_id, department_id)
);
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), diagnostic_id uuid NOT NULL REFERENCES diagnostics(id) ON DELETE CASCADE,
  name text NOT NULL, description text, sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(diagnostic_id,name)
);
CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  code text NOT NULL, text text NOT NULL, type question_type NOT NULL, help_text text,
  target_role person_role, justification_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, code), CHECK (type <> 'open_text' OR justification_required = false)
);
CREATE TABLE answer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label text NOT NULL, weight numeric(8,3) NOT NULL, favorable boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, UNIQUE(question_id,label)
);
CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), diagnostic_id uuid NOT NULL REFERENCES diagnostics(id) ON DELETE RESTRICT,
  interviewer_id uuid REFERENCES users(id) ON DELETE SET NULL, anonymous_code text NOT NULL,
  status interview_status NOT NULL DEFAULT 'not_started', started_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(diagnostic_id, anonymous_code)
);
CREATE TABLE interview_profiles (
  interview_id uuid PRIMARY KEY REFERENCES interviews(id) ON DELETE CASCADE,
  gender text, tenure_band text, department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL, registered_role_divergence boolean,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE interview_people (
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  relationship_order smallint NOT NULL DEFAULT 1 CHECK (relationship_order BETWEEN 1 AND 3),
  PRIMARY KEY(interview_id, person_id), UNIQUE(interview_id, relationship_order)
);
CREATE TABLE answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  answer_option_id uuid REFERENCES answer_options(id) ON DELETE RESTRICT, open_text text,
  related_person_id uuid REFERENCES people(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, question_id, related_person_id),
  CHECK ((answer_option_id IS NOT NULL AND open_text IS NULL) OR (answer_option_id IS NULL AND open_text IS NOT NULL))
);
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), answer_id uuid NOT NULL UNIQUE REFERENCES answers(id) ON DELETE CASCADE,
  original_text text NOT NULL, normalized_text text, normalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lcod_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), diagnostic_id uuid NOT NULL REFERENCES diagnostics(id) ON DELETE CASCADE,
  name text NOT NULL, sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, UNIQUE(diagnostic_id,name)
);
CREATE TABLE lcod_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lcod_category_id uuid NOT NULL REFERENCES lcod_categories(id) ON DELETE CASCADE,
  name text NOT NULL, description text, active boolean NOT NULL DEFAULT true, UNIQUE(lcod_category_id,name)
);
CREATE TABLE comment_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  lcod_topic_id uuid NOT NULL REFERENCES lcod_topics(id) ON DELETE RESTRICT, sentiment sentiment_type NOT NULL,
  confidence numeric(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  rationale text, suggested_by_ai boolean NOT NULL DEFAULT true, review_status review_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(comment_id,lcod_topic_id,sentiment)
);
CREATE TABLE action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), diagnostic_id uuid NOT NULL REFERENCES diagnostics(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL, lcod_topic_id uuid REFERENCES lcod_topics(id) ON DELETE SET NULL,
  title text NOT NULL, action text NOT NULL, responsible text, due_date date, status action_status NOT NULL DEFAULT 'planned',
  source text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX idx_diagnostics_company ON diagnostics(company_id);
CREATE INDEX idx_categories_diagnostic_order ON categories(diagnostic_id, sort_order) WHERE active;
CREATE INDEX idx_questions_category_order ON questions(category_id, sort_order) WHERE active;
CREATE INDEX idx_interviews_diagnostic_status ON interviews(diagnostic_id,status);
CREATE INDEX idx_answers_interview ON answers(interview_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_profiles_filters ON interview_profiles(department_id,position_id,gender,tenure_band);
CREATE INDEX idx_classifications_topic_sentiment ON comment_classifications(lcod_topic_id,sentiment);

COMMIT;
