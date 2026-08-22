require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
  const email = 'analkumarbiswas.official@gmail.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  console.log('before:', existing);
  if (!existing) {
    console.log('No user row found with that email — they must log in at least once first.');
    return;
  }
  const updated = await prisma.user.update({
    where: { email },
    data: { isSuperadmin: true },
  });
  console.log('after:', updated);
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
