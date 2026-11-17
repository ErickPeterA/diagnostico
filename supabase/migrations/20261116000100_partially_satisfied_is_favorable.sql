-- "Parcialmente satisfeito" integra a favorabilidade em todas as perguntas,
-- tanto no questionário padrão quanto nos diagnósticos já existentes.
UPDATE answer_options
SET favorable = true
WHERE lower(btrim(label)) = lower('Parcialmente satisfeito')
  AND favorable IS DISTINCT FROM true;
