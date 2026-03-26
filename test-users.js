const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function test() {
  const emails = ['admin@fourpoints.com', 'chidinma@fourpoints.com', 'angela@fourpoints.com']
  const pass = 'password123'
  
  for (const email of emails) {
    console.log(`\nChecking user: ${email}`)
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { employee: true }
    })
    
    if (!user) {
      console.log(`❌ User ${email} not found in DB`)
      continue
    }
    
    console.log(`✅ User found. Role: ${user.role}`)
    const match = await bcrypt.compare(pass, user.passwordHash)
    console.log(`Password Match: ${match ? '✅' : '❌'}`)
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
