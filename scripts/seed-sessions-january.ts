import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Schedule configuration
interface SessionSchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  time: string; // "HH:mm" format
  duration: number; // minutes
  className: string; // English class name to match
  classNameTr?: string; // Turkish class name (optional, for reference)
}

const schedule: SessionSchedule[] = [
  // SALI (Tuesday) - "Ritmin yolculuğu"
  {
    dayOfWeek: 2, // Tuesday
    time: "08:30",
    duration: 50,
    className: "Wake & Ride",
    classNameTr: "Uyan ve Pedalla",
  },
  {
    dayOfWeek: 2,
    time: "14:30",
    duration: 50,
    className: "Wellness Clubbing Mode / Rhythm Therapy",
    classNameTr: "Wellness Clubbing Mode / Ritm Terapisi",
  },
  {
    dayOfWeek: 2,
    time: "18:00",
    duration: 50,
    className: "SunSet Pulse",
    classNameTr: "Geceye Sürüş",
  },

  // ÇARŞAMBA (Wednesday) - "Hareketle Dengelen / Balance In Motion"
  {
    dayOfWeek: 3, // Wednesday
    time: "11:30",
    duration: 50,
    className: "Sunrise Flow",
    classNameTr: "Sabah Enerjisi",
  },
  {
    dayOfWeek: 3,
    time: "14:30",
    duration: 50,
    className: "Fire Pulse",
    classNameTr: "Enerji Sürüşü",
  },
  {
    dayOfWeek: 3,
    time: "18:00",
    duration: 50,
    className: "Sunset Beats Ride",
    classNameTr: "Gün Batımı Ritmi",
  },

  // PERŞEMBE (Thursday) - "Haftasonuna Doğru Pedalla / Almost The Weekend"
  {
    dayOfWeek: 4, // Thursday
    time: "08:30",
    duration: 50,
    className: "Warm up with Waves",
    classNameTr: "Dalgalarla Isın",
  },
  {
    dayOfWeek: 4,
    time: "14:30",
    duration: 50,
    className: "Queen Energy",
    classNameTr: "Kraliçe Enerjisi",
  },
  {
    dayOfWeek: 4,
    time: "18:00",
    duration: 50,
    className: "Moonlight Ride",
    classNameTr: "Ayışığına Doğru",
  },

  // CUMA (Friday) - "Oh be …Cuma / TGIF Ride"
  {
    dayOfWeek: 5, // Friday
    time: "11:30",
    duration: 50,
    className: "Fresh Friday Ride",
    classNameTr: "Rahatla ve Pedalla",
  },
  {
    dayOfWeek: 5,
    time: "14:30",
    duration: 50,
    className: "Midday Beats",
    classNameTr: "Öğle Enerjisi",
  },
  {
    dayOfWeek: 5,
    time: "18:00",
    duration: 50,
    className: "After Work Rhythm",
    classNameTr: "Mesai Sonu Ritmi",
  },

  // CUMARTESİ (Saturday) - "Samos Manzarasına Pedalla / Ride With Samos View"
  {
    dayOfWeek: 6, // Saturday
    time: "11:30",
    duration: 50,
    className: "PreParty WarmUp",
    classNameTr: "Cumartesi Enerji Dalgası",
  },
  {
    dayOfWeek: 6,
    time: "14:30",
    duration: 50,
    className: "MainStage Ride",
    classNameTr: "Ana Sahne Sürüşü",
  },
  {
    dayOfWeek: 6,
    time: "18:00",
    duration: 50,
    className: "After party Flow",
    classNameTr: "Gecenin akışına Pedalla",
  },

  // PAZAR (Sunday) - "Tembellik Yok Gel ve Pedalla / It's Sunday Get Up and Ride"
  {
    dayOfWeek: 0, // Sunday
    time: "12:30",
    duration: 50,
    className: "SunDay FunDay",
    classNameTr: "Pazar Tadında",
  },
  {
    dayOfWeek: 0,
    time: "16:30",
    duration: 50,
    className: "Ride In To Week",
    classNameTr: "Yeni Haftaya Enerjiyle",
  },
];

async function main() {
  console.log("🌱 Starting January sessions seed...");

  // Get organization ID from environment variable or use first organization
  const orgIdFromEnv = process.env.TENANT_ORGANIZATION_ID;

  let org;
  if (orgIdFromEnv) {
    org = await prisma.organization.findUnique({
      where: { id: orgIdFromEnv },
    });
    if (!org) {
      console.error(`❌ Organization with ID ${orgIdFromEnv} not found.`);
      process.exit(1);
    }
  } else {
    const organizations = await prisma.organization.findMany({ take: 1 });
    if (organizations.length === 0) {
      console.error(
        "❌ No organizations found. Please create an organization first."
      );
      process.exit(1);
    }
    org = organizations[0];
  }

  console.log(`📚 Seeding sessions for organization: ${org.name} (${org.id})`);

  // Get all classes for this organization
  const classes = await prisma.class.findMany({
    where: { organizationId: org.id, status: "ACTIVE" },
  });

  if (classes.length === 0) {
    console.error(
      "❌ No classes found. Please run seed-classes.ts first to create classes."
    );
    process.exit(1);
  }

  console.log(`📋 Found ${classes.length} classes`);

  // Get first available instructor
  const instructor = await prisma.instructor.findFirst({
    where: {
      organizationId: org.id,
      status: "ACTIVE",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!instructor) {
    console.error(
      "❌ No active instructor found. Please create an instructor first."
    );
    process.exit(1);
  }

  console.log(
    `👤 Using instructor: ${instructor.user.name || instructor.user.email}`
  );

  // Get first available location (optional)
  const location = await prisma.location.findFirst({
    where: {
      organizationId: org.id,
    },
    include: {
      seatLayouts: {
        where: {
          isActive: true,
        },
        include: {
          seats: {
            where: {
              isActive: true,
            },
          },
        },
        take: 1, // Get first active seat layout
      },
    },
  });

  let maxCapacity = 10; // Default capacity

  if (location) {
    console.log(`📍 Using location: ${location.name}`);
    // Calculate maxCapacity from seat layout if available
    if (
      location.seatLayouts.length > 0 &&
      location.seatLayouts[0].seats.length > 0
    ) {
      maxCapacity = location.seatLayouts[0].seats.length;
      console.log(
        `   📊 Max capacity calculated from seat layout: ${maxCapacity}`
      );
    } else {
      console.log(
        `   ⚠️  No active seat layout found, using default capacity: ${maxCapacity}`
      );
    }
  } else {
    console.log(
      `📍 No location found - sessions will be created without location`
    );
    console.log(`   📊 Using default capacity: ${maxCapacity}`);
  }

  // Configuration
  const year = 2026;
  const month = 1; // January

  // Find all dates in January that match the schedule days
  const sessionsToCreate: {
    classId: string;
    className: string;
    startTime: Date;
    endTime: Date;
  }[] = [];

  // Iterate through all days in January
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of January

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dayOfWeek = date.getDay();

    // Find schedule items for this day of week
    const daySchedule = schedule.filter((s) => s.dayOfWeek === dayOfWeek);

    for (const scheduleItem of daySchedule) {
      // Find matching class (try exact match first, then partial)
      const matchingClass = classes.find(
        (c) =>
          c.name === scheduleItem.className ||
          c.nameTr === scheduleItem.classNameTr ||
          c.name.includes(scheduleItem.className) ||
          scheduleItem.className.includes(c.name)
      );

      if (!matchingClass) {
        console.warn(
          `⚠️  Class not found for: ${scheduleItem.className} (${scheduleItem.classNameTr}) - Skipping`
        );
        continue;
      }

      // Parse time (HH:mm format)
      const [hours, minutes] = scheduleItem.time.split(":").map(Number);

      // Create start time
      const startTime = new Date(date);
      startTime.setHours(hours, minutes, 0, 0);

      // Create end time (start + duration)
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + scheduleItem.duration);

      sessionsToCreate.push({
        classId: matchingClass.id,
        className: matchingClass.name,
        startTime,
        endTime,
      });
    }
  }

  console.log(
    `\n📝 Creating ${sessionsToCreate.length} sessions for January ${year}...`
  );

  // Check if sessions already exist for January
  const existingSessions = await prisma.session.findMany({
    where: {
      organizationId: org.id,
      startTime: {
        gte: startDate,
        lt: new Date(year, month, 1), // First day of February
      },
    },
  });

  if (existingSessions.length > 0) {
    console.log(
      `⚠️  Found ${existingSessions.length} existing sessions for January.`
    );
    console.log("   Deleting existing January sessions to re-seed...");
    await prisma.session.deleteMany({
      where: {
        organizationId: org.id,
        startTime: {
          gte: startDate,
          lt: new Date(year, month, 1),
        },
      },
    });
    console.log("   ✅ Existing sessions deleted.");
  }

  // Create sessions
  let createdCount = 0;
  let skippedCount = 0;

  for (const sessionData of sessionsToCreate) {
    try {
      // Calculate duration and AM/PM
      const durationMinutes = Math.round(
        (sessionData.endTime.getTime() - sessionData.startTime.getTime()) /
          (1000 * 60)
      );
      const startHour = sessionData.startTime.getHours();
      const amPm = startHour < 12 ? "AM" : "PM";

      await prisma.session.create({
        data: {
          classId: sessionData.classId,
          organizationId: org.id,
          instructorId: instructor.id,
          locationId: location?.id || null,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          duration: durationMinutes,
          amPm: amPm,
          maxCapacity: maxCapacity,
          currentBookings: 0,
          status: "SCHEDULED",
        },
      });

      createdCount++;
      const dateStr = sessionData.startTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      console.log(`   ✅ ${dateStr} - ${sessionData.className}`);
    } catch (error: any) {
      skippedCount++;
      console.error(
        `   ❌ Failed to create session for ${sessionData.className}:`,
        error.message
      );
    }
  }

  console.log(`\n🎉 Successfully created ${createdCount} sessions!`);
  if (skippedCount > 0) {
    console.log(`⚠️  Skipped ${skippedCount} sessions due to errors.`);
  }
  console.log(
    `\n💡 Note: Make sure to verify instructor assignments and adjust maxCapacity as needed.`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error seeding sessions:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
