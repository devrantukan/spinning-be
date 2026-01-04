const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient()

async function makeTenantAdmin() {
  const email = process.argv[2] || process.env.TENANT_ADMIN_EMAIL

  if (!email) {
    console.error('Usage: npx tsx scripts/make-tenant-admin.ts <email>')
    console.error('Or set TENANT_ADMIN_EMAIL environment variable')
    process.exit(1)
  }

  try {
    // Email is not unique, so use findFirst
    const user = await prisma.user.findFirst({
      where: { email }
    })

    if (!user) {
      console.log(`User with email ${email} not found. Creating new user...`)
      
      // Hardcoded Organization ID for Spin8 Studio from previous lookup
      const spin8OrgId = 'b25567c3-b100-4ef3-b6b7-d4b43091424d';
      const randomSupabaseId = require('crypto').randomUUID();
      
      const newUser = await prisma.user.create({
        data: {
          email,
          role: 'TENANT_ADMIN',
          organizationId: spin8OrgId,
          supabaseUserId: randomSupabaseId,
          // name: 'Tenant Admin', // Optional
        }
      })

      console.log(`✅ Successfully created user ${email} as TENANT_ADMIN`)
      console.log(`User ID: ${newUser.id}`)
      console.log(`Supabase User ID (Randomly Generated): ${newUser.supabaseUserId}`)
      console.log(`Organization ID: ${newUser.organizationId}`)
      process.exit(0)
    }

    if (user.role === 'TENANT_ADMIN') {
      console.log(`User ${email} is already a TENANT_ADMIN`)
      process.exit(0)
    }

    // Use id for update since email is not unique
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'TENANT_ADMIN' }
    })

    console.log(`✅ Successfully updated ${email} to TENANT_ADMIN role`)
    console.log(`User ID: ${updated.id}`)
    console.log(`Organization ID: ${updated.organizationId}`)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

makeTenantAdmin()









