const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 10
  });
  console.log('USERS:', JSON.stringify(users, null, 2));

  const farms = await prisma.farm.findMany({
    select: { id: true, name: true, ownerId: true },
    take: 10
  });
  console.log('FARMS:', JSON.stringify(farms, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
