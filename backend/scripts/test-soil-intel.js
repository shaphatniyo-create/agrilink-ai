// Smoke test for the soil-intelligence API against the running local backend.
// Picks the farm with the most recent sensor reading (or any farm), signs a
// short-lived access token for its owner, runs the analysis and prints it.
// Usage (from backend/):  node scripts/test-soil-intel.js
require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL.replace(/\?schema=.*$/, '') });
  await db.connect();
  const { rows } = await db.query(`
    SELECT f.id, f.name, f."ownerId", f.latitude, f.longitude,
           (SELECT max(r."recordedAt") FROM "SoilReading" r WHERE r."farmId" = f.id) AS last_reading
    FROM "Farm" f ORDER BY last_reading DESC NULLS LAST LIMIT 1`);
  const counts = await db.query(`SELECT
    (SELECT count(*) FROM "CropSoilRequirement") req, (SELECT count(*) FROM "FertilizerRecommendation") fert,
    (SELECT count(*) FROM "LimeRecommendation") lime, (SELECT count(*) FROM "SoilReference") refs`);
  await db.end();
  console.log('Reference rows:', counts.rows[0]);
  if (!rows[0]) { console.log('No farms in the database.'); return; }
  const farm = rows[0];
  console.log('Farm:', farm.name, '| last reading:', farm.last_reading, '| GPS:', farm.latitude, farm.longitude);
  const token = jwt.sign({ sub: farm.ownerId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
  const base = `http://localhost:${process.env.PORT || 4000}/api/v1/soil-intel`;
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(`${base}/farms/${farm.id}/analyze`, { method: 'POST', headers: h, body: '{}' });
  const body = await res.json();
  console.log('\nPOST analyze ->', res.status);
  if (!res.ok) { console.log(body); process.exitCode = 1; return; }
  console.log('Status:', body.status, '| score:', body.suitabilityScore, '| crop:', body.crop?.name);
  console.log('Summary:', body.summary);
  console.log('Location:', body.location);
  console.log('Comparisons:'); for (const c of body.comparisons) console.log('  ', c.label, '| sensor', c.sensor, '| ref', c.reference, '| need', c.min, '-', c.max, '|', c.status);
  console.log('Lime:', body.lime && { class: body.lime.fertilityClass, ph: body.lime.ph, from: body.lime.phSource, rate: body.lime.rateTHa, needed: body.lime.needed });
  console.log('Fertilizer:', body.fertilizer?.recommended?.code || '(none)', '| N level:', body.fertilizer?.nitrogenLevel, '|', body.fertilizer?.nutrientNotes);
  console.log('Ranking:', body.ranking.map((r) => `${r.name} ${r.score}`).join(', '));
  console.log('Reference:', body.reference ? `${body.reference.source} pH ${body.reference.ph} ${body.reference.texture}` : null);

  // Reference lookup for a Musanze point (volcanic soils) - exercises the SoilGrids fetch + cache.
  const ref = await fetch(`${base}/reference?lat=-1.4998&lng=29.6346`, { headers: h });
  const rj = await ref.json();
  console.log('\nGET reference (Musanze) ->', ref.status, rj && { ph: rj.ph, texture: rj.texture, soc: rj.organicCarbonGKg, cec: rj.cecCmolKg, source: rj.source });
})().catch((e) => { console.error('TEST FAILED:', e); process.exitCode = 1; });
