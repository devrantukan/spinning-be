const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst()
  console.log(JSON.stringify(org))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
