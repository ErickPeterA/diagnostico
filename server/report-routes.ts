import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { pool } from "./db/pool.js";

export const reportApi = Router();
const uuid = z.string().uuid();
const requestSchema = z
  .object({
    type: z.enum(["general", "leadership"]),
    personId: uuid.optional(),
    includeComments: z.boolean().default(true),
  })
  .refine((x) => x.type === "general" || x.personId, {
    message: "Selecione a liderança.",
    path: ["personId"],
  });
const colors = {
  dark: "173F39",
  green: "176D5C",
  mint: "E7F2EF",
  gold: "EFB149",
  red: "B64C44",
  cream: "F7F8F7",
  gray: "687773",
  line: "DFE6E4",
  white: "FFFFFF",
};
const scoreColor = (value: any) =>
  Number(value) >= 87.5
    ? "176B57"
    : Number(value) >= 62.5
      ? "3F9A7D"
      : Number(value) >= 37.5
        ? "E2AA3D"
        : Number(value) >= 12.5
          ? "E17B55"
          : "C94747";

type ReportData = {
  diagnostic: any;
  summary: any;
  categories: any[];
  topics: any[];
  comments: any[];
  plans: any[];
  person?: any;
  questions?: any[];
  questionDetails?: any[];
  profiles?: any[];
  privacy: string;
};
const safeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
const cleanText = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
const redactComment = (value: string) =>
  cleanText(value)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[e-mail removido]")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[link removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento removido]")
    .replace(
      /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/g,
      "[telefone removido]",
    );
const sanitize = (value: any): any =>
  value instanceof Date
    ? value
    : Array.isArray(value)
      ? value.map(sanitize)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, sanitize(v)]),
          )
        : typeof value === "string"
          ? cleanText(value)
          : value;
const pct = (value: any) =>
  value == null ? "—" : `${Number(value).toFixed(1).replace(".0", "")}%`;
const score = (value: any) =>
  value == null ? "—" : Number(value).toFixed(2).replace(".", ",");
const date = (value: any) => {
  if (!value) return "Não definido";
  const raw = String(value),
    parsed = /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? new Date(`${raw.slice(0, 10)}T12:00:00-03:00`)
      : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
};

async function loadReport(
  diagnosticId: string,
  type: "general" | "leadership",
  personId?: string,
  includeComments = true,
): Promise<ReportData> {
  const diagnostic = (
    await pool.query(
      `SELECT d.*,c.name company_name,c.trade_name FROM diagnostics d JOIN companies c ON c.id=d.company_id WHERE d.id=$1`,
      [diagnosticId],
    )
  ).rows[0];
  if (!diagnostic)
    throw Object.assign(new Error("Diagnóstico não encontrado."), {
      status: 404,
    });
  const categories = (
    await pool.query(
      `SELECT c.id,c.name,count(a.id)::int responses,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END),2)::float average,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END)*10,1)::float favorability,round(100.0*count(a.id) FILTER(WHERE a.exists_in_company IS TRUE)/NULLIF(count(a.id) FILTER(WHERE a.exists_in_company IS NOT NULL),0),1)::float existence_yes_percentage,round(100.0*count(a.id) FILTER(WHERE a.exists_in_company IS FALSE)/NULLIF(count(a.id) FILTER(WHERE a.exists_in_company IS NOT NULL),0),1)::float existence_no_percentage FROM categories c LEFT JOIN questions q ON q.category_id=c.id AND q.active LEFT JOIN answers a ON a.question_id=q.id AND a.interview_id IN(SELECT id FROM interviews WHERE diagnostic_id=$1 AND status='completed' AND kind='employee') LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE c.diagnostic_id=$1 AND c.active GROUP BY c.id ORDER BY c.sort_order`,
      [diagnosticId],
    )
  ).rows;
  const generalTopics = (
    await pool.query(
      `SELECT lt.id,lt.name,count(DISTINCT cc.comment_id)::int mentions,count(DISTINCT cc.comment_id) FILTER(WHERE cc.sentiment='positive')::int positive,count(DISTINCT cc.comment_id) FILTER(WHERE cc.sentiment='negative')::int negative FROM lcod_topics lt JOIN lcod_categories lc ON lc.id=lt.lcod_category_id LEFT JOIN comment_classifications cc ON cc.lcod_topic_id=lt.id AND cc.review_status IN('approved','edited') WHERE lc.diagnostic_id=$1 AND lt.active AND (lc.name='Temas identificados semanticamente' OR NOT EXISTS(SELECT 1 FROM lcod_categories semantic WHERE semantic.diagnostic_id=lc.diagnostic_id AND semantic.name='Temas identificados semanticamente' AND semantic.active)) GROUP BY lt.id HAVING count(DISTINCT cc.comment_id)>0 ORDER BY mentions DESC LIMIT 12`,
      [diagnosticId],
    )
  ).rows;
  const plans = (
    await pool.query(
      `SELECT problem,proposed_action,priority,responsible,due_date,status FROM action_plans WHERE diagnostic_id=$1 AND status<>'cancelled' ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,due_date NULLS LAST LIMIT 12`,
      [diagnosticId],
    )
  ).rows;
  if (type === "general") {
    const questionDetails = (
      await pool.query(
        `SELECT q.id,q.code,q.text,q.type,c.name category,c.sort_order category_order,q.sort_order,
    count(a.id)::int responses,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END)*10,1)::float favorability,
    round(100.0*count(a.id) FILTER(WHERE a.exists_in_company IS TRUE)/NULLIF(count(a.id) FILTER(WHERE a.exists_in_company IS NOT NULL),0),1)::float existence_yes_percentage,
    round(100.0*count(a.id) FILTER(WHERE a.exists_in_company IS FALSE)/NULLIF(count(a.id) FILTER(WHERE a.exists_in_company IS NOT NULL),0),1)::float existence_no_percentage,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('label',x.label,'count',x.answer_count,'percentage',x.percentage,'favorable',x.favorable,'sort_order',x.sort_order) ORDER BY x.sort_order) FROM (
      SELECT opt.label,opt.favorable,opt.sort_order,count(ans.id)::int answer_count,round(100.0*count(ans.id)/NULLIF(sum(count(ans.id)) over(),0),1)::float percentage
      FROM answer_options opt LEFT JOIN answers ans ON ans.answer_option_id=opt.id AND ans.interview_id IN(SELECT id FROM interviews WHERE diagnostic_id=$1 AND status='completed' AND kind='employee')
      WHERE opt.question_id=q.id AND opt.active GROUP BY opt.id
    ) x),'[]'::jsonb) options,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('text',y.text,'answer_label',y.answer_label) ORDER BY y.created_at DESC) FROM (SELECT left(COALESCE(cm.normalized_text,cm.original_text),240) text,coa.label answer_label,cm.created_at FROM comments cm JOIN answers ca ON ca.id=cm.answer_id JOIN interviews ci ON ci.id=ca.interview_id LEFT JOIN answer_options coa ON coa.id=ca.answer_option_id WHERE ca.question_id=q.id AND ci.diagnostic_id=$1 AND ci.status='completed' AND ci.kind='employee' ORDER BY cm.created_at DESC LIMIT 4)y),'[]'::jsonb) highlights
   FROM questions q JOIN categories c ON c.id=q.category_id
   LEFT JOIN answers a ON a.question_id=q.id AND a.interview_id IN(SELECT id FROM interviews WHERE diagnostic_id=$1 AND status='completed' AND kind='employee')
   LEFT JOIN answer_options ao ON ao.id=a.answer_option_id
   WHERE c.diagnostic_id=$1 AND c.active AND q.active GROUP BY q.id,c.id ORDER BY c.sort_order,q.sort_order`,
        [diagnosticId],
      )
    ).rows;
    const profiles = (
      await pool.query(
        `SELECT COALESCE(NULLIF(btrim(ip.gender),''),'Não informado') label,count(*)::int count,round(100.0*count(*)/NULLIF(sum(count(*)) over(),0),1)::float percentage FROM interview_profiles ip JOIN interviews i ON i.id=ip.interview_id WHERE i.diagnostic_id=$1 AND i.status='completed' AND i.kind='employee' GROUP BY 1 ORDER BY count DESC`,
        [diagnosticId],
      )
    ).rows;
    const categoryOptions = (
      await pool.query(
        `SELECT c.id,ao.label,ao.sort_order,count(a.id)::int count,
          round(100.0*count(a.id)/NULLIF(sum(count(a.id)) over(partition by c.id),0),1)::float percentage
         FROM categories c JOIN questions q ON q.category_id=c.id AND q.active
         JOIN answer_options ao ON ao.question_id=q.id AND ao.active
         LEFT JOIN answers a ON a.answer_option_id=ao.id AND a.interview_id IN
           (SELECT id FROM interviews WHERE diagnostic_id=$1 AND status='completed' AND kind='employee')
         WHERE c.diagnostic_id=$1 AND c.active AND q.type='satisfaction_scale'
         GROUP BY c.id,ao.label,ao.sort_order ORDER BY c.id,ao.sort_order`,
        [diagnosticId],
      )
    ).rows;
    for (const category of categories)
      category.options = categoryOptions.filter((option) => option.id === category.id);
    const summary = (
      await pool.query(
        `SELECT count(DISTINCT i.id)::int completed_interviews,count(a.id)::int response_count,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END),2)::float average,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END)*10,1)::float favorability FROM interviews i LEFT JOIN answers a ON a.interview_id=i.id LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE i.diagnostic_id=$1 AND i.kind='employee' AND i.status='completed'`,
        [diagnosticId],
      )
    ).rows[0];
    const comments =
      includeComments &&
      summary.completed_interviews >= diagnostic.minimum_sample_size
        ? (
            await pool.query(
              `SELECT DISTINCT ON(cm.id) cm.id,cm.original_text,cm.normalized_text,q.code,c.name category FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN interviews i ON i.id=a.interview_id JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id WHERE i.diagnostic_id=$1 AND i.status='completed' ORDER BY cm.id,cm.created_at DESC LIMIT 10`,
              [diagnosticId],
            )
          ).rows.map((c) => ({
            ...c,
            original_text: redactComment(c.normalized_text || c.original_text),
            normalized_text: undefined,
          }))
        : [];
    return {
      diagnostic,
      summary,
      categories,
      topics: generalTopics,
      comments,
      plans,
      questionDetails,
      profiles,
      privacy: `Resultados agregados. Recortes com menos de ${diagnostic.minimum_sample_size} participantes não são exibidos.`,
    };
  }
  const person = (
    await pool.query(
      `SELECT p.id,p.name,p.role,count(DISTINCT a.interview_id) FILTER(WHERE i.id IS NOT NULL)::int evaluation_count FROM people p JOIN diagnostic_people dp ON dp.person_id=p.id AND dp.diagnostic_id=$1 LEFT JOIN answers a ON a.related_person_id=p.id LEFT JOIN interviews i ON i.id=a.interview_id AND i.status='completed' WHERE p.id=$2 GROUP BY p.id`,
      [diagnosticId, personId],
    )
  ).rows[0];
  if (!person)
    throw Object.assign(
      new Error("Liderança não encontrada neste diagnóstico."),
      { status: 404 },
    );
  if (person.evaluation_count < diagnostic.minimum_sample_size)
    throw Object.assign(
      new Error(
        `Relatório bloqueado: são necessárias pelo menos ${diagnostic.minimum_sample_size} avaliações para preservar o anonimato.`,
      ),
      { status: 403 },
    );
  const summary = (
    await pool.query(
      `SELECT count(a.id)::int response_count,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END),2)::float average,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END)*10,1)::float favorability FROM answers a JOIN interviews i ON i.id=a.interview_id AND i.status='completed' LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE i.diagnostic_id=$1 AND a.related_person_id=$2`,
      [diagnosticId, personId],
    )
  ).rows[0];
  const questions = (
    await pool.query(
      `SELECT q.code,q.text,count(a.id)::int responses,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END),2)::float average,round(avg(CASE WHEN lower(btrim(ao.label)) IN ('neutro','neutra') THEN NULL ELSE ao.weight END)*10,1)::float favorability FROM questions q JOIN categories c ON c.id=q.category_id LEFT JOIN answers a ON a.question_id=q.id AND a.related_person_id=$2 AND a.interview_id IN(SELECT id FROM interviews WHERE diagnostic_id=$1 AND status='completed') LEFT JOIN answer_options ao ON ao.id=a.answer_option_id WHERE c.diagnostic_id=$1 AND q.target_role=$3 AND q.active GROUP BY q.id ORDER BY q.sort_order`,
      [diagnosticId, personId, person.role],
    )
  ).rows;
  const topics = (
    await pool.query(
      `SELECT lt.id,lt.name,count(DISTINCT cc.comment_id)::int mentions,count(DISTINCT cc.comment_id) FILTER(WHERE cc.sentiment='positive')::int positive,count(DISTINCT cc.comment_id) FILTER(WHERE cc.sentiment='negative')::int negative FROM lcod_topics lt JOIN lcod_categories lc ON lc.id=lt.lcod_category_id JOIN comment_classifications cc ON cc.lcod_topic_id=lt.id AND cc.review_status IN('approved','edited') JOIN comments cm ON cm.id=cc.comment_id JOIN answers a ON a.id=cm.answer_id JOIN interviews i ON i.id=a.interview_id AND i.status='completed' WHERE lc.diagnostic_id=$1 AND lt.active AND (lc.name='Temas identificados semanticamente' OR NOT EXISTS(SELECT 1 FROM lcod_categories semantic WHERE semantic.diagnostic_id=lc.diagnostic_id AND semantic.name='Temas identificados semanticamente' AND semantic.active)) AND a.related_person_id=$2 GROUP BY lt.id HAVING count(DISTINCT cc.comment_id)>0 ORDER BY mentions DESC LIMIT 12`,
      [diagnosticId, personId],
    )
  ).rows;
  const comments = includeComments
    ? (
        await pool.query(
          `SELECT DISTINCT ON(cm.id) cm.id,cm.original_text,cm.normalized_text,q.code,c.name category FROM comments cm JOIN answers a ON a.id=cm.answer_id JOIN interviews i ON i.id=a.interview_id JOIN questions q ON q.id=a.question_id JOIN categories c ON c.id=q.category_id WHERE i.diagnostic_id=$1 AND i.status='completed' AND a.related_person_id=$2 ORDER BY cm.id,cm.created_at DESC LIMIT 12`,
          [diagnosticId, personId],
        )
      ).rows.map((c) => ({
        ...c,
        original_text: redactComment(c.normalized_text || c.original_text),
        normalized_text: undefined,
      }))
    : [];
  return {
    diagnostic,
    summary: { ...summary, completed_interviews: person.evaluation_count },
    categories: [],
    topics,
    comments,
    plans: [],
    person,
    questions,
    privacy: `Relatório confidencial. Dados liberados somente porque há ${person.evaluation_count} avaliações válidas, acima da amostra mínima de ${diagnostic.minimum_sample_size}.`,
  };
}

reportApi.get("/diagnostics/:id/reports/options", async (req, res, next) => {
  try {
    const diagnosticId = uuid.parse(req.params.id),
      diagnostic = (
        await pool.query(
          "SELECT minimum_sample_size FROM diagnostics WHERE id=$1",
          [diagnosticId],
        )
      ).rows[0];
    if (!diagnostic)
      return res.status(404).json({ error: "Diagnóstico não encontrado." });
    const { rows } = await pool.query(
      `SELECT p.id,p.name,p.role,count(DISTINCT a.interview_id) FILTER(WHERE i.id IS NOT NULL)::int evaluation_count FROM people p JOIN diagnostic_people dp ON dp.person_id=p.id AND dp.diagnostic_id=$1 LEFT JOIN answers a ON a.related_person_id=p.id LEFT JOIN interviews i ON i.id=a.interview_id AND i.status='completed' WHERE p.role IN('leader','director') GROUP BY p.id ORDER BY p.role,p.name`,
      [diagnosticId],
    );
    res.json({
      minimumSampleSize: diagnostic.minimum_sample_size,
      people: rows.map((x) => ({
        ...x,
        available: x.evaluation_count >= diagnostic.minimum_sample_size,
      })),
    });
  } catch (e) {
    next(e);
  }
});

reportApi.post("/diagnostics/:id/reports/export", async (req, res, next) => {
  try {
    const diagnosticId = uuid.parse(req.params.id),
      format = z.enum(["pdf", "pptx"]).parse(req.query.format),
      input = requestSchema.parse(req.body),
      data = sanitize(
        await loadReport(
          diagnosticId,
          input.type,
          input.personId,
          input.includeComments,
        ),
      ) as ReportData;
    const base = `relatorio-${input.type === "general" ? "geral" : safeName(data.person.name)}-${safeName(data.diagnostic.name)}`,
      buffer =
        format === "pdf"
          ? await createPdf(data, input.type)
          : await createPptx(data, input.type);
    res.setHeader(
      "Content-Type",
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${base}.${format}"`,
    );
    res.send(buffer);
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return res.status(400).json({
        error: "Verifique as opções do relatório.",
        fields: e.flatten().fieldErrors,
      });
    if (e?.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export function createPdf(data: ReportData, type: "general" | "leadership") {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 42,
        bufferPages: true,
        info: {
          Title: `Relatório ${type === "general" ? "geral" : data.person.name}`,
          Author: data.diagnostic.company_name,
        },
      }),
      chunks: Buffer[] = [];
    doc.on("data", (x) => chunks.push(x));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const pageTitle = (title: string, sub?: string) => {
      doc
        .fillColor(`#${colors.dark}`)
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(title);
      if (sub)
        doc
          .fillColor(`#${colors.gray}`)
          .font("Helvetica")
          .fontSize(9)
          .text(sub, { lineGap: 2 });
      doc.moveDown(1);
    };
    const newPage = (title: string, sub?: string) => {
      doc.addPage();
      pageTitle(title, sub);
    };
    const metric = (
      x: number,
      y: number,
      w: number,
      label: string,
      value: string,
    ) => {
      doc
        .roundedRect(x, y, w, 58, 7)
        .fillAndStroke(`#${colors.cream}`, `#${colors.line}`);
      doc
        .fillColor(`#${colors.gray}`)
        .font("Helvetica")
        .fontSize(7)
        .text(label.toUpperCase(), x + 10, y + 10, { width: w - 20 });
      doc
        .fillColor(`#${colors.dark}`)
        .font("Helvetica-Bold")
        .fontSize(17)
        .text(value, x + 10, y + 27, { width: w - 20 });
    };
    doc.rect(0, 0, 595, 842).fill(`#${colors.dark}`);
    doc
      .fillColor(`#${colors.gold}`)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("DIAGNÓSTICO ORGANIZACIONAL", 48, 70);
    doc
      .fillColor(`#${colors.white}`)
      .fontSize(29)
      .text(
        type === "general"
          ? "Relatório geral"
          : "Relatório confidencial de liderança",
        48,
        112,
        { width: 490 },
      );
    doc
      .font("Helvetica")
      .fontSize(15)
      .fillColor("#D6E3E0")
      .text(
        type === "general"
          ? data.diagnostic.trade_name || data.diagnostic.company_name
          : data.person.name,
        48,
        205,
        { width: 490 },
      );
    doc
      .fontSize(10)
      .text(
        `${data.diagnostic.name}  |  ${date(data.diagnostic.starts_on)} a ${date(data.diagnostic.ends_on)}`,
        48,
        245,
        { width: 490 },
      );
    doc.roundedRect(48, 650, 499, 85, 8).fill("#214F48");
    doc
      .fillColor(`#${colors.white}`)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("PRIVACIDADE E USO", 62, 667);
    doc
      .fillColor("#D6E3E0")
      .font("Helvetica")
      .fontSize(8)
      .text(data.privacy, 62, 686, { width: 465, lineGap: 3 });
    doc
      .fontSize(8)
      .text(
        `Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date())}`,
        48,
        760,
      );
    newPage(
      "Resumo executivo",
      type === "leadership"
        ? `Visão individual protegida de ${data.person.name}`
        : "Visão consolidada do diagnóstico",
    );
    metric(
      42,
      105,
      118,
      "Participantes",
      String(data.summary.completed_interviews ?? 0),
    );
    metric(
      170,
      105,
      118,
      "Respostas",
      String(data.summary.response_count ?? 0),
    );
    metric(298, 105, 255, "Favorabilidade", pct(data.summary.favorability));
    doc
      .fillColor(`#${colors.dark}`)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(
        type === "general"
          ? "Resultados por categoria"
          : "Resultados por pergunta",
        42,
        190,
      );
    const rows = (
      type === "general" ? data.categories : data.questions || []
    ).slice(0, 12);
    let y = 220;
    for (const row of rows) {
      const label = type === "general" ? row.name : `${row.code} - ${row.text}`;
      doc
        .fillColor(`#${colors.dark}`)
        .font("Helvetica")
        .fontSize(8)
        .text(label, 42, y, { width: 265, ellipsis: true });
      doc.roundedRect(315, y, 180, 8, 4).fill("#E7ECEB");
      doc
        .roundedRect(
          315,
          y,
          Math.max(2, (180 * Number(row.favorability || 0)) / 100),
          8,
          4,
        )
        .fill(`#${scoreColor(row.favorability)}`);
      doc
        .fillColor(`#${colors.dark}`)
        .font("Helvetica-Bold")
        .text(pct(row.favorability), 505, y - 1, { width: 45, align: "right" });
      y += 37;
    }
    if (data.topics.length) {
      newPage("Agrupadores de comentários");
      doc
        .fillColor(`#${colors.gray}`)
        .font("Helvetica")
        .fontSize(9)
        .text(
          "Temas recorrentes classificados sem identificação dos participantes.",
          42,
          90,
        );
      y = 125;
      data.topics.forEach((t, i) => {
        doc
          .fillColor(`#${colors.dark}`)
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(`${i + 1}. ${t.name}`, 42, y, { width: 260 });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(`#${colors.gray}`)
          .text(
            `${t.mentions} comentários  |  ${t.positive} positivos  |  ${t.negative} negativos`,
            315,
            y,
            { width: 235, align: "right" },
          );
        doc
          .moveTo(42, y + 22)
          .lineTo(553, y + 22)
          .strokeColor(`#${colors.line}`)
          .stroke();
        y += 42;
      });
    }
    if (data.comments.length) {
      newPage("Comentários selecionados");
      doc
        .fillColor(`#${colors.gray}`)
        .font("Helvetica")
        .fontSize(8)
        .text(
          "Comentários apresentados sem nomes, códigos de entrevista ou dados de perfil.",
          42,
          88,
        );
      y = 120;
      for (const c of data.comments) {
        const h =
          doc.heightOfString(c.original_text, { width: 465, lineGap: 2 }) + 35;
        if (y + h > 780) {
          newPage("Comentários selecionados (continuação)");
          y = 95;
        }
        doc
          .roundedRect(42, y, 511, h, 6)
          .fillAndStroke(`#${colors.cream}`, `#${colors.line}`);
        doc
          .fillColor(`#${colors.green}`)
          .font("Helvetica-Bold")
          .fontSize(7)
          .text(`${c.code} · ${c.category}`.toUpperCase(), 54, y + 10);
        doc
          .fillColor(`#${colors.dark}`)
          .font("Helvetica")
          .fontSize(9)
          .text(c.original_text, 54, y + 25, { width: 475, lineGap: 2 });
        y += h + 10;
      }
    }
    if (type === "general" && data.plans.length) {
      newPage("Plano de ação");
      y = 100;
      for (const p of data.plans) {
        const h = 70;
        doc
          .roundedRect(42, y, 511, h, 6)
          .fillAndStroke(`#${colors.cream}`, `#${colors.line}`);
        doc
          .fillColor(`#${colors.dark}`)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(p.problem, 54, y + 10, { width: 475 });
        doc
          .fillColor(`#${colors.gray}`)
          .font("Helvetica")
          .fontSize(8)
          .text(p.proposed_action, 54, y + 27, {
            width: 475,
            height: 25,
            ellipsis: true,
          });
        doc
          .fontSize(7)
          .text(
            `Responsável: ${p.responsible}  |  Prazo: ${date(p.due_date)}  |  Status: ${p.status}`,
            54,
            y + 55,
            { width: 475 },
          );
        y += 80;
        if (y > 750) {
          newPage("Plano de ação (continuação)");
          y = 100;
        }
      }
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor("#899491")
        .font("Helvetica")
        .fontSize(7)
        .text(
          `${data.diagnostic.name} · Documento ${type === "leadership" ? "confidencial" : "agregado"}`,
          42,
          790,
          { width: 430, lineBreak: false },
        );
      doc.text(`${i + 1}/${range.count}`, 500, 790, {
        width: 53,
        align: "right",
        lineBreak: false,
      });
    }
    doc.end();
  });
}

export async function createPptx(
  data: ReportData,
  type: "general" | "leadership",
) {
  if (type === "leadership") return createPptxLegacy(data, type);
  const PptxGenJS: any = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = data.diagnostic.company_name;
  pptx.company = data.diagnostic.company_name;
  pptx.lang = "pt-BR";
  pptx.title = "Diagnóstico de Clima";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "pt-BR",
  };
  const C = {
    navy: "062B63",
    blue: "89A6D8",
    pale: "D8E2F1",
    white: "FFFFFF",
    black: "101010",
    gray: "EEEEEE",
    muted: "667080",
  };
  const scale = ["E90000", "FF5959", "FFD86B", "A9D18E", "70AD47"];
  let page = 0;
  const rail = (s: any) =>
    [
      ["FF5C82", 0],
      ["FDBB0A", 1.48],
      ["11A98F", 2.96],
      ["1767C6", 4.44],
    ].forEach(([color, y]) =>
      s.addShape(pptx.ShapeType.rect, {
        x: 0,
        y,
        w: 0.18,
        h: 1.52,
        fill: { color },
        line: { color },
      }),
    );
  const base = (title?: string) => {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    rail(s);
    if (title)
      s.addText(title, {
        x: 0.72,
        y: 0.35,
        w: 11.7,
        h: 0.58,
        fontSize: 27,
        bold: true,
        color: C.black,
        margin: 0,
        fit: "shrink",
      });
    s.addText(String(++page).padStart(2, "0"), {
      x: 12.05,
      y: 7.12,
      w: 0.55,
      h: 0.16,
      fontSize: 7,
      color: "8A94A1",
      align: "right",
      margin: 0,
    });
    return s;
  };
  const boxedTitle = (s: any, title: string, y = 0.45, w = 5.6) => {
    const x = (13.333 - w) / 2;
    s.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h: 0.72,
      fill: { color: C.white, transparency: 100 },
      line: { color: C.navy, width: 1 },
    });
    s.addText(title, {
      x: x + 0.12,
      y: y + 0.08,
      w: w - 0.24,
      h: 0.53,
      fontSize: 24,
      bold: true,
      color: C.black,
      align: "center",
      valign: "mid",
      margin: 0,
      fit: "shrink",
    });
  };
  const logo = (s: any) =>
    s.addText(data.diagnostic.trade_name || data.diagnostic.company_name, {
      x: 10.35,
      y: 6.88,
      w: 2.35,
      h: 0.28,
      fontSize: 12,
      bold: true,
      color: C.navy,
      align: "right",
      margin: 0,
      fit: "shrink",
    });
  const tag = (s: any, label: string) => {
    s.addShape(pptx.ShapeType.rect, {
      x: 0.35,
      y: 6.81,
      w: 2.55,
      h: 0.38,
      fill: { color: C.white, transparency: 100 },
      line: { color: C.navy, width: 1 },
    });
    s.addText(label, {
      x: 0.47,
      y: 6.9,
      w: 2.3,
      h: 0.17,
      fontSize: 9,
      bold: true,
      color: C.black,
      margin: 0,
      fit: "shrink",
    });
  };
  const percentage = (value: any) => `${Math.round(Number(value) || 0)}%`;
  const optionColor = (label: string, index: number, total: number) => {
    const x = label.toLocaleLowerCase("pt-BR");
    if (x.includes("muito satis")) return scale[4];
    if (x === "satisfeito" || x === "satisfeita") return scale[3];
    if (x.includes("parcial") || x.includes("neutr")) return scale[2];
    if (x.includes("muito insatis")) return scale[0];
    if (x.includes("insatis")) return scale[1];
    return index === 0 ? scale[4] : index === total - 1 ? scale[0] : C.blue;
  };
  const normalizedLabel = (value: any) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("pt-BR");
  const satisfactionRows = [
    { label: "Muito Satisfeito", color: scale[4], matches: ["muito satisfeito", "muito satisfeita"] },
    { label: "Satisfeito", color: scale[3], matches: ["satisfeito", "satisfeita"] },
    { label: "Parcialmente Satisfeito", color: scale[2], matches: ["parcialmente satisfeito", "parcialmente satisfeita"] },
    { label: "Insatisfeito", color: scale[1], matches: ["insatisfeito", "insatisfeita"] },
    { label: "Muito Insatisfeito", color: scale[0], matches: ["muito insatisfeito", "muito insatisfeita"] },
  ];
  const optionPercentage = (options: any[], labels: string[]) =>
    options.reduce((total: number, option: any) =>
      labels.includes(normalizedLabel(option.label))
        ? total + (Number(option.percentage) || 0)
        : total, 0);
  const commentPalette = (answerLabel: any) => {
    const label = normalizedLabel(answerLabel);
    if (label.includes("muito satis")) return { accent: scale[4], fill: "EAF4E3", label: "Muito satisfeito" };
    if (label === "satisfeito" || label === "satisfeita") return { accent: scale[3], fill: "F0F7EB", label: "Satisfeito" };
    if (label.includes("parcial") || label.includes("neutr")) return { accent: scale[2], fill: "FFF8E3", label: label.includes("neutr") ? "Neutro" : "Parcialmente satisfeito" };
    if (label.includes("muito insatis")) return { accent: scale[0], fill: "FDEAEA", label: "Muito insatisfeito" };
    if (label.includes("insatis")) return { accent: scale[1], fill: "FFF0F0", label: "Insatisfeito" };
    return { accent: C.blue, fill: "F2F5FA", label: "Comentário" };
  };

  let s = pptx.addSlide();
  s.background = { color: C.navy };
  rail(s);
  s.addShape(pptx.ShapeType.rect, {
    x: 7.05,
    y: 0,
    w: 6.28,
    h: 7.5,
    fill: { color: "143E73" },
    line: { color: "143E73" },
  });
  s.addShape(pptx.ShapeType.chevron, {
    x: 6.15,
    y: 0,
    w: 2,
    h: 7.5,
    rotate: 180,
    fill: { color: C.navy, transparency: 8 },
    line: { color: C.navy, transparency: 100 },
  });
  s.addText(data.diagnostic.trade_name || data.diagnostic.company_name, {
    x: 0.85,
    y: 1.08,
    w: 4.8,
    h: 0.65,
    fontSize: 27,
    bold: true,
    color: C.white,
    margin: 0,
    fit: "shrink",
  });
  s.addText("Diagnóstico\nde Clima", {
    x: 0.85,
    y: 2.55,
    w: 5.15,
    h: 1.35,
    fontSize: 31,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
  });
  s.addText(
    String(new Date(data.diagnostic.starts_on || Date.now()).getFullYear()),
    {
      x: 1.35,
      y: 4.3,
      w: 4.15,
      h: 0.55,
      fontSize: 26,
      bold: true,
      color: C.white,
      align: "center",
      margin: 0,
    },
  );
  s.addText("Relatório gerado automaticamente pelo sistema", {
    x: 8,
    y: 6.6,
    w: 4.45,
    h: 0.3,
    fontSize: 10,
    color: "C8D8ED",
    align: "right",
    margin: 0,
  });
  page++;
  s = base();
  boxedTitle(s, "INTRODUÇÃO", 0.62, 4.2);
  s.addText(
    "Este relatório apresenta os resultados consolidados do diagnóstico de clima, preservando o sigilo dos participantes e transformando as respostas registradas no sistema em indicadores visuais para apoiar decisões.",
    {
      x: 1.25,
      y: 2,
      w: 10.8,
      h: 1.2,
      fontSize: 20,
      color: C.black,
      align: "center",
      valign: "mid",
      fit: "shrink",
    },
  );
  s.addText(
    `${data.summary.completed_interviews || 0} entrevistas concluídas · ${date(data.diagnostic.starts_on)} a ${date(data.diagnostic.ends_on)}`,
    {
      x: 2.1,
      y: 4,
      w: 9.1,
      h: 0.45,
      fontSize: 14,
      bold: true,
      color: C.navy,
      align: "center",
      fit: "shrink",
    },
  );
  s.addText(data.privacy, {
    x: 2.1,
    y: 5.05,
    w: 9.1,
    h: 0.6,
    fontSize: 11,
    color: C.muted,
    align: "center",
    fit: "shrink",
  });
  logo(s);
  if (data.profiles?.length) {
    s = base();
    boxedTitle(s, "FILTRO", 0.5, 3.1);
    s.addText("Sexo", {
      x: 1.05,
      y: 1.55,
      w: 2,
      h: 0.5,
      fontSize: 25,
      bold: true,
      color: C.black,
      margin: 0,
    });
    data.profiles.slice(0, 6).forEach((p: any, i: number) => {
      const y = 2.35 + i * 0.68;
      s.addShape(pptx.ShapeType.rect, {
        x: 2.35,
        y,
        w: 6.4,
        h: 0.48,
        fill: { color: i % 2 ? C.pale : C.blue },
        line: { color: C.white },
      });
      s.addText(p.label, {
        x: 2.55,
        y: y + 0.1,
        w: 4.6,
        h: 0.23,
        fontSize: 14,
        color: C.black,
        margin: 0,
      });
      s.addText(percentage(p.percentage), {
        x: 7.35,
        y: y + 0.08,
        w: 1.1,
        h: 0.25,
        fontSize: 16,
        bold: true,
        color: C.black,
        align: "right",
        margin: 0,
      });
    });
    tag(s, "Filtro");
    logo(s);
  }
  const details = data.questionDetails || [];
  const categories = [
    ...new Set(details.map((q: any) => q.category)),
  ] as string[];
  for (const category of categories) {
    s = base();
    s.background = { color: C.navy };
    s.addText(category, {
      x: 1.15,
      y: 2.7,
      w: 11,
      h: 1.05,
      fontSize: 34,
      bold: true,
      color: C.white,
      align: "center",
      valign: "mid",
      fit: "shrink",
    });
    s.addShape(pptx.ShapeType.line, {
      x: 4.4,
      y: 4,
      w: 4.5,
      h: 0,
      line: { color: C.blue, width: 3 },
    });
    for (const q of details.filter(
      (x: any) => x.category === category && x.type !== "open_text",
    )) {
      s = base();
      s.addShape(pptx.ShapeType.rect, {
        x: 0.72,
        y: 0.35,
        w: 11.9,
        h: 0.72,
        fill: { color: C.navy },
        line: { color: C.navy, width: 1 },
      });
      s.addText(`${q.code} ${q.text}`, {
        x: 0.95,
        y: 0.5,
        w: 11.44,
        h: 0.4,
        fontSize: 16,
        bold: true,
        color: C.white,
        align: "center",
        valign: "mid",
        margin: 0,
        fit: "shrink",
      });
      const options = q.options || [];
      const yesPercentage = Number(q.existence_yes_percentage) || 0;
      const noPercentage = Number(q.existence_no_percentage) || 0;
      const summaryCells = [
        { value: yesPercentage, label: "SIM" },
        { value: noPercentage, label: "NÃO" },
      ];
      summaryCells.forEach((cell, i) => {
        const x = 6.45 + i * 1.92;
        s.addShape(pptx.ShapeType.rect, {
          x,
          y: 1.3,
          w: 0.82,
          h: 0.46,
          fill: { color: C.navy },
          line: { color: C.white, width: 1 },
        });
        s.addText(percentage(cell.value), {
          x: x + 0.03,
          y: 1.41,
          w: 0.76,
          h: 0.2,
          fontSize: 13,
          bold: true,
          color: C.white,
          align: "center",
          margin: 0,
        });
        s.addShape(pptx.ShapeType.rect, {
          x: x + 0.82,
          y: 1.3,
          w: 1.1,
          h: 0.46,
          fill: { color: C.navy },
          line: { color: C.white, width: 1 },
        });
        s.addText(cell.label, {
          x: x + 0.87,
          y: 1.41,
          w: 1,
          h: 0.2,
          fontSize: 12,
          color: C.white,
          align: "center",
          margin: 0,
        });
      });

      const plotX = 1.85;
      const plotY = 2.08;
      const plotW = 4.25;
      const rowGap = 0.86;
      for (let tick = 0; tick <= 10; tick++) {
        const x = plotX + (plotW * tick) / 10;
        s.addShape(pptx.ShapeType.line, {
          x,
          y: plotY - 0.12,
          w: 0,
          h: rowGap * 4 + 0.56,
          line: { color: tick === 0 ? "D8DEDF" : "E8ECEC", width: 0.7 },
        });
        s.addText(`${tick * 10}%`, {
          x: x - 0.25,
          y: 6.05,
          w: 0.5,
          h: 0.2,
          fontSize: 9,
          color: "4F5558",
          align: "center",
          margin: 0,
        });
      }
      satisfactionRows.forEach((row, i) => {
        const value = Math.max(0, Math.min(100, optionPercentage(options, row.matches)));
        const y = plotY + i * rowGap;
        s.addText(row.label, {
          x: 0.35,
          y: y + 0.09,
          w: 1.3,
          h: 0.26,
          fontSize: 11,
          color: "303437",
          align: "right",
          margin: 0,
          fit: "shrink",
        });
        if (value > 0) {
          const barW = Math.max(0.08, (plotW * value) / 100);
          s.addShape(pptx.ShapeType.roundRect, {
            x: plotX,
            y,
            w: barW,
            h: 0.52,
            rectRadius: 0.05,
            fill: { color: row.color },
            line: { color: row.color, transparency: 100 },
          });
          s.addText(percentage(value), {
            x: Math.min(plotX + barW + 0.08, 6.13),
            y: y + 0.13,
            w: 0.55,
            h: 0.2,
            fontSize: 10,
            bold: true,
            color: "303437",
            margin: 0,
          });
        }
      });
      (q.highlights || []).slice(0, 4).forEach((highlight: any, i: number) => {
        const y = 2.14 + i * 0.88;
        const item = typeof highlight === "string" ? { text: highlight, answer_label: null } : highlight;
        const palette = commentPalette(item.answer_label);
        s.addShape(pptx.ShapeType.roundRect, {
          x: 6.55,
          y,
          w: 5.65,
          h: 0.68,
          rectRadius: 0.08,
          fill: { color: palette.fill },
          line: { color: "E3E7E6", width: 0.8 },
        });
        s.addShape(pptx.ShapeType.roundRect, {
          x: 6.55,
          y,
          w: 0.1,
          h: 0.68,
          rectRadius: 0.05,
          fill: { color: palette.accent },
          line: { color: palette.accent, transparency: 100 },
        });
        s.addText(palette.label.toUpperCase(), {
          x: 6.82,
          y: y + 0.09,
          w: 1.75,
          h: 0.14,
          fontSize: 7,
          bold: true,
          color: palette.accent,
          margin: 0,
        });
        s.addText(redactComment(String(item.text || "")), {
          x: 6.82,
          y: y + 0.27,
          w: 5.08,
          h: 0.29,
          fontSize: 10.5,
          color: "27302F",
          align: "left",
          valign: "mid",
          margin: 0,
          fit: "shrink",
        });
      });
      tag(s, category);
      logo(s);
    }
    const cat = data.categories.find((x: any) => x.name === category);
    s = base();
    s.addShape(pptx.ShapeType.rect, {
      x: 0.72,
      y: 0.35,
      w: 11.9,
      h: 0.72,
      fill: { color: C.navy },
      line: { color: C.navy, width: 1 },
    });
    s.addText(`RESULTADO GERAL · ${category}`, {
      x: 0.95,
      y: 0.5,
      w: 11.44,
      h: 0.4,
      fontSize: 17,
      bold: true,
      color: C.white,
      align: "center",
      valign: "mid",
      margin: 0,
      fit: "shrink",
    });
    [
      { value: Number(cat?.existence_yes_percentage) || 0, label: "SIM" },
      { value: Number(cat?.existence_no_percentage) || 0, label: "NÃO" },
    ].forEach((cell, i) => {
      const x = 8.32 + i * 1.92;
      s.addShape(pptx.ShapeType.rect, { x, y: 1.3, w: 0.82, h: 0.46, fill: { color: C.navy }, line: { color: C.white, width: 1 } });
      s.addText(percentage(cell.value), { x: x + 0.03, y: 1.41, w: 0.76, h: 0.2, fontSize: 13, bold: true, color: C.white, align: "center", margin: 0 });
      s.addShape(pptx.ShapeType.rect, { x: x + 0.82, y: 1.3, w: 1.1, h: 0.46, fill: { color: C.navy }, line: { color: C.white, width: 1 } });
      s.addText(cell.label, { x: x + 0.87, y: 1.41, w: 1, h: 0.2, fontSize: 12, color: C.white, align: "center", margin: 0 });
    });
    const categoryOptions = cat?.options || [];
    const categoryPlotX = 3.45, categoryPlotY = 2.08, categoryPlotW = 8.35, categoryRowGap = 0.86;
    for (let tick = 0; tick <= 10; tick++) {
      const x = categoryPlotX + (categoryPlotW * tick) / 10;
      s.addShape(pptx.ShapeType.line, { x, y: categoryPlotY - 0.12, w: 0, h: categoryRowGap * 4 + 0.56, line: { color: tick === 0 ? "D8DEDF" : "E8ECEC", width: 0.7 } });
      s.addText(`${tick * 10}%`, { x: x - 0.25, y: 6.05, w: 0.5, h: 0.2, fontSize: 9, color: "4F5558", align: "center", margin: 0 });
    }
    satisfactionRows.forEach((row, i) => {
      const value = Math.max(0, Math.min(100, optionPercentage(categoryOptions, row.matches)));
      const y = categoryPlotY + i * categoryRowGap;
      s.addText(row.label, { x: 0.85, y: y + 0.09, w: 2.35, h: 0.26, fontSize: 11, color: "303437", align: "right", margin: 0, fit: "shrink" });
      if (value > 0) {
        const barW = Math.max(0.08, (categoryPlotW * value) / 100);
        s.addShape(pptx.ShapeType.roundRect, { x: categoryPlotX, y, w: barW, h: 0.52, rectRadius: 0.05, fill: { color: row.color }, line: { color: row.color, transparency: 100 } });
        s.addText(percentage(value), { x: Math.min(categoryPlotX + barW + 0.08, 11.93), y: y + 0.13, w: 0.55, h: 0.2, fontSize: 10, bold: true, color: "303437", margin: 0 });
      }
    });
    tag(s, category);
    logo(s);
  }
  const open = details.filter(
    (q: any) => q.type === "open_text" && q.highlights?.length,
  );
  if (open.length) {
    s = base();
    s.background = { color: C.navy };
    s.addText("Perguntas Abertas", {
      x: 1.15,
      y: 2.8,
      w: 11,
      h: 0.8,
      fontSize: 34,
      bold: true,
      color: C.white,
      align: "center",
    });
    for (const q of open) {
      s = base();
      boxedTitle(s, q.text, 0.45, 10.7);
      q.highlights.slice(0, 8).forEach((highlight: any, i: number) => {
        const text = typeof highlight === "string" ? highlight : highlight.text;
        const y = 1.65 + i * 0.63;
        s.addShape(pptx.ShapeType.ellipse, {
          x: 1.1,
          y: y + 0.05,
          w: 0.28,
          h: 0.28,
          fill: { color: C.navy },
          line: { color: C.navy },
        });
        s.addText(redactComment(text), {
          x: 1.6,
          y,
          w: 10.4,
          h: 0.42,
          fontSize: 14,
          color: C.black,
          margin: 0,
          fit: "shrink",
        });
      });
      tag(s, q.category);
      logo(s);
    }
  }
  s = base();
  boxedTitle(s, "RESUMO POR AGRUPAMENTO\nDE PERGUNTAS", 0.45, 5);
  data.categories.slice(0, 12).forEach((c: any, i: number) => {
    const col = i < 6 ? 0 : 1,
      row = i % 6,
      x = 2.05 + col * 5.2,
      y = 2.05 + row * 0.62;
    s.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 3.55,
      h: 0.47,
      fill: { color: C.pale },
      line: { color: C.white },
    });
    s.addText(c.name, {
      x: x + 0.12,
      y: y + 0.12,
      w: 2.75,
      h: 0.2,
      fontSize: 12,
      color: C.black,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
    s.addShape(pptx.ShapeType.rect, {
      x: x + 3.55,
      y,
      w: 0.72,
      h: 0.47,
      fill: { color: C.blue },
      line: { color: C.white },
    });
    s.addText(percentage(c.favorability), {
      x: x + 3.58,
      y: y + 0.11,
      w: 0.65,
      h: 0.22,
      fontSize: 13,
      bold: true,
      color: C.black,
      align: "center",
      margin: 0,
    });
  });
  tag(s, "Índice de Favorabilidade");
  logo(s);
  s = base();
  boxedTitle(s, "RESULTADO\nGERAL", 0.45, 4.2);
  s.addShape(pptx.ShapeType.rect, {
    x: 4.95,
    y: 2.55,
    w: 3.05,
    h: 1.45,
    fill: { color: C.blue },
    line: { color: C.blue },
  });
  s.addText(percentage(data.summary.favorability), {
    x: 5.05,
    y: 2.82,
    w: 2.85,
    h: 0.8,
    fontSize: 43,
    bold: true,
    color: C.black,
    align: "center",
    margin: 0,
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 4.75,
    y: 4.45,
    w: 3.45,
    h: 0.62,
    fill: { color: C.white, transparency: 100 },
    line: { color: C.navy },
  });
  s.addText("ÍNDICE DE\nFAVORABILIDADE", {
    x: 4.9,
    y: 4.55,
    w: 3.15,
    h: 0.42,
    fontSize: 16,
    bold: true,
    color: C.black,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  logo(s);
  s = base();
  boxedTitle(s, "Índice de Favorabilidade", 0.45, 5.3);
  const fav = Number(data.summary.favorability || 0),
    bands = [
      ["Baixíssima", "D62828"],
      ["Baixa", "F05A00"],
      ["Média baixa", "FFB800"],
      ["Média", "F8E63C"],
      ["Média Alta", "94C11F"],
      ["Alta", "57BE20"],
      ["Muito alta", "2F9E44"],
    ];
  bands.forEach((b, i) => {
    const x = 2.1 + i * 1.3;
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: 4.05,
      w: 1.24,
      h: 0.72,
      fill: { color: b[1] },
      line: { color: C.white, width: 2 },
    });
    s.addText(b[0], {
      x: x - 0.08,
      y: 4.92,
      w: 1.4,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: i === Math.min(6, Math.floor(fav / 14.3)) ? C.black : "C8C8C8",
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  });
  const pointer = 2.1 + Math.min(6.5, (fav / 100) * 7) * 1.3;
  s.addShape(pptx.ShapeType.chevron, {
    x: pointer - 0.15,
    y: 3.57,
    w: 0.3,
    h: 0.45,
    rotate: 90,
    fill: { color: "EF1D26" },
    line: { color: "EF1D26" },
  });
  s.addText(percentage(fav), {
    x: 8.35,
    y: 2.35,
    w: 2.25,
    h: 0.65,
    fontSize: 34,
    bold: true,
    color: C.black,
    margin: 0,
  });
  logo(s);
  if (data.topics.length) {
    s = base("Destaques Positivos");
    data.topics
      .filter((t: any) => Number(t.positive) > 0)
      .slice(0, 8)
      .forEach((t: any, i: number) =>
        s.addText(`• ${t.name} — ${t.positive} menções positivas`, {
          x: 1,
          y: 1.35 + i * 0.62,
          w: 10.8,
          h: 0.35,
          fontSize: 15,
          color: C.black,
          margin: 0,
          fit: "shrink",
        }),
      );
    s.addText("✓", {
      x: 10.8,
      y: 0.25,
      w: 1.4,
      h: 1,
      fontSize: 60,
      color: "9ED17E",
      rotate: 8,
      margin: 0,
    });
    logo(s);
    s = base("Pontos de Atenção");
    data.topics
      .filter((t: any) => Number(t.negative) > 0)
      .slice(0, 8)
      .forEach((t: any, i: number) =>
        s.addText(`• ${t.name} — ${t.negative} menções negativas`, {
          x: 1,
          y: 1.35 + i * 0.62,
          w: 11,
          h: 0.35,
          fontSize: 15,
          color: C.black,
          margin: 0,
          fit: "shrink",
        }),
      );
    logo(s);
  }
  if (data.plans.length) {
    s = base();
    s.background = { color: C.navy };
    s.addText("Plano de Ação", {
      x: 1.2,
      y: 2.8,
      w: 10.9,
      h: 0.8,
      fontSize: 35,
      bold: true,
      color: C.white,
      align: "center",
    });
    for (const p of data.plans) {
      s = base();
      boxedTitle(
        s,
        `Plano de Ação - ${p.priority || p.status || "AÇÃO"}`,
        0.35,
        6.6,
      );
      const blocks = [
        ["O que?", p.problem || p.title],
        ["Por que?", p.source || "Ponto priorizado a partir do diagnóstico."],
        ["Como?", p.proposed_action || p.action],
        ["Quando?", date(p.due_date)],
      ];
      blocks.forEach((block, i) => {
        const y = 1.45 + i * 1.3;
        s.addShape(pptx.ShapeType.roundRect, {
          x: 1.05,
          y,
          w: 11.05,
          h: 1.03,
          rectRadius: 0.06,
          fill: { color: C.gray },
          line: { color: C.gray },
        });
        s.addShape(pptx.ShapeType.roundRect, {
          x: 1.2,
          y: y - 0.13,
          w: 1.55,
          h: 0.32,
          rectRadius: 0.05,
          fill: { color: C.navy },
          line: { color: C.navy },
        });
        s.addText(block[0], {
          x: 1.45,
          y: y - 0.08,
          w: 1.05,
          h: 0.2,
          fontSize: 12,
          bold: true,
          color: C.white,
          margin: 0,
        });
        s.addText(String(block[1] || "Não definido"), {
          x: 1.55,
          y: y + 0.35,
          w: 10.05,
          h: 0.42,
          fontSize: 15,
          color: C.black,
          margin: 0,
          fit: "shrink",
        });
      });
      logo(s);
    }
  }
  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}

export async function createPptxLegacy(
  data: ReportData,
  type: "general" | "leadership",
) {
  const PptxGenJS: any = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = data.diagnostic.company_name;
  pptx.subject = "Relatório de diagnóstico organizacional";
  pptx.title =
    type === "general" ? "Relatório geral" : `Relatório de ${data.person.name}`;
  pptx.company = data.diagnostic.company_name;
  pptx.lang = "pt-BR";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "pt-BR",
  };
  const footer = (slide: any, n: number) => {
    slide.addText(
      `${data.diagnostic.name} · ${type === "leadership" ? "Confidencial" : "Resultados agregados"}`,
      { x: 0.55, y: 7.15, w: 10.8, h: 0.18, fontSize: 8, color: "899491" },
    );
    slide.addText(String(n), {
      x: 12,
      y: 7.15,
      w: 0.7,
      h: 0.18,
      fontSize: 8,
      color: "899491",
      align: "right",
    });
  };
  let n = 1;
  let slide = pptx.addSlide();
  slide.background = { color: colors.dark };
  slide.addText("DIAGNÓSTICO ORGANIZACIONAL", {
    x: 0.7,
    y: 0.7,
    w: 6,
    h: 0.3,
    fontSize: 12,
    bold: true,
    color: colors.gold,
    charSpacing: 1.5,
  });
  slide.addText(
    type === "general"
      ? "Relatório geral"
      : "Relatório confidencial de liderança",
    {
      x: 0.7,
      y: 1.35,
      w: 11.5,
      h: 1.05,
      fontSize: 30,
      bold: true,
      color: colors.white,
      breakLine: false,
      fit: "shrink",
    },
  );
  slide.addText(
    type === "general"
      ? data.diagnostic.trade_name || data.diagnostic.company_name
      : data.person.name,
    { x: 0.7, y: 2.65, w: 10.5, h: 0.5, fontSize: 20, color: "D6E3E0" },
  );
  slide.addText(
    `${data.diagnostic.name}  |  ${date(data.diagnostic.starts_on)} a ${date(data.diagnostic.ends_on)}`,
    { x: 0.7, y: 3.35, w: 10.5, h: 0.35, fontSize: 12, color: "D6E3E0" },
  );
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.7,
    y: 5.55,
    w: 11.9,
    h: 0.9,
    rectRadius: 0.05,
    fill: { color: "214F48" },
    line: { color: "214F48" },
  });
  slide.addText("PRIVACIDADE E USO", {
    x: 0.95,
    y: 5.75,
    w: 2.1,
    h: 0.2,
    fontSize: 10,
    bold: true,
    color: colors.white,
  });
  slide.addText(data.privacy, {
    x: 3,
    y: 5.68,
    w: 9.2,
    h: 0.35,
    fontSize: 10,
    color: "D6E3E0",
    fit: "shrink",
  });
  footer(slide, n++);
  slide = pptx.addSlide();
  slide.background = { color: colors.white };
  slide.addText("Resumo executivo", {
    x: 0.6,
    y: 0.4,
    w: 7,
    h: 0.5,
    fontSize: 26,
    bold: true,
    color: colors.dark,
  });
  const metrics = [
    ["Participantes", data.summary.completed_interviews],
    ["Respostas", data.summary.response_count],
    ["Favorabilidade", pct(data.summary.favorability)],
  ];
  metrics.forEach((m, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6 + i * 4.1,
      y: 1.25,
      w: 2.75,
      h: 1,
      fill: { color: colors.cream },
      line: { color: colors.line },
      radius: 0.06,
    });
    slide.addText(String(m[0]).toUpperCase(), {
      x: 0.82 + i * 4.1,
      y: 1.48,
      w: 2.3,
      h: 0.18,
      fontSize: 9,
      color: colors.gray,
      bold: true,
    });
    slide.addText(String(m[1] ?? 0), {
      x: 0.82 + i * 4.1,
      y: 1.75,
      w: 2.3,
      h: 0.35,
      fontSize: 22,
      color: colors.dark,
      bold: true,
    });
  });
  slide.addText(
    type === "general" ? "Resultados por categoria" : "Resultados por pergunta",
    {
      x: 0.6,
      y: 2.65,
      w: 6,
      h: 0.35,
      fontSize: 18,
      bold: true,
      color: colors.dark,
    },
  );
  const rows = (
    type === "general" ? data.categories : data.questions || []
  ).slice(0, 8);
  rows.forEach((r, i) => {
    const yy = 3.2 + i * 0.43,
      label = type === "general" ? r.name : `${r.code} · ${r.text}`;
    slide.addText(label, {
      x: 0.65,
      y: yy,
      w: 5.4,
      h: 0.22,
      fontSize: 10,
      color: colors.dark,
      fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.25,
      y: yy + 0.03,
      w: 5.15,
      h: 0.12,
      fill: { color: "E7ECEB" },
      line: { color: "E7ECEB" },
      radius: 0.04,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.25,
      y: yy + 0.03,
      w: Math.max(0.05, (5.15 * Number(r.favorability || 0)) / 100),
      h: 0.12,
      fill: { color: scoreColor(r.favorability) },
      line: { color: scoreColor(r.favorability) },
      radius: 0.04,
    });
    slide.addText(pct(r.favorability), {
      x: 11.55,
      y: yy - 0.03,
      w: 0.8,
      h: 0.2,
      fontSize: 10,
      bold: true,
      color: colors.dark,
      align: "right",
    });
  });
  footer(slide, n++);
  if (data.topics.length) {
    slide = pptx.addSlide();
    slide.addText("Agrupadores de comentários", {
      x: 0.6,
      y: 0.4,
      w: 8,
      h: 0.5,
      fontSize: 26,
      bold: true,
      color: colors.dark,
    });
    slide.addText("Temas recorrentes sem identificação dos participantes", {
      x: 0.6,
      y: 0.95,
      w: 8,
      h: 0.3,
      fontSize: 12,
      color: colors.gray,
    });
    data.topics.slice(0, 10).forEach((t, i) => {
      const yy = 1.5 + i * 0.5;
      slide.addText(String(i + 1).padStart(2, "0"), {
        x: 0.65,
        y: yy,
        w: 0.4,
        h: 0.23,
        fontSize: 10,
        bold: true,
        color: colors.green,
      });
      slide.addText(t.name, {
        x: 1.15,
        y: yy,
        w: 5.5,
        h: 0.23,
        fontSize: 12,
        bold: true,
        color: colors.dark,
      });
      slide.addText(`${t.mentions} menções`, {
        x: 7,
        y: yy,
        w: 1.2,
        h: 0.23,
        fontSize: 10,
        color: colors.gray,
      });
      slide.addText(`${t.positive} positivas`, {
        x: 8.4,
        y: yy,
        w: 1.3,
        h: 0.23,
        fontSize: 10,
        color: colors.green,
      });
      slide.addText(`${t.negative} negativas`, {
        x: 9.9,
        y: yy,
        w: 1.4,
        h: 0.23,
        fontSize: 10,
        color: colors.red,
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.65,
        y: yy + 0.34,
        w: 11.5,
        h: 0,
        line: { color: colors.line, width: 1 },
      });
    });
    footer(slide, n++);
  }
  if (data.comments.length) {
    for (let offset = 0; offset < data.comments.length; offset += 6) {
      slide = pptx.addSlide();
      slide.addText(
        offset
          ? "Comentários selecionados · continuação"
          : "Comentários selecionados",
        {
          x: 0.6,
          y: 0.4,
          w: 9,
          h: 0.5,
          fontSize: 26,
          bold: true,
          color: colors.dark,
        },
      );
      slide.addText("Trechos anônimos para contextualizar os resultados", {
        x: 0.6,
        y: 0.95,
        w: 8,
        h: 0.3,
        fontSize: 12,
        color: colors.gray,
      });
      data.comments.slice(offset, offset + 6).forEach((c, i) => {
        const yy = 1.45 + i * 0.82;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.65,
          y: yy,
          w: 11.9,
          h: 0.68,
          fill: { color: colors.cream },
          line: { color: colors.line },
          radius: 0.04,
        });
        slide.addText(`${c.code} · ${c.category}`.toUpperCase(), {
          x: 0.85,
          y: yy + 0.1,
          w: 2.1,
          h: 0.15,
          fontSize: 8,
          bold: true,
          color: colors.green,
        });
        slide.addText(c.original_text, {
          x: 2.65,
          y: yy + 0.1,
          w: 9.45,
          h: 0.42,
          fontSize: 11,
          color: colors.dark,
          fit: "shrink",
          valign: "mid",
        });
      });
      footer(slide, n++);
    }
  }
  if (type === "general" && data.plans.length) {
    slide = pptx.addSlide();
    slide.addText("Plano de ação", {
      x: 0.6,
      y: 0.4,
      w: 7,
      h: 0.5,
      fontSize: 26,
      bold: true,
      color: colors.dark,
    });
    data.plans.slice(0, 6).forEach((p, i) => {
      const yy = 1.25 + i * 0.88;
      slide.addText(p.problem, {
        x: 0.7,
        y: yy,
        w: 4.1,
        h: 0.28,
        fontSize: 12,
        bold: true,
        color: colors.dark,
        fit: "shrink",
      });
      slide.addText(p.proposed_action, {
        x: 4.9,
        y: yy,
        w: 5.1,
        h: 0.42,
        fontSize: 10,
        color: colors.gray,
        fit: "shrink",
      });
      slide.addText(p.responsible, {
        x: 10.2,
        y: yy,
        w: 1.3,
        h: 0.22,
        fontSize: 9,
        color: colors.dark,
        fit: "shrink",
      });
      slide.addText(date(p.due_date), {
        x: 11.55,
        y: yy,
        w: 0.8,
        h: 0.22,
        fontSize: 9,
        color: colors.gray,
        align: "right",
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.7,
        y: yy + 0.58,
        w: 11.65,
        h: 0,
        line: { color: colors.line, width: 1 },
      });
    });
    footer(slide, n++);
  }
  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
