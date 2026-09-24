const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const readings = await p.soilReading.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      device: { select: { deviceCode: true, label: true } },
      farm: { select: { name: true } },
    },
  });

  if (readings.length === 0) {
    console.log('No readings in DB.');
    return;
  }

  for (const r of readings) {
    console.log(`[${r.createdAt.toLocaleTimeString()}] Farm: ${r.farm?.name} | Device: ${r.device?.deviceCode}`);
    console.log(`  Moisture: ${r.moisturePct}%  Temp: ${r.temperatureC}°C  pH: ${r.ph}`);
    console.log(`  N: ${r.nitrogenPpm}ppm  P: ${r.phosphorusPpm}ppm  K: ${r.potassiumPpm}ppm  Pump: ${r.pumpState}`);
  }
}

run().catch(console.error).finally(() => p.$disconnect());
