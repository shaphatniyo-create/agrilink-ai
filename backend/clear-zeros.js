const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Delete the colliding zero-data readings that got stuck in the DB
  const deleted = await p.soilReading.deleteMany({
    where: { moisturePct: 0 }
  });
  console.log(`Deleted ${deleted.count} zero-data records.`);
}

run().catch(console.error).finally(() => p.$disconnect());
