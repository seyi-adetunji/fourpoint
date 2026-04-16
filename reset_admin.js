const { PrismaClient } = require('./src/generated/client5');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetAdmin() {
  const email = 'admin@fourpoints.com';
  const password = 'password123';
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);

  try {
    console.log('Resetting admin password...');
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash },
      create: {
        id: 'admin-prod',
        name: 'System Admin',
        email: email,
        passwordHash: hash,
        role: 'SUPER_ADMIN',
        isActive: true
      }
    });
    console.log('✅ Admin credentials reset successfully!');
    console.log('Email: admin@fourpoints.com');
    console.log('Password: password123');
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();
