import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.iotDevice.deleteMany({ where: { deviceCode: 'IOT-DEMO0001' } })
  .then(() => console.log('Deleted demo device'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
