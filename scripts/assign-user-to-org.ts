import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignUserToOrg() {
  const email = process.argv[2] || process.env.USER_EMAIL
  const organizationId = process.argv[3] || process.env.ORGANIZATION_ID

  if (!email || !organizationId) {
    console.error('Usage: npx tsx scripts/assign-user-to-org.ts <email> <organizationId>')
    console.error('Or set USER_EMAIL and ORGANIZATION_ID environment variables')
    console.error('Example: npx tsx scripts/assign-user-to-org.ts user@example.com b25567c3-b100-4ef3-b6b7-d4b43091424d')
    process.exit(1)
  }

  try {
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!organization) {
      console.error(`❌ Organization with ID ${organizationId} not found`)
      process.exit(1)
    }

    console.log(`✅ Found organization: ${organization.name} (${organization.slug})`)

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
      include: { organization: true }
    })

    if (!user) {
      console.error(`❌ User with email ${email} not found`)
      console.error('💡 Make sure the user has logged in at least once to be created in the database')
      process.exit(1)
    }

    if (user.organizationId === organizationId) {
      console.log(`✅ User ${email} is already associated with organization ${organization.name}`)
      console.log(`   Current organization: ${user.organization.name} (${user.organization.slug})`)
      process.exit(0)
    }

    console.log(`📋 Current organization: ${user.organization.name} (${user.organization.id})`)
    console.log(`🔄 Moving to organization: ${organization.name} (${organization.id})`)

    // Update user's organization
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { organizationId },
      include: { organization: true }
    })

    console.log(`✅ Successfully assigned ${email} to organization ${organization.name}`)
    console.log(`   User ID: ${updated.id}`)
    console.log(`   Organization ID: ${updated.organizationId}`)
    console.log(`   Organization: ${updated.organization.name} (${updated.organization.slug})`)
    console.log(`   Role: ${updated.role}`)
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.code === 'P2003') {
      console.error('   This usually means the organization ID is invalid')
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

assignUserToOrg()





