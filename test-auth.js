const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function test() {
  const email = 'admin@fourpoints.com'
  const pass = 'password123'
  
  console.log(`Checking user: ${email}`)
  const user = await prisma.user.findUnique({ where: { email } })
  
  if (!user) {
    console.log('❌ User not found in DB')
    return
  }
  
  console.log('✅ User found')
  console.log(`Stored Hash: ${user.passwordHash}`)
  
  const match = await bcrypt.compare(pass, user.passwordHash)
  if (match) {
    console.log('✅ Password MATCHES')
  } else {
    console.log('❌ Password DOES NOT MATCH')
    
    const newHash = await bcrypt.hash(pass, 10)
    console.log(`Expected Hash (if hashed now): ${newHash}`)
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
