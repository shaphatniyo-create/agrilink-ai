// Registers the ESP8266 as an AgriLink device (so it can upload straight to
// /api/v1/iot/ingest), proves the upload path works end to end, and writes
// the device code, secret and this PC's LAN address into
// esp8266-agrilink-http.ino, ready to flash.
// Usage (from backend/, with the API running):  node scripts/setup-esp-device.js
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 4000;
const API = `http://localhost:${PORT}/api/v1`;
const FW = path.join(__dirname, '..', 'esp8266-agrilink-http.ino');
const LABEL = 'ESP8266 NPK probe (direct upload)';

function lanIp() {
  const cands = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address)) {
        cands.push({ name, address: a.address, wifi: /wi-?fi|wlan|wireless/i.test(name) });
      }
    }
  }
  cands.sort((x, y) => Number(y.wifi) - Number(x.wifi));
  return cands[0]?.address || null;
}

(async () => {
  let fw = fs.readFileSync(FW, 'utf8');
  if (!fw.includes('PASTE-DEVICE-CODE-HERE')) {
    console.log('Firmware already has device credentials - nothing to do.');
    return;
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL.replace(/\?schema=.*$/, '') });
  await db.connect();
  // The farm the ESP already feeds (bridge device), else the farm with the latest reading.
  const { rows } = await db.query(`
    SELECT f.id, f.name, f."ownerId" FROM "Farm" f
    LEFT JOIN "IotDevice" d ON d."farmId" = f.id AND (d.label = 'Local ESP8266' OR d."deviceCode" IN ('SOIL-001','FARM-001'))
    ORDER BY (d.id IS NULL), (SELECT max(r."recordedAt") FROM "SoilReading" r WHERE r."farmId" = f.id) DESC NULLS LAST
    LIMIT 1`);
  if (!rows[0]) throw new Error('No farm found - create a farm in the app first.');
  const farm = rows[0];
  console.log(`Farm: ${farm.name} (${farm.id})`);

  const token = jwt.sign({ sub: farm.ownerId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1. Register the device through the real API (secret is returned once).
  let res = await fetch(`${API}/iot/devices`, { method: 'POST', headers: h, body: JSON.stringify({ farmId: farm.id, label: LABEL }) });
  const reg = await res.json();
  if (!res.ok) throw new Error(`Device registration failed (${res.status}): ${JSON.stringify(reg)}`);
  const deviceCode = reg.device.deviceCode;
  const apiKey = reg.apiKey;
  console.log(`Registered device ${deviceCode}`);

  // 2. Prove the ESP upload path: same request the firmware sends.
  const ip = lanIp();
  const url = ip ? `http://${ip}:${PORT}/api/v1/iot/ingest` : `${API}/iot/ingest`;
  res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode, apiKey, moisturePct: 45, temperatureC: 22, ph: 6.2, nitrogenPpm: 120, phosphorusPpm: 60, potassiumPpm: 180, pumpState: 'OFF' }),
  });
  const ing = await res.json();
  console.log(`Test upload to ${url} -> HTTP ${res.status}, pumpCommand=${ing.pumpCommand}`);
  if (!res.ok) throw new Error(`Ingest failed: ${JSON.stringify(ing)}`);
  const bad = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceCode, apiKey: 'wrong' }) });
  console.log(`Upload with a wrong secret -> HTTP ${bad.status} (expected 401)`);

  // Remove the test reading so it doesn't show on the dashboard.
  await db.query('DELETE FROM "SensorAlert" WHERE "deviceId" = $1', [reg.device.id]);
  await db.query('DELETE FROM "SoilReading" WHERE id = $1', [ing.reading.id]);
  await db.end();

  // 3. Write credentials + address into the firmware.
  fw = fw.replace('PASTE-DEVICE-CODE-HERE', deviceCode).replace('PASTE-DEVICE-SECRET-HERE', apiKey);
  if (ip) fw = fw.replace(/const char\* AGRILINK_URL = "http:\/\/[^"]*";/, `const char* AGRILINK_URL = "http://${ip}:${PORT}/api/v1/iot/ingest";`);
  fs.writeFileSync(FW, fw);
  console.log(`Firmware updated: ${path.basename(FW)} -> ${ip ? `http://${ip}:${PORT}` : '(set AGRILINK_URL by hand)'}`);
  console.log('RESULT: OK');
})().catch((e) => { console.error('RESULT: FAILED -', e.message); process.exitCode = 1; });
