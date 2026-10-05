-- Recria views analíticas ausentes em bancos com histórico legado inconsistente.
BEGIN;

CREATE OR REPLACE VIEW answer_facts AS
SELECT a.id AS answer_id, i.diagnostic_id, a.interview_id, a.question_id, q.category_id,
       a.answer_option_id, ao.label AS answer_label, ao.weight, ao.favorable,
       a.related_person_id, p.gender, p.tenure_band, p.department_id, p.position_id,
       c.original_text, c.normalized_text
FROM answers a
JOIN interviews i ON i.id = a.interview_id AND i.status = 'completed'
JOIN questions q ON q.id = a.question_id
LEFT JOIN answer_options ao ON ao.id = a.answer_option_id
LEFT JOIN interview_profiles p ON p.interview_id = i.id
LEFT JOIN comments c ON c.answer_id = a.id;

CREATE OR REPLACE VIEW diagnostic_metrics AS
SELECT diagnostic_id,
       count(DISTINCT interview_id) AS interview_count,
       count(answer_id) AS answer_count,
       round(100.0 * count(*) FILTER (WHERE favorable) / NULLIF(count(*) FILTER (WHERE answer_option_id IS NOT NULL),0),1) AS favorability,
       round(avg(weight),2) AS average_weight
FROM answer_facts
GROUP BY diagnostic_id;

COMMIT;
