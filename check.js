const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function check() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@fourpoints.com' }
    });
    
    if (!user) {
      console.log('USER_NOT_FOUND');
      return;
    }

    const match = await bcrypt.compare('password123', user.passwordHash);
    console.log(JSON.stringify({
      found: true,
      email: user.email,
      match,
      role: user.role,
      employeeId: user.employeeId,
      type: typeof user.employeeId
    }, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
