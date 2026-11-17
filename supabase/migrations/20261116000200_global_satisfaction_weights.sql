-- Padroniza os pesos da escala em todo o sistema. Como respostas antigas apontam
-- para answer_options, os indicadores históricos passam a usar os novos pesos.
UPDATE answer_options ao
SET weight = scale.weight
FROM (VALUES
  ('Muito satisfeito', 10::numeric),
  ('Satisfeito', 7.5::numeric),
  ('Parcialmente satisfeito', 5::numeric),
  ('Insatisfeito', 2.5::numeric),
  ('Muito insatisfeito', 0::numeric),
  ('Neutro', 0::numeric)
) AS scale(label, weight)
WHERE lower(btrim(ao.label)) = lower(scale.label)
  AND ao.weight IS DISTINCT FROM scale.weight;
