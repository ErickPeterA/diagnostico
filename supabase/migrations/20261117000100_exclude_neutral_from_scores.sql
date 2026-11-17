-- Respostas neutras continuam nas contagens, mas não participam de notas e percentuais.
CREATE OR REPLACE VIEW diagnostic_metrics AS
SELECT diagnostic_id,
       count(DISTINCT interview_id) AS interview_count,
       count(answer_id) AS answer_count,
       round(avg(CASE WHEN lower(btrim(answer_label)) IN ('neutro','neutra') THEN NULL ELSE weight END) * 10, 1) AS favorability,
       round(avg(CASE WHEN lower(btrim(answer_label)) IN ('neutro','neutra') THEN NULL ELSE weight END), 2) AS average_weight
FROM answer_facts
GROUP BY diagnostic_id;
