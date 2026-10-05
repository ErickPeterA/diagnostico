-- Lideranças e diretoria são cadastros da empresa e ficam disponíveis
-- em todos os diagnósticos dessa mesma empresa.
BEGIN;

INSERT INTO diagnostic_people(diagnostic_id,person_id,active)
SELECT d.id,p.id,true
FROM diagnostics d
JOIN people p ON p.company_id=d.company_id AND p.active
ON CONFLICT(diagnostic_id,person_id) DO UPDATE SET active=true;

COMMIT;
