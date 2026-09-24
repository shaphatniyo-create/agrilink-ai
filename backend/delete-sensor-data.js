const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Delete all existing soil readings to start fresh
  const deleted = await p.soilReading.deleteMany({});
  console.log(`Deleted ${deleted.count} sensor records.`);
}

run().catch(console.error).finally(() => p.$disconnect());
