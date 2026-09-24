/**
 * Wraps prisma/seed.sql (hand-verified against a live PostgreSQL instance --
 * see docs/DEPLOYMENT.md) rather than re-deriving the same seed data through
 * Prisma Client, so there is exactly one source of truth for seed content.
 * Run via `npm run prisma:seed` (also invoked automatically by
 * `prisma migrate dev` / `prisma db seed`).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function main() {
  const sql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log('AgriLink AI seed data loaded successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
