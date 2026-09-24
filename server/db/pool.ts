import pg from 'pg';
import { existsSync } from 'node:fs';

// Conveniência apenas para desenvolvimento; em produção o Docker injeta o ambiente.
if (process.env.NODE_ENV !== 'production' && existsSync('.env')) process.loadEnvFile('.env');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) console.warn('DATABASE_URL não definida; rotas de banco responderão indisponíveis.');

export const pool = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
pool.on('error', () => console.error('Conexão PostgreSQL ociosa encerrou inesperadamente.'));
