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
    await db.query(readFileSync(join(__dirname, '..', 'prisma', 'seed.sql'), 'utf-8'));

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
