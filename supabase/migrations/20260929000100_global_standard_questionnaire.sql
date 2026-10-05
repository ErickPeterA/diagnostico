-- Replica o questionário padrão P1 nos diagnósticos já existentes.
-- Novos diagnósticos recebem a mesma cópia pela API de criação.
BEGIN;

DO $$
DECLARE
  source_id uuid := 'f1000000-0000-4000-8000-000000000002';
  target record;
  source_category record;
  target_category_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM diagnostics WHERE id=source_id) THEN
    RETURN;
  END IF;

  FOR target IN SELECT id FROM diagnostics WHERE id<>source_id LOOP
    FOR source_category IN
      SELECT * FROM categories WHERE diagnostic_id=source_id AND active ORDER BY sort_order,name
    LOOP
      INSERT INTO categories(diagnostic_id,name,description,sort_order,active)
      VALUES(target.id,source_category.name,source_category.description,source_category.sort_order,true)
      ON CONFLICT(diagnostic_id,name) DO UPDATE SET active=true
      RETURNING id INTO target_category_id;

      INSERT INTO questions(category_id,code,text,type,help_text,target_role,justification_required,required,sort_order,active)
      SELECT target_category_id,q.code,q.text,q.type,q.help_text,q.target_role,q.justification_required,q.required,q.sort_order,true
      FROM questions q WHERE q.category_id=source_category.id AND q.active
      ON CONFLICT(category_id,code) DO UPDATE SET
        text=excluded.text,type=excluded.type,help_text=excluded.help_text,target_role=excluded.target_role,
        justification_required=excluded.justification_required,required=excluded.required,
        sort_order=excluded.sort_order,active=true,updated_at=now();

      INSERT INTO answer_options(question_id,label,weight,favorable,sort_order,active)
      SELECT tq.id,ao.label,ao.weight,ao.favorable,ao.sort_order,ao.active
      FROM questions sq
      JOIN answer_options ao ON ao.question_id=sq.id
      JOIN questions tq ON tq.category_id=target_category_id AND tq.code=sq.code
      WHERE sq.category_id=source_category.id AND sq.active
      ON CONFLICT(question_id,label) DO UPDATE SET
        weight=excluded.weight,favorable=excluded.favorable,sort_order=excluded.sort_order,active=excluded.active;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
