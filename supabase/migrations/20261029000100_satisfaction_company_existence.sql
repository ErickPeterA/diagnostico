ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS exists_in_company boolean;

COMMENT ON COLUMN answers.exists_in_company IS
  'Indica se o item avaliado por uma pergunta de satisfação existe na empresa.';
