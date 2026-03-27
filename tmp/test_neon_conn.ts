import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_bACdu2wS0UTO@ep-lucky-dust-am10acgf-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&connect_timeout=15&sslmode=require"
    }
  }
})

async function test() {
  try {
    console.log('Testing connection...')
    const result = await prisma.$queryRaw`SELECT 1`
    console.log('Connection successful:', result)
  } catch (err) {
    console.error('Connection failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()
