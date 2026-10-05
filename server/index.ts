import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db/pool.js';
import { api } from './routes.js';
import { adminApi } from './admin-routes.js';
import { analyticsApi } from './analytics-routes.js';
import { actionPlanApi } from './action-plan-routes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((_,res,next) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  next();
});
app.get('/health', async (_req,res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status:'ok', database:'diagnostico_clima' });
  } catch {
    res.status(503).json({ status:'unavailable', database:'unavailable' });
  }
});
app.use('/api',adminApi);
app.use('/api',analyticsApi);
app.use('/api',actionPlanApi);
app.use('/api',api);

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here,'../dist-client');
app.use(express.static(clientDir,{ index:false }));
app.get('/{*splat}',(_req,res) => res.sendFile(path.join(clientDir,'index.html')));
app.use((err: unknown,_req: express.Request,res: express.Response,_next: express.NextFunction) => {
  console.error(err instanceof Error ? err.message : 'Erro interno');
  res.status(500).json({ error:'Não foi possível concluir a operação.' });
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
app.listen(port,host,() => console.log(`Servidor em http://${host}:${port}`));
