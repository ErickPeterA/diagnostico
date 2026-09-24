BEGIN;

-- Seed exclusivamente fictício e idempotente. Nunca é executado pelo startup.
DELETE FROM diagnostics WHERE id='00000000-0000-4000-8000-00000000d002';
DELETE FROM companies WHERE id='00000000-0000-4000-8000-00000000d001';

INSERT INTO companies(id,name,trade_name,approximate_employee_count,notes,active)
VALUES('00000000-0000-4000-8000-00000000d001','Empresa Demonstração','Horizonte Demo',40,'Organização integralmente fictícia para validação visual.',true);

INSERT INTO diagnostics(id,company_id,name,description,status,starts_on,ends_on,expected_interview_count,favorable_threshold,critical_threshold,minimum_sample_size,notes)
VALUES('00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d001','Diagnóstico de Clima 2026','Cenário fictício completo para demonstração.','collecting','2026-02-01','2026-03-31',40,75,60,5,'Dados gerados pelo seed explícito seeds/demo.sql.');

INSERT INTO departments(id,company_id,name,sort_order) VALUES
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000d001','Administrativo',1),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000d001','Financeiro',2),
('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000d001','Comercial',3),
('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000d001','Operacional',4),
('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000d001','Gestão',5);

INSERT INTO positions(id,company_id,department_id,name,sort_order) VALUES
('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000d001',NULL,'Assistente',1),
('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000d001',NULL,'Analista',2),
('20000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000d001',NULL,'Coordenador',3),
('20000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000d001',NULL,'Consultor',4),
('20000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000d001',NULL,'Supervisor',5);

INSERT INTO people(id,company_id,name,role,position_id,active) VALUES
('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000d001','Alex Horizonte','leader','20000000-0000-4000-8000-000000000003',true),
('30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000d001','Bruna Exemplo','leader','20000000-0000-4000-8000-000000000005',true),
('30000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000d001','Caio Modelo','leader','20000000-0000-4000-8000-000000000003',true),
('30000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000d001','Diana Cenário','leader','20000000-0000-4000-8000-000000000005',true),
('30000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000d001','Eduardo Demonstração','director','20000000-0000-4000-8000-000000000003',true),
('30000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-00000000d001','Fernanda Protótipo','director','20000000-0000-4000-8000-000000000003',true);
INSERT INTO people_departments(person_id,department_id)
SELECT p.id,d.id FROM people p JOIN departments d ON d.company_id=p.company_id WHERE p.company_id='00000000-0000-4000-8000-00000000d001' AND ((p.id IN('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005') AND d.name IN('Administrativo','Financeiro')) OR (p.id='30000000-0000-4000-8000-000000000002' AND d.name='Comercial') OR (p.id='30000000-0000-4000-8000-000000000003' AND d.name='Operacional') OR (p.id IN('30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000006') AND d.name='Gestão'));
INSERT INTO diagnostic_people(diagnostic_id,person_id) SELECT '00000000-0000-4000-8000-00000000d002',id FROM people WHERE company_id='00000000-0000-4000-8000-00000000d001';

INSERT INTO categories(id,diagnostic_id,name,description,sort_order) VALUES
('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000d002','Comunicação','Fluxo, clareza e disponibilidade das informações.',1),
('40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000d002','Liderança','Apoio, orientação e relacionamento com líderes.',2),
('40000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000d002','Gestão','Organização, reconhecimento e tomada de decisão.',3),
('40000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000d002','Infraestrutura','Recursos, tecnologia e ambiente físico.',4),
('40000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000d002','Produtividade','Carga, processos, prioridades e eficiência.',5),
('40000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-00000000d002','Relacionamento','Colaboração, respeito e convivência.',6);

INSERT INTO questions(id,category_id,code,text,type,target_role,justification_required,required,sort_order) VALUES
(md5('q01')::uuid,'40000000-0000-4000-8000-000000000001','P01','As informações necessárias para o trabalho chegam com clareza?','satisfaction_scale',NULL,true,true,1),
(md5('q02')::uuid,'40000000-0000-4000-8000-000000000001','P02','A comunicação entre setores funciona de forma eficiente?','satisfaction_scale',NULL,true,true,2),
(md5('q03')::uuid,'40000000-0000-4000-8000-000000000001','P03','A diretoria comunica decisões importantes com antecedência?','satisfaction_scale','director',true,true,3),
(md5('q04')::uuid,'40000000-0000-4000-8000-000000000001','P04','Você costuma descobrir mudanças somente depois que elas já aconteceram?','yes_no',NULL,true,true,4),
(md5('q05')::uuid,'40000000-0000-4000-8000-000000000001','P05','O que poderia melhorar na comunicação da empresa?','open_text',NULL,false,true,5),
(md5('q06')::uuid,'40000000-0000-4000-8000-000000000002','P06','Sua liderança está disponível quando você precisa?','satisfaction_scale','leader',true,true,1),
(md5('q07')::uuid,'40000000-0000-4000-8000-000000000002','P07','Sua liderança fornece orientações claras?','satisfaction_scale','leader',true,true,2),
(md5('q08')::uuid,'40000000-0000-4000-8000-000000000002','P08','Você recebe feedback útil sobre seu trabalho?','satisfaction_scale','leader',true,true,3),
(md5('q09')::uuid,'40000000-0000-4000-8000-000000000002','P09','Sua liderança reconhece entregas e esforços?','yes_no','leader',true,true,4),
(md5('q10')::uuid,'40000000-0000-4000-8000-000000000002','P10','Como você descreveria o apoio recebido da liderança?','open_text','leader',false,true,5),
(md5('q11')::uuid,'40000000-0000-4000-8000-000000000003','P11','As prioridades da área são bem definidas?','satisfaction_scale',NULL,true,true,1),
(md5('q12')::uuid,'40000000-0000-4000-8000-000000000003','P12','As decisões são tomadas de forma coerente?','satisfaction_scale',NULL,true,true,2),
(md5('q13')::uuid,'40000000-0000-4000-8000-000000000003','P13','Você percebe reconhecimento pelo trabalho realizado?','satisfaction_scale',NULL,true,true,3),
(md5('q14')::uuid,'40000000-0000-4000-8000-000000000003','P14','Existe retrabalho frequente por falta de organização?','yes_no',NULL,true,true,4),
(md5('q15')::uuid,'40000000-0000-4000-8000-000000000003','P15','Que mudança de gestão teria maior impacto positivo?','open_text',NULL,false,true,5),
(md5('q16')::uuid,'40000000-0000-4000-8000-000000000004','P16','Os equipamentos disponíveis atendem às necessidades?','satisfaction_scale',NULL,true,true,1),
(md5('q17')::uuid,'40000000-0000-4000-8000-000000000004','P17','O ambiente físico oferece conforto adequado?','satisfaction_scale',NULL,true,true,2),
(md5('q18')::uuid,'40000000-0000-4000-8000-000000000004','P18','Os sistemas e tecnologias facilitam o trabalho?','satisfaction_scale',NULL,true,true,3),
(md5('q19')::uuid,'40000000-0000-4000-8000-000000000004','P19','Faltam recursos essenciais para executar suas atividades?','yes_no',NULL,true,true,4),
(md5('q20')::uuid,'40000000-0000-4000-8000-000000000004','P20','Qual melhoria de infraestrutura é mais necessária?','open_text',NULL,false,true,5),
(md5('q21')::uuid,'40000000-0000-4000-8000-000000000005','P21','A carga de trabalho é compatível com o tempo disponível?','satisfaction_scale',NULL,true,true,1),
(md5('q22')::uuid,'40000000-0000-4000-8000-000000000005','P22','Os processos ajudam a realizar as atividades com eficiência?','satisfaction_scale',NULL,true,true,2),
(md5('q23')::uuid,'40000000-0000-4000-8000-000000000005','P23','Você consegue organizar suas prioridades?','satisfaction_scale',NULL,true,true,3),
(md5('q24')::uuid,'40000000-0000-4000-8000-000000000005','P24','A sobrecarga acontece com frequência?','yes_no',NULL,true,true,4),
(md5('q25')::uuid,'40000000-0000-4000-8000-000000000005','P25','O que ajudaria a melhorar a produtividade?','open_text',NULL,false,true,5),
(md5('q26')::uuid,'40000000-0000-4000-8000-000000000006','P26','Existe colaboração entre as pessoas da equipe?','satisfaction_scale',NULL,true,true,1),
(md5('q27')::uuid,'40000000-0000-4000-8000-000000000006','P27','Você se sente respeitado no ambiente de trabalho?','satisfaction_scale',NULL,true,true,2),
(md5('q28')::uuid,'40000000-0000-4000-8000-000000000006','P28','As pessoas se ajudam em períodos de maior demanda?','satisfaction_scale',NULL,true,true,3),
(md5('q29')::uuid,'40000000-0000-4000-8000-000000000006','P29','Existem conflitos que prejudicam o trabalho da equipe?','yes_no',NULL,true,true,4),
(md5('q30')::uuid,'40000000-0000-4000-8000-000000000006','P30','Qual é o principal ponto positivo do relacionamento entre colegas?','open_text',NULL,false,true,5);

-- Escalas são configuradas no banco; perguntas negativas têm "Não" como favorável.
INSERT INTO answer_options(id,question_id,label,weight,favorable,sort_order)
SELECT md5(q.code||'-'||o.label)::uuid,q.id,o.label,o.weight,o.favorable,o.ord FROM questions q CROSS JOIN LATERAL (VALUES
('Muito insatisfeito',1::numeric,false,1),('Insatisfeito',2,false,2),('Neutro',3,false,3),('Satisfeito',4,true,4),('Muito satisfeito',5,true,5))o(label,weight,favorable,ord)
WHERE q.type='satisfaction_scale' AND q.category_id IN(SELECT id FROM categories WHERE diagnostic_id='00000000-0000-4000-8000-00000000d002');
INSERT INTO answer_options(id,question_id,label,weight,favorable,sort_order)
SELECT md5(q.code||'-Sim')::uuid,q.id,'Sim',CASE WHEN q.code IN('P04','P14','P19','P24','P29') THEN 1 ELSE 5 END,q.code NOT IN('P04','P14','P19','P24','P29'),1 FROM questions q WHERE q.type='yes_no' AND q.category_id IN(SELECT id FROM categories WHERE diagnostic_id='00000000-0000-4000-8000-00000000d002');
INSERT INTO answer_options(id,question_id,label,weight,favorable,sort_order)
SELECT md5(q.code||'-Não')::uuid,q.id,'Não',CASE WHEN q.code IN('P04','P14','P19','P24','P29') THEN 5 ELSE 1 END,q.code IN('P04','P14','P19','P24','P29'),2 FROM questions q WHERE q.type='yes_no' AND q.category_id IN(SELECT id FROM categories WHERE diagnostic_id='00000000-0000-4000-8000-00000000d002');

INSERT INTO lcod_categories(id,diagnostic_id,name,sort_order) VALUES
('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000d002','Comunicação',1),('50000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000d002','Liderança',2),('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000d002','Infraestrutura',3),('50000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000d002','Produtividade',4),('50000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000d002','Relacionamento e Gestão',5);
INSERT INTO lcod_topics(id,lcod_category_id,name,sort_order) VALUES
(md5('lc01')::uuid,'50000000-0000-4000-8000-000000000001','Comunicação entre setores',1),(md5('lc02')::uuid,'50000000-0000-4000-8000-000000000001','Comunicação da liderança',2),(md5('lc03')::uuid,'50000000-0000-4000-8000-000000000001','Comunicação da diretoria',3),(md5('lc04')::uuid,'50000000-0000-4000-8000-000000000001','Clareza da informação',4),(md5('lc05')::uuid,'50000000-0000-4000-8000-000000000001','Atraso na informação',5),
(md5('lc06')::uuid,'50000000-0000-4000-8000-000000000002','Feedback',1),(md5('lc07')::uuid,'50000000-0000-4000-8000-000000000002','Apoio',2),(md5('lc08')::uuid,'50000000-0000-4000-8000-000000000002','Reconhecimento',3),(md5('lc09')::uuid,'50000000-0000-4000-8000-000000000002','Clareza das orientações',4),(md5('lc10')::uuid,'50000000-0000-4000-8000-000000000002','Disponibilidade',5),
(md5('lc11')::uuid,'50000000-0000-4000-8000-000000000003','Equipamentos',1),(md5('lc12')::uuid,'50000000-0000-4000-8000-000000000003','Ambiente físico',2),(md5('lc13')::uuid,'50000000-0000-4000-8000-000000000003','Conforto',3),(md5('lc14')::uuid,'50000000-0000-4000-8000-000000000003','Tecnologia',4),
(md5('lc15')::uuid,'50000000-0000-4000-8000-000000000004','Sobrecarga',1),(md5('lc16')::uuid,'50000000-0000-4000-8000-000000000004','Organização',2),(md5('lc17')::uuid,'50000000-0000-4000-8000-000000000004','Processos',3),(md5('lc18')::uuid,'50000000-0000-4000-8000-000000000004','Prioridades',4),
(md5('lc19')::uuid,'50000000-0000-4000-8000-000000000005','Colaboração',1),(md5('lc20')::uuid,'50000000-0000-4000-8000-000000000005','Respeito',2),(md5('lc21')::uuid,'50000000-0000-4000-8000-000000000005','Reconhecimento da empresa',3);

-- 34 concluídas, 3 em andamento e 1 não iniciada.
INSERT INTO interviews(id,diagnostic_id,anonymous_code,status,started_at,completed_at,created_at,updated_at)
SELECT md5('interview-'||n)::uuid,'00000000-0000-4000-8000-00000000d002','ENT-'||lpad(n::text,4,'0'),CASE WHEN n<=34 THEN 'completed'::interview_status WHEN n<=37 THEN 'in_progress'::interview_status ELSE 'not_started'::interview_status END,CASE WHEN n<=37 THEN now()-((40-n)||' days')::interval END,CASE WHEN n<=34 THEN now()-((35-n)||' days')::interval END,now()-((45-n)||' days')::interval,now() FROM generate_series(1,38)n;
INSERT INTO interview_profiles(interview_id,gender,tenure_band,department_id,position_id,registered_role_divergence)
SELECT i.id,CASE (n%3) WHEN 0 THEN 'Masculino' WHEN 1 THEN 'Feminino' ELSE 'Prefere não informar' END,CASE (n%5) WHEN 0 THEN 'Menos de 1 ano' WHEN 1 THEN '1–3 anos' WHEN 2 THEN '4–6 anos' WHEN 3 THEN '7–10 anos' ELSE 'Mais de 10 anos' END,('10000000-0000-4000-8000-00000000000'||((n-1)%5+1))::uuid,('20000000-0000-4000-8000-00000000000'||((n-1)%5+1))::uuid,n%9=0 FROM interviews i CROSS JOIN LATERAL (SELECT right(i.anonymous_code,4)::int n)x WHERE i.diagnostic_id='00000000-0000-4000-8000-00000000d002';
INSERT INTO interview_people(interview_id,person_id,relationship_order)
SELECT i.id,('30000000-0000-4000-8000-00000000000'||((n-1)%4+1))::uuid,1 FROM interviews i CROSS JOIN LATERAL(SELECT right(i.anonymous_code,4)::int n)x WHERE i.diagnostic_id='00000000-0000-4000-8000-00000000d002'
UNION ALL SELECT i.id,('30000000-0000-4000-8000-00000000000'||(5+(n%2)))::uuid,4 FROM interviews i CROSS JOIN LATERAL(SELECT right(i.anonymous_code,4)::int n)x WHERE i.diagnostic_id='00000000-0000-4000-8000-00000000d002';

-- Pontuação determinística por categoria, setor e pessoa avaliada.
WITH candidates AS (
 SELECT i.id interview_id,right(i.anonymous_code,4)::int n,q.id question_id,q.code,q.type,q.target_role,c.name category,ip.department_id,
 CASE c.name WHEN 'Relacionamento' THEN 5 WHEN 'Infraestrutura' THEN 4 WHEN 'Produtividade' THEN 3 WHEN 'Gestão' THEN 3 WHEN 'Comunicação' THEN 2 ELSE 3 END
 +CASE WHEN c.name='Comunicação' AND ip.department_id='10000000-0000-4000-8000-000000000002' THEN 2 WHEN c.name='Comunicação' AND ip.department_id='10000000-0000-4000-8000-000000000003' THEN -1 WHEN c.name='Infraestrutura' AND ip.department_id='10000000-0000-4000-8000-000000000004' THEN -2 WHEN c.name='Relacionamento' AND ip.department_id='10000000-0000-4000-8000-000000000004' THEN 0 ELSE 0 END raw_score,
 (SELECT person_id FROM interview_people ix JOIN people p ON p.id=ix.person_id WHERE ix.interview_id=i.id AND p.role=q.target_role LIMIT 1) related_person_id
 FROM interviews i JOIN interview_profiles ip ON ip.interview_id=i.id CROSS JOIN questions q JOIN categories c ON c.id=q.category_id
 WHERE i.diagnostic_id='00000000-0000-4000-8000-00000000d002' AND (i.status='completed' OR (i.status='in_progress' AND q.code IN('P01','P02','P03','P04','P05','P06','P07','P08','P09','P10')))
), scored AS (
 SELECT *,greatest(1,least(5,raw_score + CASE WHEN category='Liderança' THEN CASE related_person_id WHEN '30000000-0000-4000-8000-000000000001' THEN 2 WHEN '30000000-0000-4000-8000-000000000002' THEN 1 WHEN '30000000-0000-4000-8000-000000000003' THEN -1 ELSE 0 END ELSE 0 END + CASE WHEN (n+ascii(right(code,1)))%5=0 THEN -1 WHEN (n+ascii(right(code,1)))%7=0 THEN 1 ELSE 0 END)) score FROM candidates
)
INSERT INTO answers(id,interview_id,question_id,answer_option_id,open_text,related_person_id)
SELECT md5(interview_id::text||question_id::text)::uuid,interview_id,question_id,
 CASE WHEN type='satisfaction_scale' THEN (SELECT id FROM answer_options WHERE question_id=s.question_id AND sort_order=s.score LIMIT 1) WHEN type='yes_no' THEN (SELECT id FROM answer_options WHERE question_id=s.question_id AND favorable=(s.score>=4) LIMIT 1) END,
 CASE WHEN type='open_text' THEN CASE category WHEN 'Comunicação' THEN 'A comunicação dentro da equipe funciona, mas informações de outros setores às vezes chegam tarde.' WHEN 'Liderança' THEN 'Consigo conversar com a liderança, embora o retorno e o reconhecimento possam ser mais frequentes.' WHEN 'Gestão' THEN 'Seria importante definir prioridades com mais antecedência e reconhecer melhor as entregas.' WHEN 'Infraestrutura' THEN CASE WHEN department_id='10000000-0000-4000-8000-000000000004' THEN 'Alguns equipamentos do operacional precisam de atualização e manutenção mais rápida.' ELSE 'A estrutura atende bem, com oportunidade de melhorar alguns sistemas.' END WHEN 'Produtividade' THEN 'Nos períodos de maior movimento, atividades acabam concentradas em poucas pessoas.' ELSE 'A equipe se ajuda bastante e mantém uma convivência respeitosa mesmo sob pressão.' END END,related_person_id FROM scored s;

INSERT INTO comments(id,answer_id,original_text,normalized_text,normalized_at)
SELECT md5('comment-'||a.id)::uuid,a.id,
 COALESCE(a.open_text,CASE c.name WHEN 'Comunicação' THEN CASE WHEN ao.favorable THEN 'Dentro da equipe a conversa funciona, mas ainda dá para organizar melhor os repasses.' ELSE 'Muitas vezes a informação chega tarde e sem contexto suficiente para executar o trabalho.' END WHEN 'Liderança' THEN CASE WHEN ao.favorable THEN 'Tenho liberdade para conversar com minha liderança quando preciso.' ELSE 'Sinto falta de feedback, reconhecimento e mais clareza nas orientações.' END WHEN 'Infraestrutura' THEN CASE WHEN ao.favorable THEN 'Os recursos ajudam no dia a dia e o ambiente é adequado.' ELSE 'Alguns equipamentos e sistemas atrasam o trabalho, principalmente nos horários de pico.' END WHEN 'Produtividade' THEN CASE WHEN ao.favorable THEN 'Os processos ajudam, embora existam períodos mais corridos.' ELSE 'Em períodos de maior movimento, algumas atividades ficam concentradas em poucas pessoas.' END WHEN 'Relacionamento' THEN CASE WHEN ao.favorable THEN 'A equipe se ajuda bastante e existe respeito entre as pessoas.' ELSE 'Existem alguns conflitos pontuais que precisam ser conversados.' END ELSE CASE WHEN ao.favorable THEN 'A organização tem avançado e as prioridades costumam ficar claras.' ELSE 'As prioridades mudam bastante e falta reconhecimento pelas entregas.' END END),
 CASE c.name WHEN 'Comunicação' THEN CASE WHEN ao.favorable THEN 'Relata boa comunicação interna, com oportunidade de organizar melhor os repasses.' ELSE 'Relata atraso e falta de contexto no recebimento das informações necessárias.' END WHEN 'Liderança' THEN CASE WHEN ao.favorable THEN 'Percebe abertura e disponibilidade da liderança para diálogo.' ELSE 'Percebe necessidade de maior frequência de feedback, reconhecimento e clareza.' END WHEN 'Infraestrutura' THEN CASE WHEN ao.favorable THEN 'Considera os recursos e o ambiente adequados ao trabalho.' ELSE 'Relata limitações em equipamentos ou sistemas que afetam a execução das atividades.' END WHEN 'Produtividade' THEN CASE WHEN ao.favorable THEN 'Avalia os processos positivamente, apesar de períodos de maior demanda.' ELSE 'Relata concentração de atividades e sobrecarga em períodos de maior movimento.' END WHEN 'Relacionamento' THEN CASE WHEN ao.favorable THEN 'Destaca colaboração e respeito na convivência entre colegas.' ELSE 'Relata conflitos pontuais que demandam alinhamento.' END ELSE CASE WHEN ao.favorable THEN 'Percebe evolução na organização e clareza das prioridades.' ELSE 'Relata mudanças frequentes de prioridade e pouco reconhecimento.' END END,now()
FROM answers a JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id;

-- Uma classificação revisada por comentário e uma segunda em parte dos comentários.
INSERT INTO comment_classifications(id,comment_id,lcod_topic_id,sentiment,confidence,rationale,suggested_by_ai,review_status,reviewed_at)
SELECT md5('class-'||cm.id)::uuid,cm.id,
 CASE c.name WHEN 'Comunicação' THEN CASE WHEN a.interview_id::text<'80000000' THEN md5('lc01')::uuid ELSE md5('lc05')::uuid END WHEN 'Liderança' THEN CASE WHEN q.code IN('P08','P09') THEN md5('lc08')::uuid ELSE md5('lc07')::uuid END WHEN 'Infraestrutura' THEN CASE WHEN q.code IN('P16','P19') THEN md5('lc11')::uuid ELSE md5('lc14')::uuid END WHEN 'Produtividade' THEN CASE WHEN q.code IN('P21','P24','P25') THEN md5('lc15')::uuid ELSE md5('lc17')::uuid END ELSE md5('lc19')::uuid END,
 CASE WHEN ao.favorable THEN 'positive'::sentiment_type WHEN q.type='open_text' AND (right(a.interview_id::text,1) IN('0','5')) THEN 'opportunity'::sentiment_type ELSE 'negative'::sentiment_type END,0.91,'Classificação fictícia revisada para demonstração.',true,'approved',now()
FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id;

INSERT INTO comment_classifications(id,comment_id,lcod_topic_id,sentiment,confidence,rationale,suggested_by_ai,review_status,reviewed_at)
SELECT md5('class-extra-'||cm.id)::uuid,cm.id,CASE c.name WHEN 'Comunicação' THEN md5('lc04')::uuid WHEN 'Liderança' THEN md5('lc06')::uuid WHEN 'Infraestrutura' THEN md5('lc13')::uuid WHEN 'Produtividade' THEN md5('lc18')::uuid ELSE md5('lc20')::uuid END,CASE WHEN ao.favorable THEN 'positive'::sentiment_type ELSE 'neutral'::sentiment_type END,0.82,'Classificação complementar fictícia.',true,'approved',now()
FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE right(a.interview_id::text,1) IN('0','3','6','9');

COMMIT;
