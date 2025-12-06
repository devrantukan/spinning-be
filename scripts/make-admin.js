// Simple Node.js script to make a user admin
// Usage: node scripts/make-admin.js <email>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function makeAdmin() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: node scripts/make-admin.js <email>')
    console.error('Example: node scripts/make-admin.js user@example.com')
    process.exit(1)
  }

  try {
    // Email is not unique, so use findFirst
    const user = await prisma.user.findFirst({
      where: { email }
    })

    if (!user) {
      console.error(`❌ User with email ${email} not found`)
      console.error('💡 Make sure the user has logged in at least once to be created in the database')
      process.exit(1)
    }

    if (user.role === 'ADMIN') {
      console.log(`✅ User ${email} is already an ADMIN`)
      process.exit(0)
    }

    // Use id for update since email is not unique
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' }
    })

    console.log(`✅ Successfully updated ${email} to ADMIN role`)
    console.log(`   User ID: ${updated.id}`)
    console.log(`   Organization: ${updated.organizationId}`)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

makeAdmin()

