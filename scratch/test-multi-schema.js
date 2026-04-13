
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.employee.count();
    console.log('Employee count:', count);
    
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
    
    process.exit(0);
  } catch (e) {
    console.error('TEST FAILED:', e);
    process.exit(1);
  }
}

main();
