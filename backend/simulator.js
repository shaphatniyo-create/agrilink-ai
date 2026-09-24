const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Keep track of the last simulated values for each device to make it realistic
const state = {};

function fluctuate(val, min, max, maxDelta) {
  const delta = (Math.random() * maxDelta * 2) - maxDelta;
  return Math.min(max, Math.max(min, val + delta));
}

async function run() {
  console.log('AgriLink Live Data Simulator starting...');

  setInterval(async () => {
    try {
      const devices = await p.iotDevice.findMany({ where: { status: 'ACTIVE' } });
      
      for (const dev of devices) {
        if (!state[dev.id]) {
          state[dev.id] = {
            moisture: 40 + Math.random() * 20,
            temp: 24 + Math.random() * 4,
            ph: 6.5 + Math.random(),
            n: 140 + Math.random() * 30,
            p: 70 + Math.random() * 20,
            k: 200 + Math.random() * 40,
          };
        }

        const s = state[dev.id];
        // fluctuate values slightly
        s.moisture = fluctuate(s.moisture, 10, 90, 1.5);
        s.temp = fluctuate(s.temp, 15, 35, 0.3);
        s.ph = fluctuate(s.ph, 5.0, 8.0, 0.05);
        s.n = fluctuate(s.n, 50, 300, 3);
        s.p = fluctuate(s.p, 20, 150, 2);
        s.k = fluctuate(s.k, 100, 400, 4);

        const pump = s.moisture < 30 ? 'ON' : 'OFF';

        await p.soilReading.create({
          data: {
            deviceId: dev.id,
            farmId: dev.farmId,
            moisturePct: Number(s.moisture.toFixed(1)),
            temperatureC: Number(s.temp.toFixed(1)),
            ph: Number(s.ph.toFixed(1)),
            nitrogenPpm: Math.round(s.n),
            phosphorusPpm: Math.round(s.p),
            potassiumPpm: Math.round(s.k),
            pumpState: pump,
          },
        });

        await p.iotDevice.update({
          where: { id: dev.id },
          data: { lastSeenAt: new Date() },
        });
      }

      if (devices.length > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Simulated live data for ${devices.length} devices.`);
      }
    } catch (err) {
      console.error('Simulation error:', err.message);
    }
  }, 2000);
}

run().catch(console.error);
