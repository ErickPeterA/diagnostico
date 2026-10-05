BEGIN;

ALTER TABLE diagnostics ADD COLUMN conductor_name text;
ALTER TABLE interviews ADD COLUMN conductor_name text;

UPDATE diagnostics SET conductor_name = 'Não informado' WHERE conductor_name IS NULL;
UPDATE interviews SET conductor_name = 'Não informado' WHERE conductor_name IS NULL;

ALTER TABLE diagnostics ALTER COLUMN conductor_name SET NOT NULL;
ALTER TABLE interviews ALTER COLUMN conductor_name SET NOT NULL;
ALTER TABLE diagnostics ALTER COLUMN conductor_name SET DEFAULT 'Não informado';
ALTER TABLE interviews ALTER COLUMN conductor_name SET DEFAULT 'Não informado';

COMMIT;
