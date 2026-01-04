import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ClassData {
  name: string;
  nameTr?: string;
  description: string;
  descriptionTr?: string;
  musicGenre?: string;
  musicGenreTr?: string;
}

const classesData: ClassData[] = [
  // SALI - "Ritmin yolculuğu"
  {
    name: "Wake & Ride",
    nameTr: "Uyan ve Pedalla",
    description: "Journey of Rhythm - Morning energy ride",
    descriptionTr: "Ritmin yolculuğu - Sabah enerji sürüşü",
    musicGenre: "Hard House, Pop, Commercial",
    musicGenreTr: "Hard House, Pop, Commercial",
  },
  {
    name: "Wellness Clubbing Mode / Rhythm Therapy",
    nameTr: "Wellness Clubbing Mode / Ritm Terapisi",
    description: "Journey of Rhythm - Midday wellness session",
    descriptionTr: "Ritmin yolculuğu - Öğle wellness seansı",
    musicGenre: "2000's Turkish Pop Remixes",
    musicGenreTr: "2000'ler Türkçe Pop Remixler",
  },
  {
    name: "SunSet Pulse",
    nameTr: "Geceye Sürüş",
    description: "Journey of Rhythm - Evening sunset ride",
    descriptionTr: "Ritmin yolculuğu - Akşam gün batımı sürüşü",
    musicGenre: "Afro House, Latin House, Reggaeton",
    musicGenreTr: "Afro House, Latin House, Reggaeton",
  },

  // ÇARŞAMBA - "Hareketle Dengelen / Balance In Motion"
  {
    name: "Sunrise Flow",
    nameTr: "Sabah Enerjisi",
    description: "Balance In Motion - Morning flow",
    descriptionTr: "Hareketle Dengelen - Sabah akışı",
    musicGenre: "Peak Techno, Psy Trance, Dubstep",
    musicGenreTr: "Peak Techno, Psy Trance, Dubstep",
  },
  {
    name: "Fire Pulse",
    nameTr: "Enerji Sürüşü",
    description: "Balance In Motion - High energy ride",
    descriptionTr: "Hareketle Dengelen - Yüksek enerji sürüşü",
    musicGenre: "80's 90's Turkish & International",
    musicGenreTr: "80'ler 90'lar Türkçe & Yabancı",
  },
  {
    name: "Sunset Beats Ride",
    nameTr: "Gün Batımı Ritmi",
    description: "Balance In Motion - Sunset beats",
    descriptionTr: "Hareketle Dengelen - Gün batımı ritmi",
    musicGenre: "Afro Turkish, Pop Remixes",
    musicGenreTr: "Afro Türkçe, Pop Remixleri",
  },

  // PERŞEMBE - "Haftasonuna Doğru Pedalla / Almost The Weekend"
  {
    name: "Warm up with Waves",
    nameTr: "Dalgalarla Isın",
    description: "Almost The Weekend - Morning warm up",
    descriptionTr: "Haftasonuna Doğru Pedalla - Sabah ısınma",
    musicGenre: "Techhouse, Disco, Funk & Some Turkish Pop Remixes",
    musicGenreTr: "Techhouse, Disco, Funk & Some Turkish PoP Remixes",
  },
  {
    name: "Queen Energy",
    nameTr: "Kraliçe Enerjisi",
    description: "Almost The Weekend - Women only session",
    descriptionTr: "Haftasonuna Doğru Pedalla - Sadece Kadınlara Özel Seans",
    musicGenre: "80's 90's, 2000's Pop Turkish & International Remixes",
    musicGenreTr: "80'ler 90'lar, 2000'ler Pop Türkçe & Yabancı Remixler",
  },
  {
    name: "Moonlight Ride",
    nameTr: "Ayışığına Doğru",
    description: "Almost The Weekend - Evening moonlight ride",
    descriptionTr: "Haftasonuna Doğru Pedalla - Akşam ayışığı sürüşü",
    musicGenre: "EDM, Trap, D&B, Dubstep",
    musicGenreTr: "EDM, Trap, D&B, Dubstep",
  },

  // CUMA - "Oh be …Cuma / TGIF Ride"
  {
    name: "Fresh Friday Ride",
    nameTr: "Rahatla ve Pedalla",
    description: "TGIF Ride - Morning fresh ride",
    descriptionTr: "Oh be …Cuma - Sabah taze sürüş",
    musicGenre: "Hip-Hop, Rap, R&B, EDM",
    musicGenreTr: "Hip&Hop, Rap, R&B, EDM",
  },
  {
    name: "Midday Beats",
    nameTr: "Öğle Enerjisi",
    description: "TGIF Ride - Midday energy session",
    descriptionTr: "Oh be …Cuma - Öğle enerji seansı",
    musicGenre: "Turkish Pop, Commercial, Disco, House Remixes",
    musicGenreTr: "Türkçe Pop, Commercial, Disco, House Remixleri",
  },
  {
    name: "After Work Rhythm",
    nameTr: "Mesai Sonu Ritmi",
    description: "TGIF Ride - After work ride",
    descriptionTr: "Oh be …Cuma - Mesai sonu sürüşü",
    musicGenre: "Old & New Hardrock, Rock Remixes, EDM, Hard House",
    musicGenreTr: "Eski & Yeni Hardrock, Rock Remixes, EDM, Hard House",
  },

  // CUMARTESİ - "Samos Manzarasına Pedalla / Ride With Samos View"
  {
    name: "PreParty WarmUp",
    nameTr: "Cumartesi Enerji Dalgası",
    description: "Ride With Samos View - Pre-party warm up",
    descriptionTr: "Samos Manzarasına Pedalla - Parti öncesi ısınma",
    musicGenre: "Pop, Hard House, Psy Trance, D&B",
    musicGenreTr: "Pop, Hard House, Psy Trance, D&B",
  },
  {
    name: "MainStage Ride",
    nameTr: "Ana Sahne Sürüşü",
    description: "Ride With Samos View - Main stage energy",
    descriptionTr: "Samos Manzarasına Pedalla - Ana sahne enerjisi",
    musicGenre: "Afro, Hip-Hop, Rap Turkish & International Remixes",
    musicGenreTr: "Afro, Hip&Hop, Rap Türkçe & Yabancı Remixler",
  },
  {
    name: "After party Flow",
    nameTr: "Gecenin akışına Pedalla",
    description: "Ride With Samos View - After party flow",
    descriptionTr: "Samos Manzarasına Pedalla - Gecenin akışına pedalla",
    musicGenre: "Latin House, Reggaeton, Afro Remixes",
    musicGenreTr: "Latin House, Reggaeton, Afro Remixes",
  },

  // PAZAR - "Tembellik Yok Gel ve Pedalla / It's Sunday Get Up and Ride"
  {
    name: "SunDay FunDay",
    nameTr: "Pazar Tadında",
    description: "It's Sunday Get Up and Ride - Sunday fun day",
    descriptionTr: "Tembellik Yok Gel ve Pedalla - Pazar tadında",
    musicGenre: "80's 90's, 2000's Pop Turkish & International Remixes",
    musicGenreTr: "80'ler 90'lar, 2000'ler Pop Türkçe & Yabancı Remixler",
  },
  {
    name: "Ride In To Week",
    nameTr: "Yeni Haftaya Enerjiyle",
    description: "It's Sunday Get Up and Ride - Ride into the week",
    descriptionTr: "Tembellik Yok Gel ve Pedalla - Yeni haftaya enerjiyle",
    musicGenre: "Melodic House, Progressive House, Turkish Pop Remixes",
    musicGenreTr: "Melodic House, Progressive House, Turkish Pop Remixes",
  },
];

async function main() {
  console.log("🌱 Starting classes seed...");

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
    // Fallback to first organization
    const organizations = await prisma.organization.findMany({
      take: 1,
    });

    if (organizations.length === 0) {
      console.error(
        "❌ No organizations found. Please create an organization first."
      );
      process.exit(1);
    }

    org = organizations[0];
  }

  console.log(`📚 Seeding classes for organization: ${org.name} (${org.id})`);

  // Check if classes already exist for this organization
  const existingClasses = await prisma.class.findMany({
    where: { organizationId: org.id },
  });

  if (existingClasses.length > 0) {
    console.log(
      `⚠️  Found ${existingClasses.length} existing classes for this organization.`
    );
    console.log("   Deleting existing classes to re-seed...");
    await prisma.class.deleteMany({
      where: { organizationId: org.id },
    });
    console.log("   ✅ Existing classes deleted.");
  }

  // Create classes
  console.log(`\n📝 Creating ${classesData.length} classes...`);

  const createdClasses = [];
  for (const classData of classesData) {
    const createdClass = await prisma.class.create({
      data: {
        name: classData.name,
        nameTr: classData.nameTr || null,
        description: classData.description || null,
        descriptionTr: classData.descriptionTr || null,
        musicGenre: classData.musicGenre || null,
        musicGenreTr: classData.musicGenreTr || null,
        organizationId: org.id,
        status: "ACTIVE",
      },
    });

    createdClasses.push(createdClass);
    const displayName = classData.nameTr
      ? `${classData.nameTr} / ${classData.name}`
      : classData.name;
    console.log(`   ✅ Created: ${displayName}`);
  }

  console.log(`\n🎉 Successfully seeded ${createdClasses.length} classes!`);
  console.log(
    `\n💡 Note: Music genres are stored in the musicGenre field on classes.`
  );
  console.log(
    `   Sessions will inherit music genre from their associated class.`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error seeding classes:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });







