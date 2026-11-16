import type { PoolClient } from 'pg';
import { pool } from './db/pool.js';

type Sentiment='positive'|'negative'|'neutral';
type Comment={id:string;interview_id:string;original_text:string;favorable:boolean|null;question:string;category:string};
type SemanticTopic={name:string;description:string;commentIds:string[]};

const negative=new Set('ruim ruins pessimo pessima quebrado quebrada desconfortavel problema problemas falta dificil inadequado inadequada sujo suja barulho calor frio lento lenta baixa pouco pouca desorganizado desorganizada sobrecarga estresse pressao'.split(' '));
const positive=new Set('bom boa bons boas otimo otima confortavel adequado adequada limpo limpa excelente funciona satisfeito satisfeita claro clara apoio reconhecido reconhecida organizado organizada'.split(' '));
const normalize=(value:string)=>value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
const fallbackConcepts=[
 ['Falhas na comunicação e no alinhamento interno','Relatos sobre falta de informação, diálogo, transparência, alinhamento ou feedback.',['comunicacao','comunicar','informacao','informacoes','dialogo','transparencia','alinhamento','feedback']],
 ['Dificuldades na atuação e no apoio da liderança','Relatos sobre gestores, supervisores ou direção e a forma como lideram e apoiam as equipes.',['lider','lideranca','gestor','gestao','chefe','diretor','supervisor','coordenador']],
 ['Falta de reconhecimento e valorização profissional','Relatos sobre reconhecimento, valorização, mérito ou elogios pelo trabalho realizado.',['reconhecimento','reconhecido','valorizacao','valorizado','merito','elogio']],
 ['Insatisfação com salários e benefícios oferecidos','Relatos sobre remuneração, pagamentos, benefícios, vales ou bônus.',['salario','remuneracao','pagamento','beneficio','beneficios','vale','bonus']],
 ['Poucas oportunidades de carreira e crescimento','Relatos sobre carreira, promoções, evolução e oportunidades de crescimento.',['carreira','crescimento','promocao','oportunidade','oportunidades','evolucao']],
 ['Necessidade de mais treinamento e desenvolvimento','Relatos sobre capacitação, cursos, aprendizado ou desenvolvimento profissional.',['treinamento','capacitacao','curso','cursos','aprendizado','desenvolvimento']],
 ['Problemas no clima e nas relações da equipe','Relatos sobre ambiente, colegas, respeito, colaboração e relacionamento entre equipes.',['clima','ambiente','equipe','colegas','relacionamento','respeito','colaboracao']],
 ['Sobrecarga e excesso de demandas de trabalho','Relatos sobre carga, volume, prazos, horas e excesso de demandas.',['carga','sobrecarga','demanda','demandas','prazo','prazos','horas','volume']],
 ['Processos desorganizados e pouco eficientes','Relatos sobre processos, planejamento, burocracia, fluxos, rotinas e organização.',['processo','processos','organizacao','planejamento','burocracia','fluxo','rotina']],
 ['Estrutura e ferramentas inadequadas para o trabalho','Relatos sobre equipamentos, sistemas, computadores, internet e ferramentas de trabalho.',['estrutura','equipamento','equipamentos','ferramenta','ferramentas','sistema','sistemas','computador','internet']],
 ['Baixa autonomia para tomar decisões no trabalho','Relatos sobre liberdade, confiança e autonomia para decidir.',['autonomia','liberdade','decisao','decisoes','confianca']],
 ['Pressão prejudicando o bem-estar das pessoas','Relatos sobre saúde, estresse, pressão, qualidade de vida e equilíbrio.',['saude','estresse','pressao','qualidade','equilibrio']]
] as const;

const getSentiment=(text:string,favorable?:boolean|null):Sentiment=>{const words=normalize(text);let score=0;for(let i=0;i<words.length;i++){const word=words[i],negated=i>0&&['nao','nunca','sem'].includes(words[i-1]);if(positive.has(word))score+=negated?-2:1;if(negative.has(word))score+=negated?1:-1}if(score>0)return'positive';if(score<0)return'negative';return favorable===true?'positive':favorable===false?'negative':'neutral'};

function sanitizeTopics(raw:unknown,comments:Comment[]):SemanticTopic[]{
 const validIds=new Set(comments.map(x=>x.id)),respondentById=new Map(comments.map(x=>[x.id,x.interview_id])),generic=/^(sim|não|nao|alguns?|sente|liderança|lideranca|comunicação|comunicacao|treinamento|bem-estar)$/i;
 const source=Array.isArray(raw)?raw:[];
 return source.map((item:any)=>{const ids:string[]=Array.isArray(item?.commentIds)?item.commentIds.filter((id:unknown):id is string=>typeof id==='string'&&validIds.has(id)):[];return{name:String(item?.name??'').replace(/\s+/g,' ').trim(),description:String(item?.description??'').replace(/\s+/g,' ').trim(),commentIds:[...new Set<string>(ids)]}})
  .filter(item=>item.name.split(/\s+/).length>=4&&item.name.split(/\s+/).length<=12&&!generic.test(item.name)&&item.description.length>=20&&new Set(item.commentIds.map(id=>respondentById.get(id))).size>=2)
  .slice(0,30);
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
- O nome deve ser uma frase descritiva de 4 a 12 palavras, por exemplo: "Falta de clareza na comunicação entre áreas".
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
 const topics=fallbackConcepts.map(([name,description,terms])=>{const commentIds=comments.filter(comment=>{const words=new Set(normalize(`${comment.category} ${comment.question} ${comment.original_text}`));return terms.some(term=>words.has(term))}).map(comment=>comment.id);return{name,description,commentIds}});
 return sanitizeTopics(topics,comments);
}

export async function analyzeLcod(diagnosticId:string,externalClient?:PoolClient){
 const client=externalClient??await pool.connect(),owns=!externalClient;
 try{
  const {rows:comments}=await client.query<Comment>(`SELECT cm.id,i.id interview_id,cm.original_text,ao.favorable,q.text question,c.name category FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN interviews i ON i.id=a.interview_id JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE i.diagnostic_id=$1 AND i.status='completed' AND length(btrim(cm.original_text))>2`,[diagnosticId]);
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
   if(selected.length)await client.query(`INSERT INTO comment_classifications(comment_id,lcod_topic_id,sentiment,confidence,rationale,suggested_by_ai,review_status) SELECT x.comment_id,$2,x.sentiment,.9,$3,true,'approved' FROM unnest($1::uuid[],$4::sentiment_type[]) AS x(comment_id,sentiment)`,[selected.map(comment=>comment.id),topic.rows[0].id,`O relato expressa o sentido comum: ${item.description}`,selected.map(comment=>getSentiment(comment.original_text,comment.favorable))]);
  }
  if(owns)await client.query('COMMIT');
  return {comments:comments.length,topics:topics.length,mode:process.env.AI_PROVIDER==='openai'?'semantic-ai':'semantic-fallback'};
 }catch(error){if(owns)await client.query('ROLLBACK');throw error}finally{if(owns)client.release()}
}
