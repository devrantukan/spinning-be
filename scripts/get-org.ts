const { PrismaClient: LocalPrismaClient } = require('@prisma/client')
const localPrisma = new LocalPrismaClient()

async function main() {
  const org = await localPrisma.organization.findFirst()
  console.log(JSON.stringify(org))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await localPrisma.$disconnect())

export {}
