// Simple script to test database connection
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('Testing database connection...')
    await prisma.$connect()
    console.log('✅ Successfully connected to database!')
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database query successful:', result)
    
    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.error('\nPossible issues:')
    console.error('1. Supabase project might be paused - check dashboard and restore it')
    console.error('2. Connection string might be incorrect - verify in Supabase Dashboard → Settings → Database')
    console.error('3. Network/firewall might be blocking the connection')
    await prisma.$disconnect()
    process.exit(1)
  }
}

testConnection()










