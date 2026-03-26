const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial SUPER_ADMIN user...');

  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@fourpoints.com' }
  });

  if (existingAdmin) {
    console.log('Admin user already exists.');
    return;
  }

  const hash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Super Administrator',
      email: 'admin@fourpoints.com',
      passwordHash: hash,
      role: 'SUPER_ADMIN',
    }
  });

  console.log('Successfully created admin user:', admin.email, 'password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
