-- A pontuação percentual passa a ser a média dos pesos (escala 0 a 10)
-- convertida para 0 a 100. Isso recalcula automaticamente todo o histórico.
CREATE OR REPLACE VIEW diagnostic_metrics AS
SELECT diagnostic_id,
       count(DISTINCT interview_id) AS interview_count,
       count(answer_id) AS answer_count,
       round(avg(weight) * 10, 1) AS favorability,
       round(avg(weight), 2) AS average_weight
FROM answer_facts
GROUP BY diagnostic_id;
