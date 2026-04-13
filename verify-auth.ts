import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function verify() {
  const email = 'admin@fourpoints.com'
  const password = 'password123'

  console.log(`Checking user: ${email}`)
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.error('❌ User not found in database!')
    return
  }

  console.log('✅ User found.')
  console.log('User Role:', user.role)
  console.log('User employeeId:', user.employeeId, `(Type: ${typeof user.employeeId})`)

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (isMatch) {
    console.log('✅ Password matches!')
  } else {
    console.error('❌ Password DOES NOT match!')
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
