import type { PoolClient } from 'pg';
import { pool } from './db/pool.js';

const stop=new Set('a o as os de da do das dos e em no na nos nas um uma para por com que se seu sua seus suas como foi sao ser ter tem muito muita mais menos isso esse essa eu voce voces minha meu ao aos mas ou ja tambem'.split(' '));
const negative=new Set('ruim ruins pessimo pessima quebrado quebrada desconfortavel problema problemas falta dificil inadequado inadequada sujo suja barulho calor frio lento lenta baixa pouco pouca desorganizado desorganizada'.split(' '));
const positive=new Set('bom boa bons boas otimo otima confortavel adequado adequada limpo limpa excelente funciona satisfeito satisfeita claro clara apoio reconhecido reconhecida'.split(' '));
const normalize=(value:string)=>value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>2&&!stop.has(x));
const concepts=[
 ['Comunicação',['comunicacao','comunicar','informacao','informacoes','dialogo','transparencia','alinhamento','feedback']],
 ['Liderança',['lider','lideranca','gestor','gestao','chefe','diretor','supervisor','coordenador']],
 ['Reconhecimento',['reconhecimento','reconhecido','valorizacao','valorizado','merito','elogio']],
 ['Salário e benefícios',['salario','remuneracao','pagamento','beneficio','beneficios','vale','bonus']],
 ['Carreira e crescimento',['carreira','crescimento','promocao','oportunidade','oportunidades','evolucao']],
 ['Treinamento',['treinamento','capacitacao','curso','cursos','aprendizado','desenvolvimento']],
 ['Clima e ambiente',['clima','ambiente','equipe','colegas','relacionamento','respeito','colaboracao']],
 ['Carga de trabalho',['carga','sobrecarga','demanda','demandas','prazo','prazos','horas','volume']],
 ['Processos e organização',['processo','processos','organizacao','planejamento','burocracia','fluxo','rotina']],
 ['Estrutura e ferramentas',['estrutura','equipamento','equipamentos','ferramenta','ferramentas','sistema','sistemas','computador','internet']],
 ['Autonomia',['autonomia','liberdade','decisao','decisoes','confianca']],
 ['Bem-estar',['saude','estresse','pressao','qualidade','equilibrio']]
] as const;
type Sentiment='positive'|'negative'|'neutral';
const sentiment=(words:string[],favorable?:boolean|null):Sentiment=>{let score=0;for(let i=0;i<words.length;i++){const word=words[i],negated=i>0&&['nao','nunca','sem'].includes(words[i-1]);if(positive.has(word))score+=negated?-2:1;if(negative.has(word))score+=negated?1:-1}if(score>0)return'positive';if(score<0)return'negative';return favorable===true?'positive':favorable===false?'negative':'neutral'};

export async function analyzeLcod(diagnosticId:string,externalClient?:PoolClient){
 const client=externalClient??await pool.connect(),owns=!externalClient;
 try{
  if(owns)await client.query('BEGIN');
  const {rows:comments}=await client.query(`SELECT cm.id,cm.original_text,ao.favorable FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN interviews i ON i.id=a.interview_id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE i.diagnostic_id=$1 AND i.status='completed'`,[diagnosticId]);
  const groups=new Map<string,{comments:Map<string,Sentiment>}>();
  for(const comment of comments){
   const words=normalize(comment.original_text),set=new Set(words),matched=concepts.filter(([,terms])=>terms.some(term=>set.has(term)));
   const labels=matched.length?matched.map(([label])=>label):words.filter(x=>!negative.has(x)&&!positive.has(x)).slice(0,1).map(x=>x[0].toUpperCase()+x.slice(1));
   for(const label of labels.slice(0,2)){const group=groups.get(label)??{comments:new Map<string,Sentiment>()};group.comments.set(comment.id,sentiment(words,comment.favorable));groups.set(label,group)}
  }
  const ranked=[...groups.entries()].filter(([,x])=>x.comments.size>=2).sort((a,b)=>b[1].comments.size-a[1].comments.size).slice(0,30);
  const category=await client.query(`INSERT INTO lcod_categories(diagnostic_id,name,sort_order,active) VALUES($1,'Temas identificados pela IA',0,true) ON CONFLICT(diagnostic_id,name) DO UPDATE SET active=true RETURNING id`,[diagnosticId]);
  await client.query('UPDATE lcod_topics SET active=false WHERE lcod_category_id=$1',[category.rows[0].id]);
  for(let index=0;index<ranked.length;index++){
   const [label,item]=ranked[index];
   const topic=await client.query(`INSERT INTO lcod_topics(lcod_category_id,name,description,sort_order,active) VALUES($1,$2,$3,$4,true) ON CONFLICT(lcod_category_id,name) DO UPDATE SET description=excluded.description,sort_order=excluded.sort_order,active=true RETURNING id`,[category.rows[0].id,label,`Agrupador semântico presente em ${item.comments.size} comentários.`,index]);
   for(const [commentId,classification] of item.comments)await client.query(`INSERT INTO comment_classifications(comment_id,lcod_topic_id,sentiment,confidence,rationale,suggested_by_ai,review_status) VALUES($1,$2,$3,$4,$5,true,'approved') ON CONFLICT(comment_id,lcod_topic_id,sentiment) DO UPDATE SET confidence=excluded.confidence,rationale=excluded.rationale,review_status='approved'`,[commentId,topic.rows[0].id,classification,.9,`Comentário associado ao agrupador semântico “${label}”.`]);
  }
  if(owns)await client.query('COMMIT');
  return {comments:comments.length,topics:ranked.length};
 }catch(error){if(owns)await client.query('ROLLBACK');throw error}finally{if(owns)client.release()}
}
