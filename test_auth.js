const { PrismaClient } = require('./src/generated/client5');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function checkAuth() {
  const email = 'admin@fourpoints.com';
  const pass = 'password123';
  
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      console.log('❌ USER NOT FOUND in database!');
      return;
    }
    
    console.log('✅ User found:', user.email, 'with role:', user.role);
    
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (isMatch) {
      console.log('✅ Password matches! Authentication is working correctly at database level.');
    } else {
      console.log('❌ Password DOES NOT match! Hash in DB:', user.passwordHash);
    }
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAuth();
