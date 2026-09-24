// First-boot database bootstrap for hosted deployments (e.g. Render free plan,
// which has no shell to run seeds by hand).
//  - If the database has no users yet, loads prisma/seed.sql (geography, crops,
//    plans, demo data).
//  - Every seeded account shares the public demo password, so on a hosted site
//    we lock them: the founding Super Admin gets SEED_ADMIN_PASSWORD, and all
//    other seeded demo accounts get a random, unusable password unless
//    KEEP_DEMO_PASSWORDS=true.
// Safe to run on every boot: it does nothing once users exist.
require('dotenv').config();
const { readFileSync } = require('fs');
const { join } = require('path');
const { randomBytes } = require('crypto');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const FOUNDER_EMAIL = process.env.SEED_ADMIN_EMAIL || 'shaphatniyo@gmail.com';

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL.replace(/\?schema=.*$/, '') });
  await db.connect();
  try {
    const { rows } = await db.query('SELECT count(*)::int AS n FROM "User"');
    if (rows[0].n > 0) { console.log(`[bootstrap] ${rows[0].n} users exist - skipping seed.`); return; }

    if (!process.env.SEED_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD.length < 10) {
      throw new Error('SEED_ADMIN_PASSWORD (min 10 characters) must be set before the first boot.');
    }
    console.log('[bootstrap] Empty database - loading prisma/seed.sql ...');
    // seed.sql hashes passwords with crypt()/gen_salt() from pgcrypto.
    await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    // A schema created by `prisma db push` has no database defaults for
    // @updatedAt columns (Prisma fills them in itself), but seed.sql relies on
    // them. Add now() as a default; Prisma still sets the value on every write.
    const upd = await db.query(`SELECT table_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND column_name = 'updatedAt' AND column_default IS NULL`);
    for (const r of upd.rows) await db.query(`ALTER TABLE "${r.table_name}" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
    // The seed's helper table must use the same id type as the real tables
    // (text after `prisma db push`, uuid after the SQL migrations).
    const t = await db.query(`SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'id'`);
    const idType = t.rows[0]?.data_type === 'uuid' ? 'UUID' : 'TEXT';
    let seed = readFileSync(join(__dirname, '..', 'prisma', 'seed.sql'), 'utf-8');
    seed = seed.replace('CREATE TEMP TABLE ids (key TEXT PRIMARY KEY, id UUID);', `CREATE TEMP TABLE ids (key TEXT PRIMARY KEY, id ${idType});`);
    await db.query(seed);

    const founderHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 10);
    const f = await db.query('UPDATE "User" SET "passwordHash" = $1 WHERE lower(email) = lower($2)', [founderHash, FOUNDER_EMAIL]);
    console.log(`[bootstrap] Founding Super Admin password set (${f.rowCount} account).`);

    if (process.env.KEEP_DEMO_PASSWORDS !== 'true') {
      const lockHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      const d = await db.query('UPDATE "User" SET "passwordHash" = $1 WHERE email IS DISTINCT FROM $2', [lockHash, FOUNDER_EMAIL]);
      console.log(`[bootstrap] Locked ${d.rowCount} demo accounts (set KEEP_DEMO_PASSWORDS=true to keep the demo password).`);
    }
  } finally {
    await db.end();
  }
})().catch((e) => { console.error('[bootstrap] FAILED:', e.message); process.exit(1); });
