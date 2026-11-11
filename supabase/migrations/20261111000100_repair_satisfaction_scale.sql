INSERT INTO answer_options(question_id, label, weight, favorable, sort_order, active)
SELECT q.id, scale.label, scale.weight, scale.favorable, scale.sort_order, true
FROM questions q
CROSS JOIN (VALUES
  ('Muito insatisfeito', 1::numeric, false, 1),
  ('Insatisfeito', 2::numeric, false, 2),
  ('Neutro', 3::numeric, false, 3),
  ('Parcialmente satisfeito', 4::numeric, false, 4),
  ('Satisfeito', 5::numeric, true, 5),
  ('Muito satisfeito', 6::numeric, true, 6)
) AS scale(label, weight, favorable, sort_order)
WHERE q.type = 'satisfaction_scale'
ON CONFLICT(question_id, label) DO UPDATE
SET weight = excluded.weight,
    favorable = excluded.favorable,
    sort_order = excluded.sort_order,
    active = true;
