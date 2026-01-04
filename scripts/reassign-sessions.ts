
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const sourceEmail = "devrantukan+ins2@gmail.com";
  const targetEmail = "gizem@spin8studio.com";

  console.log(`Finding source instructor: ${sourceEmail}`);
  const sourceUser = await prisma.user.findFirst({
    where: { email: sourceEmail },
    include: { instructor: true },
  });

  if (!sourceUser) {
    console.error(`Source user not found: ${sourceEmail}`);
    process.exit(1);
  }

  if (!sourceUser.instructor) {
    console.error(`Source user is not an instructor: ${sourceEmail}`);
    process.exit(1);
  }

  console.log(`Finding target instructor: ${targetEmail}`);
  const targetUser = await prisma.user.findFirst({
    where: { email: targetEmail },
    include: { instructor: true },
  });

  if (!targetUser) {
    console.error(`Target user not found: ${targetEmail}`);
    process.exit(1);
  }

  if (!targetUser.instructor) {
    console.error(`Target user is not an instructor: ${targetEmail}`);
    process.exit(1);
  }

  console.log(
    `Reassigning sessions from ${sourceUser.name} (${sourceUser.instructor.id}) to ${targetUser.name} (${targetUser.instructor.id})`
  );

  const result = await prisma.session.updateMany({
    where: {
      instructorId: sourceUser.instructor.id,
    },
    data: {
      instructorId: targetUser.instructor.id,
    },
  });

  console.log(`Successfully updated ${result.count} sessions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
