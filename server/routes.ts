import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db/pool.js';

export const api = Router();
const uuid = z.string().uuid();
const companyInput = z.object({ name:z.string().trim().min(2).max(180), approximateEmployeeCount:z.number().int().nonnegative().optional() });
const diagnosticInput = z.object({ companyId:uuid, name:z.string().trim().min(2).max(180), description:z.string().max(1000).optional(), minimumSampleSize:z.number().int().min(3).default(5) });
const answerInput = z.object({ questionId:uuid, answerOptionId:uuid.nullable().optional(), openText:z.string().trim().min(1).nullable().optional(), justification:z.string().trim().max(5000).nullable().optional(), relatedPersonId:uuid.nullable().optional() });

function parsed<T>(schema:z.ZodType<T>, body:unknown):T { return schema.parse(body); }
api.use((req,res,next) => { try { next(); } catch(e) { if(e instanceof z.ZodError) return res.status(400).json({error:'Dados inválidos',fields:e.flatten().fieldErrors}); next(e); } });

api.get('/diagnostics',async (_req,res,next) => { try {
  const {rows}=await pool.query(`SELECT d.id,d.name,d.status,d.starts_on,d.ends_on,d.favorable_threshold,d.minimum_sample_size,
    c.name company_name,coalesce(m.interview_count,0)::int interview_count,coalesce(m.answer_count,0)::int answer_count,m.favorability
    FROM diagnostics d JOIN companies c ON c.id=d.company_id LEFT JOIN diagnostic_metrics m ON m.diagnostic_id=d.id ORDER BY d.created_at DESC`);
  res.json(rows);
} catch(e){next(e)} });
api.post('/companies',async (req,res,next) => { try {
  const v=parsed(companyInput,req.body); const {rows}=await pool.query('INSERT INTO companies(name,approximate_employee_count) VALUES($1,$2) RETURNING *',[v.name,v.approximateEmployeeCount??null]); res.status(201).json(rows[0]);
} catch(e){ if(e instanceof z.ZodError) return res.status(400).json({error:'Dados inválidos',fields:e.flatten().fieldErrors}); next(e)} });
api.post('/diagnostics',async (req,res,next) => { try {
  const v=parsed(diagnosticInput,req.body); const {rows}=await pool.query('INSERT INTO diagnostics(company_id,name,description,minimum_sample_size) VALUES($1,$2,$3,$4) RETURNING *',[v.companyId,v.name,v.description??null,v.minimumSampleSize]); res.status(201).json(rows[0]);
} catch(e){ if(e instanceof z.ZodError) return res.status(400).json({error:'Dados inválidos',fields:e.flatten().fieldErrors}); next(e)} });
api.get('/diagnostics/:id',async (req,res,next) => { try {
  const id=uuid.parse(req.params.id); const [diag,categories,interviews]=await Promise.all([
    pool.query('SELECT d.*,c.name company_name FROM diagnostics d JOIN companies c ON c.id=d.company_id WHERE d.id=$1',[id]),
    pool.query(`SELECT c.id,c.name,c.sort_order,count(q.id)::int question_count FROM categories c LEFT JOIN questions q ON q.category_id=c.id AND q.active WHERE c.diagnostic_id=$1 AND c.active GROUP BY c.id ORDER BY c.sort_order`,[id]),
    pool.query(`SELECT status,count(*)::int count FROM interviews WHERE diagnostic_id=$1 GROUP BY status`,[id])]);
  if(!diag.rows[0]) return res.status(404).json({error:'Diagnóstico não encontrado'}); res.json({ ...diag.rows[0],categories:categories.rows,interviews:interviews.rows });
} catch(e){next(e)} });
api.get('/interviews/:id',async (req,res,next) => { try {
  const id=uuid.parse(req.params.id); const interview=await pool.query(`SELECT i.*,d.name diagnostic_name,d.company_id,ip.gender,ip.tenure_band,ip.department_id,ip.position_id,ip.registered_role_divergence FROM interviews i JOIN diagnostics d ON d.id=i.diagnostic_id LEFT JOIN interview_profiles ip ON ip.interview_id=i.id WHERE i.id=$1`,[id]); if(!interview.rows[0]) return res.status(404).json({error:'Entrevista não encontrada'});
  const {rows}=await pool.query(`SELECT c.id category_id,c.name category_name,c.sort_order category_order,q.id question_id,q.code,q.text,q.type,q.justification_required,q.sort_order,
    coalesce(json_agg(json_build_object('id',ao.id,'label',ao.label,'weight',ao.weight,'favorable',ao.favorable,'sortOrder',ao.sort_order) ORDER BY ao.sort_order) FILTER(WHERE ao.id IS NOT NULL),'[]') options,
    a.id answer_id,a.answer_option_id,a.open_text,cm.original_text justification
    FROM categories c JOIN questions q ON q.category_id=c.id AND q.active LEFT JOIN answer_options ao ON ao.question_id=q.id AND ao.active
    LEFT JOIN answers a ON a.question_id=q.id AND a.interview_id=$1 LEFT JOIN comments cm ON cm.answer_id=a.id
    WHERE c.diagnostic_id=$2 AND c.active GROUP BY c.id,q.id,a.id,cm.id ORDER BY c.sort_order,q.sort_order`,[id,interview.rows[0].diagnostic_id]);
  const [departments,positions,people,selectedPeople]=await Promise.all([
    pool.query('SELECT id,name FROM departments WHERE company_id=$1 AND active ORDER BY sort_order,name',[interview.rows[0].company_id]),
    pool.query('SELECT id,name,department_id FROM positions WHERE company_id=$1 AND active ORDER BY sort_order,name',[interview.rows[0].company_id]),
    pool.query(`SELECT p.id,p.name,p.role FROM diagnostic_people dp JOIN people p ON p.id=dp.person_id WHERE dp.diagnostic_id=$1 AND dp.active AND p.active ORDER BY p.role,p.name`,[interview.rows[0].diagnostic_id]),
    pool.query('SELECT person_id FROM interview_people WHERE interview_id=$1 ORDER BY relationship_order',[id])
  ]);
  res.json({interview:interview.rows[0],questions:rows,departments:departments.rows,positions:positions.rows,people:people.rows,selectedPeople:selectedPeople.rows.map(x=>x.person_id)});
} catch(e){next(e)} });
api.put('/interviews/:id/answers',async (req,res,next) => { const client=await pool.connect(); try {
  const interviewId=uuid.parse(req.params.id),v=parsed(answerInput,req.body); await client.query('BEGIN');
  const q=await client.query(`SELECT q.type,q.justification_required,q.target_role,i.diagnostic_id FROM questions q JOIN categories c ON c.id=q.category_id JOIN interviews i ON i.id=$1 AND i.diagnostic_id=c.diagnostic_id WHERE q.id=$2 AND q.active AND c.active`,[interviewId,v.questionId]); if(!q.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({error:'Pergunta não pertence a esta entrevista.'}); }
  if(q.rows[0].type!=='open_text' && (!v.answerOptionId || (q.rows[0].justification_required && !v.justification))) { await client.query('ROLLBACK'); return res.status(400).json({error:'Resposta e justificativa são obrigatórias.'}); }
  if(v.answerOptionId){const option=await client.query('SELECT 1 FROM answer_options WHERE id=$1 AND question_id=$2 AND active',[v.answerOptionId,v.questionId]);if(!option.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'A opção não pertence à pergunta.'})}}
  if(q.rows[0].target_role && !v.relatedPersonId){await client.query('ROLLBACK');return res.status(400).json({error:'Selecione a pessoa avaliada.'})}
  if(v.relatedPersonId){const person=await client.query(`SELECT 1 FROM diagnostic_people dp JOIN people p ON p.id=dp.person_id WHERE dp.diagnostic_id=$1 AND dp.person_id=$2 AND dp.active AND p.active AND ($3::person_role IS NULL OR p.role=$3)`,[q.rows[0].diagnostic_id,v.relatedPersonId,q.rows[0].target_role]);if(!person.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'A pessoa avaliada não pertence ao diagnóstico ou ao tipo da pergunta.'})}}
  const result=await client.query(`INSERT INTO answers(interview_id,question_id,answer_option_id,open_text,related_person_id) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(interview_id,question_id,related_person_id) DO UPDATE SET answer_option_id=excluded.answer_option_id,open_text=excluded.open_text,updated_at=now() RETURNING id`,[interviewId,v.questionId,v.answerOptionId??null,v.openText??null,v.relatedPersonId??null]);
  const text=q.rows[0].type==='open_text'?v.openText:v.justification;
  if(text) await client.query(`INSERT INTO comments(answer_id,original_text) VALUES($1,$2) ON CONFLICT(answer_id) DO UPDATE SET original_text=excluded.original_text,updated_at=now()`,[result.rows[0].id,text]);
  await client.query(`UPDATE interviews SET status='in_progress',started_at=coalesce(started_at,now()),updated_at=now() WHERE id=$1`,[interviewId]); await client.query('COMMIT'); res.json({saved:true,answerId:result.rows[0].id});
} catch(e){await client.query('ROLLBACK');next(e)} finally{client.release()} });
api.post('/interviews/:id/complete',async (req,res,next)=>{try{const id=uuid.parse(req.params.id); const missing=await pool.query(`SELECT count(*)::int count FROM questions q JOIN categories c ON c.id=q.category_id JOIN interviews i ON i.diagnostic_id=c.diagnostic_id LEFT JOIN answers a ON a.question_id=q.id AND a.interview_id=i.id WHERE i.id=$1 AND q.required AND q.active AND c.active AND a.id IS NULL`,[id]); if(missing.rows[0].count>0)return res.status(409).json({error:`Ainda existem ${missing.rows[0].count} perguntas obrigatórias sem resposta.`}); const invalid=await pool.query(`SELECT count(*)::int count FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN comments c ON c.answer_id=a.id WHERE a.interview_id=$1 AND q.type<>'open_text' AND q.justification_required AND (c.original_text IS NULL OR btrim(c.original_text)='')`,[id]);if(invalid.rows[0].count>0)return res.status(409).json({error:'Existem respostas fechadas sem justificativa.'}); await pool.query(`UPDATE interviews SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1`,[id]);res.json({completed:true});}catch(e){next(e)}});
api.get('/diagnostics/:id/analytics',async(req,res,next)=>{try{const id=uuid.parse(req.params.id), min=Math.max(3,Number(req.query.minimumSampleSize)||5);const {rows}=await pool.query(`SELECT c.id,c.name,count(DISTINCT af.interview_id)::int sample_size,count(af.answer_id)::int responses,round(100.0*count(*) FILTER(WHERE af.favorable)/nullif(count(*) FILTER(WHERE af.answer_option_id IS NOT NULL),0),1) favorability FROM categories c LEFT JOIN answer_facts af ON af.category_id=c.id WHERE c.diagnostic_id=$1 GROUP BY c.id HAVING count(DISTINCT af.interview_id)=0 OR count(DISTINCT af.interview_id)>=$2 ORDER BY c.sort_order`,[id,min]);res.json(rows);}catch(e){next(e)}});
