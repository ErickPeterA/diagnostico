import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool.js';

const migrationsDir = path.resolve('migrations');
const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const applied = new Set((await pool.query<{version:string}>('SELECT version FROM schema_migrations')).rows.map(r => r.version));
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await fs.readFile(path.join(migrationsDir,file),'utf8');
  await pool.query(sql);
  if (file !== '002_analytics_views.sql') await pool.query('INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING',[file]);
  console.log(`Aplicada: ${file}`);
}
await pool.end();
