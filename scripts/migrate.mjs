// 사용법: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const statements = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);
for (const s of statements) await sql.query(s);
const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
console.log('tables:', tables.map((t) => t.table_name).join(', '));
