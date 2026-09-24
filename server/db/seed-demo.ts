import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória para executar o seed.');
if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_CONFIRM !== 'YES') {
  throw new Error('Seed bloqueado em produção. Defina DEMO_SEED_CONFIRM=YES apenas se realmente desejar dados fictícios.');
}
const sql=await fs.readFile(path.resolve('seeds/demo.sql'),'utf8');
console.log('Inserindo demonstração fictícia no PostgreSQL configurado...');
await pool.query(sql);
await pool.end();
console.log('Seed concluído: Empresa Demonstração / Diagnóstico de Clima 2026.');
