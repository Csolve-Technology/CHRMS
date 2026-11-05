const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function main() {
  if (await prisma.user.findFirst({ where: { role: 'ADMIN', roleNames: ['ADMIN'] } })) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 16) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters)');
  await prisma.user.create({ data: { email, fullName: 'System Administrator',
    passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN', roleNames: ['ADMIN'] } });
  console.log('Initial administrator created. Credentials are stored in the VPS .env file.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
