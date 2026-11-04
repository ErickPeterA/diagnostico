UPDATE answer_options ao
SET weight = scale.weight,
    favorable = scale.favorable,
    sort_order = scale.sort_order,
    active = true
FROM questions q,
     (VALUES
       ('Muito insatisfeito', 1::numeric, false, 1),
       ('Insatisfeito', 2::numeric, false, 2),
       ('Neutro', 3::numeric, false, 3),
       ('Satisfeito', 5::numeric, true, 5),
       ('Muito satisfeito', 6::numeric, true, 6)
     ) AS scale(label, weight, favorable, sort_order)
WHERE ao.question_id = q.id
  AND q.type = 'satisfaction_scale'
  AND ao.label = scale.label;

INSERT INTO answer_options(question_id, label, weight, favorable, sort_order, active)
SELECT q.id, 'Parcialmente satisfeito', 4, false, 4, true
FROM questions q
WHERE q.type = 'satisfaction_scale'
ON CONFLICT(question_id, label) DO UPDATE
SET weight = excluded.weight,
    favorable = excluded.favorable,
    sort_order = excluded.sort_order,
    active = true;
