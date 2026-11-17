import type { PoolClient } from 'pg';
import { pool } from './db/pool.js';

type Sentiment='positive'|'negative'|'neutral';
type Comment={id:string;interview_id:string;original_text:string;answerLabel:string|null;favorable:boolean|null;question:string;category:string};
type SemanticTopic={name:string;description:string;commentIds:string[]};

const normalize=(value:string)=>value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
const positiveWords=new Set('adequado adequada ajuda ajudam apoio bom boa bons boas claro clara clareza confortavel excelente funciona funcionam suficiente suficientes organizado organizada respeito respeitoso satisfeita satisfeito valorizado valorizada valorizacao reconhecimento reconhecido reconhecida oportunidade oportunidades colaboracao dialogo autonomia melhoria melhorias melhorou evoluiu facilita facilitam recebe recebeu treinamento treinamentos reciclagem reciclagens acompanhamento'.split(' '));
const negativeWords=new Set('atraso atrasos baixa baixo conflito conflitos confuso confusa demora demorado demorada desorganizado desorganizada dificil dificuldade dificuldades estresse excesso falha falhas falta faltam faltou inadequado inadequada inacabado inacabados lento lenta pouco pouca poucos poucas pressao problema problemas quebrado quebrada ruim ruins sobrecarga sujo suja insuficiente insuficientes tarde incompleto incompleta incompletos concentrado concentrada concentrados concentradas manutencao atualizacao atrasa atrasam mudam muda'.split(' '));
const negations=new Set(['nao','nunca','nem','sem']);
const contrast=new Set(['mas','porem','contudo','embora']);
const commentSentiment=(text:string):Sentiment=>{const words=normalize(text);let score=0,weight=1,deficitWindow=0;for(let index=0;index<words.length;index++){const word=words[index];if(contrast.has(word)){weight=1.35;deficitWindow=0;continue}const startsDeficit=['falta','faltam','faltou','sem','pouco','pouca','poucos','poucas','baixa','baixo'].includes(word);if(startsDeficit)deficitWindow=4;const negated=index>0&&negations.has(words[index-1]);if(positiveWords.has(word))score+=weight*(negated||deficitWindow>0?-1:1);if(negativeWords.has(word))score+=weight*(negated?1:-1);if(deficitWindow>0&&!startsDeficit)deficitWindow--}return score>.35?'positive':score<-.35?'negative':'neutral'};
const fallbackConcepts=[
 ['Comunicação entre as áreas','Relatos positivos, negativos ou neutros sobre informação, diálogo, transparência, alinhamento ou feedback.',['comunicacao','comunicar','informacao','informacoes','dialogo','transparencia','alinhamento','feedback']],
 ['Liderança e apoio às equipes','Relatos sobre gestores, supervisores ou direção e a forma como lideram e apoiam as equipes.',['lider','lideranca','gestor','gestao','chefe','diretor','supervisor','coordenador']],
 ['Reconhecimento profissional','Relatos sobre reconhecimento, valorização, mérito ou elogios pelo trabalho realizado.',['reconhecimento','reconhecido','valorizacao','valorizado','merito','elogio']],
 ['Remuneração e benefícios','Relatos sobre remuneração, pagamentos, benefícios, vales ou bônus.',['salario','remuneracao','pagamento','beneficio','beneficios','vale','bonus']],
 ['Carreira e crescimento profissional','Relatos sobre carreira, promoções, evolução e oportunidades de crescimento.',['carreira','crescimento','promocao','oportunidade','oportunidades','evolucao']],
 ['Treinamento e desenvolvimento','Relatos sobre capacitação, cursos, aprendizado ou desenvolvimento profissional.',['treinamento','capacitacao','curso','cursos','aprendizado','desenvolvimento']],
 ['Clima e relações de equipe','Relatos sobre colegas, respeito, colaboração, convivência e relacionamento entre equipes.',['clima','equipe','colegas','relacionamento','respeito','colaboracao','convivencia']],
 ['Carga de trabalho','Relatos sobre carga, volume, prazos, horas e distribuição de demandas.',['carga','sobrecarga','demanda','demandas','prazo','prazos','horas','volume']],
 ['Processos e organização','Relatos sobre processos, planejamento, burocracia, fluxos, rotinas e organização.',['processo','processos','organizacao','planejamento','burocracia','fluxo','rotina']],
 ['Estrutura física e ambiente','Relatos sobre instalações, espaço, mobiliário, limpeza, conforto, temperatura e ambiente físico.',['estrutura','instalacao','instalacoes','espaco','mobiliario','limpeza','conforto','temperatura','barulho']],
 ['Equipamentos e materiais','Relatos sobre equipamentos, materiais e ferramentas usados na execução das atividades.',['equipamento','equipamentos','material','materiais','ferramenta','ferramentas','maquina','maquinas']],
 ['Tecnologia e sistemas','Relatos sobre sistemas, softwares, computadores, internet, rede e recursos tecnológicos.',['sistema','sistemas','software','softwares','computador','computadores','internet','tecnologia','rede','conectividade']],
 ['Autonomia e participação','Relatos sobre liberdade, confiança e autonomia para decidir.',['autonomia','liberdade','decisao','decisoes','confianca']],
 ['Bem-estar e qualidade de vida','Relatos sobre saúde, estresse, pressão, qualidade de vida e equilíbrio.',['saude','estresse','pressao','qualidade','equilibrio','bem','estar']]
] as const;

const getSentiment=(comment:Comment):Sentiment=>commentSentiment(comment.original_text);

const neutralTopicName=(value:string)=>{const text=normalize(value).join(' ');if(/autonomia|flexibilidade|decis/.test(text))return'Autonomia e flexibilidade';if(/reconhec|valoriza/.test(text))return'Reconhecimento e valorização profissional';if(/sobrecarga|carga|excesso de demanda|demandas de trabalho/.test(text))return'Carga e distribuição do trabalho';if(/process|organizacao|desorganiz/.test(text))return'Processos e organização';if(/clima|relac|convivencia|equipe/.test(text))return'Clima e relações de equipe';if(/pressao|bem estar|qualidade de vida|estresse/.test(text))return'Bem-estar e qualidade de vida';if(/comunic|alinhamento|informac/.test(text))return'Comunicação e alinhamento';if(/lider|gestor|diretoria/.test(text))return'Liderança e apoio às equipes';if(/trein|capacit|desenvolvimento/.test(text))return'Treinamento e desenvolvimento';if(/estrutura|instalac|limpeza|ambiente fisico/.test(text))return'Estrutura física e ambiente';if(/equipamento|ferramenta|material/.test(text))return'Equipamentos e ferramentas';if(/tecnologia|sistema|software|internet/.test(text))return'Tecnologia e sistemas';if(/salario|remuneracao|beneficio/.test(text))return'Remuneração e benefícios';if(/carreira|crescimento|promocao/.test(text))return'Carreira e crescimento profissional';return value.replace(/^(problemas? (no|na|nos|nas)|falhas? (no|na|nos|nas)|falta de|baixa|baixo|insatisfação com|insatisfacao com|dificuldades? (no|na|nos|nas)|necessidade de mais)\s+/i,'').replace(/\s+/g,' ').trim()};

function sanitizeTopics(raw:unknown,comments:Comment[]):SemanticTopic[]{
 const validIds=new Set(comments.map(x=>x.id)),respondentById=new Map(comments.map(x=>[x.id,x.interview_id])),generic=/^(sim|não|nao|alguns?|sente|liderança|lideranca|comunicação|comunicacao|treinamento|bem-estar)$/i;
 const source=Array.isArray(raw)?raw:[];
 const merged=new Map<string,SemanticTopic>();for(const item of source){const ids:string[]=Array.isArray(item?.commentIds)?item.commentIds.filter((id:unknown):id is string=>typeof id==='string'&&validIds.has(id)):[],name=neutralTopicName(String(item?.name??'').replace(/\s+/g,' ').trim()),description=String(item?.description??'').replace(/\s+/g,' ').trim(),existing=merged.get(name);if(existing)existing.commentIds=[...new Set([...existing.commentIds,...ids])];else merged.set(name,{name,description,commentIds:[...new Set<string>(ids)]})}
 return [...merged.values()].filter(item=>item.name.split(/\s+/).length>=2&&item.name.split(/\s+/).length<=8&&!generic.test(item.name)&&item.description.length>=20&&new Set(item.commentIds.map(id=>respondentById.get(id))).size>=2).slice(0,30);
}

async function semanticTopics(comments:Comment[]):Promise<SemanticTopic[]|null>{
 const provider=(process.env.AI_PROVIDER??'disabled').toLowerCase(),apiKey=process.env.AI_API_KEY?.trim();
 if(provider!=='openai'||!apiKey)return null;
 const endpoint=(process.env.AI_API_URL??'https://api.openai.com/v1').replace(/\/$/,''),model=process.env.AI_MODEL??'gpt-4.1-mini';
 const input=comments.slice(0,500).map(c=>({id:c.id,respondentId:c.interview_id,category:c.category,question:c.question,comment:c.original_text.slice(0,1500)}));
 const instructions=`Analise comentários de um diagnóstico organizacional em português e crie agrupadores por SIGNIFICADO, não por repetição de palavras.
Regras obrigatórias:
- Una comentários que expressem a mesma ideia, mesmo com vocabulário diferente.
- Um agrupador só pode existir quando a ideia aparece em comentários de pelo menos 2 respondentId diferentes.
- O nome deve ser curto, natural, neutro e ter de 2 a 8 palavras, como "Comunicação entre as áreas", "Carga de trabalho" ou "Bem-estar e qualidade de vida".
- Escreva como uma pessoa escreveria um título de painel. Evite frases longas, linguagem burocrática, diagnósticos e construções artificiais.
- O nome identifica o ASSUNTO, nunca o sentimento. Não use construções como "falta de", "problemas em", "insatisfação com", "baixa", "excesso" ou outras expressões essencialmente negativas.
- Comentários positivos e negativos sobre o mesmo assunto ficam no mesmo agrupador; a polaridade deve ficar somente no campo de sentimento de cada classificação.
- Separe assuntos materialmente diferentes. Estrutura física, equipamentos/ferramentas e sistemas/tecnologia devem ser sempre agrupadores distintos.
- Nunca use palavra isolada, resposta vaga ou título genérico como "Sim", "Não", "Alguns", "Sente", "Liderança" ou "Comunicação".
- Preserve nuances: não misture elogio à liderança com falta de apoio da liderança apenas porque citam liderança.
- Cada comentário pode pertencer a no máximo 3 agrupadores, somente quando houver evidência real.
- Não invente temas. Retorne apenas IDs recebidos.
- A descrição deve explicar em uma frase qual sentido comum conecta os relatos.
Responda somente JSON no formato {"topics":[{"name":"...","description":"...","commentIds":["..."]}]}.`;
 const response=await fetch(`${endpoint}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0.1,response_format:{type:'json_object'},messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(input)}]})});
 if(!response.ok)throw new Error(`Falha na análise semântica (${response.status}): ${(await response.text()).slice(0,300)}`);
 const payload:any=await response.json(),content=payload?.choices?.[0]?.message?.content;
 if(typeof content!=='string')throw new Error('A IA não retornou a análise semântica esperada.');
 return sanitizeTopics(JSON.parse(content)?.topics,comments);
}

function fallbackTopics(comments:Comment[]):SemanticTopic[]{
 const topics=fallbackConcepts.map(([name,description,terms])=>{const commentIds=comments.filter(comment=>{const words=new Set(normalize(comment.original_text));return terms.some(term=>words.has(term))}).map(comment=>comment.id);return{name,description,commentIds}});
 return sanitizeTopics(topics,comments);
}

export async function analyzeLcod(diagnosticId:string,externalClient?:PoolClient){
 const client=externalClient??await pool.connect(),owns=!externalClient;
 try{
  const {rows:comments}=await client.query<Comment>(`SELECT cm.id,i.id interview_id,cm.original_text,ao.label "answerLabel",ao.favorable,q.text question,c.name category FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN interviews i ON i.id=a.interview_id JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE i.diagnostic_id=$1 AND i.status='completed' AND length(btrim(cm.original_text))>2`,[diagnosticId]);
  const topics=(await semanticTopics(comments))??fallbackTopics(comments);
  if(owns)await client.query('BEGIN');
  const category=await client.query(`INSERT INTO lcod_categories(diagnostic_id,name,sort_order,active) VALUES($1,'Temas identificados semanticamente',0,true) ON CONFLICT(diagnostic_id,name) DO UPDATE SET active=true RETURNING id`,[diagnosticId]);
  const oldCategories=await client.query(`SELECT id FROM lcod_categories WHERE diagnostic_id=$1 AND name IN ('Temas identificados pela IA','Temas identificados semanticamente')`,[diagnosticId]),categoryIds=oldCategories.rows.map(x=>x.id);
  if(categoryIds.length){await client.query(`DELETE FROM comment_classifications WHERE suggested_by_ai AND lcod_topic_id IN (SELECT id FROM lcod_topics WHERE lcod_category_id=ANY($1::uuid[]))`,[categoryIds]);await client.query('UPDATE lcod_topics SET active=false WHERE lcod_category_id=ANY($1::uuid[])',[categoryIds])}
  const byId=new Map(comments.map(comment=>[comment.id,comment]));
  for(let index=0;index<topics.length;index++){
   const item=topics[index];
   const topic=await client.query(`INSERT INTO lcod_topics(lcod_category_id,name,description,sort_order,active) VALUES($1,$2,$3,$4,true) ON CONFLICT(lcod_category_id,name) DO UPDATE SET description=excluded.description,sort_order=excluded.sort_order,active=true RETURNING id`,[category.rows[0].id,item.name,item.description,index]);
   const selected=item.commentIds.map(commentId=>byId.get(commentId)).filter((comment):comment is Comment=>Boolean(comment));
   if(selected.length)await client.query(`INSERT INTO comment_classifications(comment_id,lcod_topic_id,sentiment,confidence,rationale,suggested_by_ai,review_status) SELECT x.comment_id,$2,x.sentiment,.9,$3,true,'approved' FROM unnest($1::uuid[],$4::sentiment_type[]) AS x(comment_id,sentiment)`,[selected.map(comment=>comment.id),topic.rows[0].id,`O tema e o sentimento foram identificados pelo sentido do texto. A favorabilidade usa separadamente os pesos do kickoff. ${item.description}`,selected.map(getSentiment)]);
  }
  if(owns)await client.query('COMMIT');
  return {comments:comments.length,topics:topics.length,mode:process.env.AI_PROVIDER==='openai'?'semantic-ai':'semantic-fallback'};
 }catch(error){if(owns)await client.query('ROLLBACK');throw error}finally{if(owns)client.release()}
}
