import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function makeAdmin() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL

  if (!email) {
    console.error('Usage: npx tsx scripts/make-admin.ts <email>')
    console.error('Or set ADMIN_EMAIL environment variable')
    process.exit(1)
  }

  try {
    // Email is not unique, so use findFirst
    const user = await prisma.user.findFirst({
      where: { email }
    })

    if (!user) {
      console.error(`User with email ${email} not found`)
      console.error('Make sure the user has logged in at least once to be created in the database')
      process.exit(1)
    }

    if (user.role === 'ADMIN') {
      console.log(`User ${email} is already an ADMIN`)
      process.exit(0)
    }

    // Use id for update since email is not unique
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' }
    })

    console.log(`✅ Successfully updated ${email} to ADMIN role`)
    console.log(`User ID: ${updated.id}`)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

makeAdmin()

