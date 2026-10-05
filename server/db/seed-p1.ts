import { pool } from './pool.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória para executar o seed P1.');
if (process.env.NODE_ENV === 'production' && process.env.P1_SEED_CONFIRM !== 'YES') {
  throw new Error('Seed P1 bloqueado em produção. Defina P1_SEED_CONFIRM=YES para confirmar a carga de teste.');
}

type QuestionSeed={category:string;text:string;type?:'satisfaction_scale'|'open_text';targetRole?:'leader'};
const groups:Record<string,string[]>={
  'Infraestrutura':[
    'As instalações físicas da sua área de trabalho apresentam bom estado de conservação e higiene?',
    'As instalações físicas das áreas comuns apresentam bom estado de conservação e higiene? (sanitários, vestiários, áreas e salas de trabalho, refeitório)',
    'A sua estação de trabalho possui ergonomia adequada? (cadeira, mesa, suporte para notebook)',
    'As instalações físicas são acessíveis a pessoas com deficiência?',
    'O nível de temperatura, ruído e luminosidade em sua área de trabalho é adequado para sua segurança?',
    'Quando há necessidade, a empresa oferece EPIs e materiais adequados para garantir sua segurança?'
  ],
  'Operação':[
    'A empresa oferece estrutura, materiais e sistemas necessários para realizar o seu trabalho? (materiais de escritório, móveis, eletrônicos e softwares)',
    'Você possui algum documento que liste quais são as atividades do seu cargo?',
    'Você recebeu treinamento nessas atividades ao entrar na empresa?',
    'Existe padronização documentada nos processos que você executa?'
  ],
  'Produtividade':[
    'Existe competitividade saudável na empresa? Como ela ocorre?',
    'Você está comprometido em entregar o melhor trabalho possível no seu cargo? Por quê?',
    'Você percebe que os colegas estão dispostos a trabalhar em equipe para atingir os resultados, inclusive diante de imprevistos e prazos?',
    'Os colaboradores são prestativos e proativos nas tarefas diárias e ajudam quando necessário?'
  ],
  'Gestão':[
    'A empresa tem uma estrutura organizacional definida e conhecida? (organograma, setores e responsáveis)',
    'Existe um planejamento estratégico conhecido pelos colaboradores? Você sabe quais são os principais objetivos da empresa?',
    'A Missão, a Visão e os Valores da empresa são conhecidos e acontecem na prática?',
    'Você confia nas decisões tomadas pela diretoria da empresa?',
    'A empresa preza pela qualidade de seus processos, produtos e serviços para o cliente final?'
  ],
  'Comunicação':[
    'As informações importantes da empresa chegam até você de forma clara e no tempo adequado?',
    'Os canais de comunicação da empresa são eficazes para manter você informado sobre assuntos relevantes?',
    'Você tem espaço para expressar ideias, opiniões ou sugestões dentro da empresa e do seu setor?',
    'Os líderes e gestores se comunicam de forma transparente e aberta com a equipe?',
    'Quando há mudanças ou decisões importantes, você é informado adequadamente sobre seus motivos e impactos?'
  ],
  'Lideranças da empresa':[
    'A empresa possui líderes adequados às responsabilidades de seus cargos?',
    'As lideranças tomam decisões alinhadas com a cultura da empresa?',
    'As lideranças são acessíveis quando você precisa de apoio ou esclarecimento?',
    'As lideranças estão comprometidas e alinhadas com os objetivos da empresa?'
  ],
  'Liderança imediata':[
    'Você contrataria essa pessoa para ser sua liderança, considerando o alcance de resultados?',
    'Sua liderança sabe delegar tarefas e acompanhar adequadamente o seu trabalho?',
    'Sua liderança possui a capacitação técnica necessária para orientar suas atividades?',
    'Sua liderança busca se desenvolver e aplicar melhorias nos métodos e processos do setor?',
    'Você considera sua liderança um exemplo, mantendo coerência entre o que fala e o que faz?',
    'Sua liderança se comunica com você e realiza feedbacks ou acompanhamentos periódicos?',
    'Sua liderança consegue engajar e manter a equipe motivada para o trabalho?',
    'Você tem um bom relacionamento com sua liderança no dia a dia?'
  ],
  'Orgulho e pertencimento':[
    'Seu trabalho tem um sentido especial e você sente orgulho de contar que trabalha na empresa?',
    'Você pretende desenvolver sua carreira e permanecer por muito tempo na empresa?',
    'Você acredita que seus colegas sentem orgulho de trabalhar na empresa?'
  ],
  'Relacionamento interpessoal':[
    'Você acredita que todos estão seguindo na mesma direção e trabalhando pelos mesmos objetivos?',
    'Você percebe que seus colegas têm vontade de vir para o trabalho?',
    'Existe um clima de abertura e confiança entre você e seus colegas?',
    'Os colaboradores respeitam e são respeitados, independentemente de religião, etnia, idade, orientação sexual ou outras características?'
  ],
  'Gestão de pessoas':[
    'A empresa oferece treinamentos suficientes e necessários, incluindo capacitação e integração?',
    'Existem oportunidades de crescimento de carreira na empresa? Como elas acontecem?',
    'Seu desempenho é avaliado periodicamente e de forma clara?',
    'Existe uma política de férias padronizada e bem organizada?',
    'Com base nas últimas contratações, o processo de recrutamento e seleção está sendo bem executado?'
  ],
  'Ambiente e bem-estar':[
    'Este é um ambiente psicologicamente e emocionalmente saudável para trabalhar e conciliar a vida pessoal e profissional?',
    'Existem momentos, pessoas ou canais pelos quais você pode ser ouvido e acolhido dentro da empresa?',
    'A empresa promove ações de integração ou celebração, como confraternizações, aniversários e endomarketing?'
  ],
  'Remuneração e benefícios':[
    'A empresa possui benefícios espontâneos e você está satisfeito com os tipos e a qualidade oferecidos?',
    'Você gostaria de substituir algum benefício espontâneo ou sugerir outro?',
    'Você conhece seu salário-base e sua remuneração variável, como comissões e metas?',
    'Comparando sua remuneração com o mercado para seu cargo, você está satisfeito?'
  ]
};

const questions:QuestionSeed[]=Object.entries(groups).flatMap(([category,texts])=>texts.map(text=>({category,text,targetRole:category==='Liderança imediata'?'leader' as const:undefined})));
questions.push(
  {category:'Perguntas abertas',type:'open_text',text:'Mencione algo que você manteria no seu dia a dia para executar suas atividades da melhor maneira possível.'},
  {category:'Perguntas abertas',type:'open_text',text:'Mencione algo que você mudaria no seu dia a dia para executar suas atividades da melhor maneira possível.'},
  {category:'Perguntas abertas',type:'open_text',text:'Se a empresa fosse sua, qual ação, ideia, processo ou forma de trabalho você manteria? Escolha somente uma.'},
  {category:'Perguntas abertas',type:'open_text',text:'Se a empresa fosse sua, qual ação, ideia, processo ou forma de trabalho você mudaria, implementaria ou melhoraria? Escolha somente uma.'}
);

const COMPANY_ID='f1000000-0000-4000-8000-000000000001';
const DIAGNOSTIC_ID='f1000000-0000-4000-8000-000000000002';
const DEPARTMENT_ID='f1000000-0000-4000-8000-000000000003';
const POSITION_ID='f1000000-0000-4000-8000-000000000004';
const LEADER_ID='f1000000-0000-4000-8000-000000000005';
const DIRECTOR_ID='f1000000-0000-4000-8000-000000000006';
const client=await pool.connect();
try{
  await client.query('BEGIN');
  await client.query(`INSERT INTO companies(id,name,trade_name,approximate_employee_count,notes,active) VALUES($1,'Empresa Teste P1','Empresa Teste P1',50,'Base de teste criada a partir da aba P1 do diagnóstico de clima.',true) ON CONFLICT(id) DO UPDATE SET name=excluded.name,trade_name=excluded.trade_name,notes=excluded.notes,active=true,updated_at=now()`,[COMPANY_ID]);
  await client.query(`INSERT INTO diagnostics(id,company_id,name,description,status,expected_interview_count,favorable_threshold,critical_threshold,minimum_sample_size,notes) VALUES($1,$2,'Diagnóstico de Clima P1','Questionário padrão baseado na planilha P1.','collecting',20,75,60,5,'Carga de teste idempotente.') ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,status=excluded.status,expected_interview_count=excluded.expected_interview_count,updated_at=now()`,[DIAGNOSTIC_ID,COMPANY_ID]);
  await client.query(`INSERT INTO departments(id,company_id,name,sort_order,active) VALUES($1,$2,'Geral',0,true) ON CONFLICT(id) DO UPDATE SET active=true`,[DEPARTMENT_ID,COMPANY_ID]);
  await client.query(`INSERT INTO positions(id,company_id,name,department_id,sort_order,active) VALUES($1,$2,'Colaborador(a)', $3,0,true) ON CONFLICT(id) DO UPDATE SET department_id=excluded.department_id,active=true`,[POSITION_ID,COMPANY_ID,DEPARTMENT_ID]);
  await client.query(`INSERT INTO people(id,company_id,name,role,position_id,active) VALUES($1,$2,'Liderança Teste','leader',$3,true),($4,$2,'Diretoria Teste','director',$3,true) ON CONFLICT(id) DO UPDATE SET active=true`,[LEADER_ID,COMPANY_ID,POSITION_ID,DIRECTOR_ID]);
  await client.query(`INSERT INTO people_departments(person_id,department_id) VALUES($1,$3),($2,$3) ON CONFLICT DO NOTHING`,[LEADER_ID,DIRECTOR_ID,DEPARTMENT_ID]);
  await client.query(`INSERT INTO diagnostic_people(diagnostic_id,person_id,active) VALUES($1,$2,true),($1,$3,true) ON CONFLICT(diagnostic_id,person_id) DO UPDATE SET active=true`,[DIAGNOSTIC_ID,LEADER_ID,DIRECTOR_ID]);

  const categoryIds=new Map<string,string>();
  for(const [index,name] of [...new Set(questions.map(q=>q.category))].entries()){
    const row=await client.query(`INSERT INTO categories(diagnostic_id,name,description,sort_order,active) VALUES($1,$2,'Categoria baseada na planilha P1.',$3,true) ON CONFLICT(diagnostic_id,name) DO UPDATE SET sort_order=excluded.sort_order,active=true,updated_at=now() RETURNING id`,[DIAGNOSTIC_ID,name,index]);
    categoryIds.set(name,row.rows[0].id);
  }
  for(const [index,q] of questions.entries()){
    const type=q.type??'satisfaction_scale',code=`P${String(index+1).padStart(2,'0')}`;
    const row=await client.query(`INSERT INTO questions(category_id,code,text,type,target_role,justification_required,required,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,true,$7,true) ON CONFLICT(category_id,code) DO UPDATE SET text=excluded.text,type=excluded.type,target_role=excluded.target_role,justification_required=excluded.justification_required,required=true,sort_order=excluded.sort_order,active=true,updated_at=now() RETURNING id`,[categoryIds.get(q.category),code,q.text,type,q.targetRole??null,type!=='open_text',index]);
    if(type==='open_text'){await client.query('DELETE FROM answer_options WHERE question_id=$1',[row.rows[0].id]);continue}
    const options=[['Muito insatisfeito',1,false],['Insatisfeito',2,false],['Neutro',3,false],['Satisfeito',4,true],['Muito satisfeito',5,true]] as const;
    for(const [sortOrder,[label,weight,favorable]] of options.entries())await client.query(`INSERT INTO answer_options(question_id,label,weight,favorable,sort_order,active) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(question_id,label) DO UPDATE SET weight=excluded.weight,favorable=excluded.favorable,sort_order=excluded.sort_order,active=true`,[row.rows[0].id,label,weight,favorable,sortOrder]);
  }
  await client.query('COMMIT');
  console.log(`Seed P1 concluído: ${questions.length} perguntas em ${categoryIds.size} categorias.`);
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await pool.end()}
