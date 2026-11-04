ALTER TABLE interview_profiles
  ADD COLUMN IF NOT EXISTS registered_role_divergence_note text,
  ADD COLUMN IF NOT EXISTS director_note text;
