import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting package seed...");

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
  console.log(`📦 Seeding packages for organization: ${org.name} (${org.id})`);

  // Get organization credit price for calculations
  const creditPrice = org.creditPrice || 1500; // Default to 1500 TL if not set
  console.log(`💰 Using credit price: ${creditPrice} TL`);

  // Check if packages already exist for this organization
  const existingPackages = await prisma.package.findMany({
    where: { organizationId: org.id },
  });

  if (existingPackages.length > 0) {
    console.log(
      `⚠️  Found ${existingPackages.length} existing packages for this organization.`
    );
    console.log("   Deleting existing packages to re-seed...");
    // Delete packages for this organization
    await prisma.package.deleteMany({
      where: { organizationId: org.id },
    });
    console.log("   ✅ Deleted existing packages.");
  }

  // Also delete any packages with the same codes (due to unique constraint)
  const packageCodes = [
    "SINGLE-RIDE",
    "EXPLORER-5",
    "CORE-10",
    "ELITE-20",
    "ELITE-30",
    "ALL-ACCESS-30",
  ];
  const existingByCode = await prisma.package.findMany({
    where: { code: { in: packageCodes } },
  });
  if (existingByCode.length > 0) {
    console.log(
      `⚠️  Found ${existingByCode.length} packages with conflicting codes. Deleting...`
    );
    await prisma.package.deleteMany({
      where: { code: { in: packageCodes } },
    });
    console.log("   ✅ Deleted conflicting packages.");
  }

  // 1. Single Ride
  const singleRide = await prisma.package.create({
    data: {
      organizationId: org.id,
      code: "SINGLE-RIDE",
      name: "Single Ride",
      nameTr: "Tek Sürüş",
      type: "SINGLE_RIDE",
      price: 1500.0,
      credits: 1,
      pricePerCredit: 1500.0,
      basePrice: creditPrice * 1,
      discountAmount: creditPrice * 1 - 1500.0,
      discountPercentage: 0,
      description: "One ride credit",
      descriptionTr: "Bir sürüş kredisi",
      isActive: true,
      displayOrder: 1,
    },
  });
  console.log(`✅ Created: ${singleRide.name}`);

  // 2. Explorer Pack (5 rides)
  const explorerPack = await prisma.package.create({
    data: {
      organizationId: org.id,
      code: "EXPLORER-5",
      name: "Explorer Pack",
      nameTr: "Explorer Paket",
      type: "CREDIT_PACK",
      price: 5000.0,
      credits: 5,
      pricePerCredit: 1000.0,
      basePrice: creditPrice * 5,
      discountAmount: creditPrice * 5 - 5000.0,
      discountPercentage:
        creditPrice * 5 > 0
          ? ((creditPrice * 5 - 5000.0) / (creditPrice * 5)) * 100
          : 0,
      description: "5 rides - Save 2,500 TL",
      descriptionTr: "5 sürüş - 2,500 TL tasarruf",
      isActive: true,
      displayOrder: 2,
    },
  });
  console.log(`✅ Created: ${explorerPack.name}`);

  // 3. Core Pack (10 rides)
  const corePack = await prisma.package.create({
    data: {
      organizationId: org.id,
      code: "CORE-10",
      name: "Core Pack",
      nameTr: "Core Paket",
      type: "CREDIT_PACK",
      price: 8000.0,
      credits: 10,
      pricePerCredit: 800.0,
      basePrice: creditPrice * 10,
      discountAmount: creditPrice * 10 - 8000.0,
      discountPercentage:
        creditPrice * 10 > 0
          ? ((creditPrice * 10 - 8000.0) / (creditPrice * 10)) * 100
          : 0,
      description: "10 rides - Save 7,000 TL",
      descriptionTr: "10 sürüş - 7,000 TL tasarruf",
      isActive: true,
      displayOrder: 3,
    },
  });
  console.log(`✅ Created: ${corePack.name}`);

  // 4. Elite Pack (20 rides)
  const elitePack = await prisma.package.create({
    data: {
      organizationId: org.id,
      code: "ELITE-20",
      name: "Elite Pack",
      nameTr: "Elite Paket",
      type: "CREDIT_PACK",
      price: 14000.0,
      credits: 20,
      pricePerCredit: 700.0,
      basePrice: creditPrice * 20,
      discountAmount: creditPrice * 20 - 14000.0,
      discountPercentage:
        creditPrice * 20 > 0
          ? ((creditPrice * 20 - 14000.0) / (creditPrice * 20)) * 100
          : 0,
      description: "20 rides - Save 16,000 TL",
      descriptionTr: "20 sürüş - 16,000 TL tasarruf",
      isActive: true,
      displayOrder: 4,
    },
  });
  console.log(`✅ Created: ${elitePack.name}`);

  // 5. Elite 30 - Signature Pack
  const elite30 = await prisma.package.create({
    data: {
      organizationId: org.id,
      code: "ELITE-30",
      name: "Elite 30 - Signature Pack",
      nameTr: "Elite 30 - Signature Paket",
      type: "ELITE_30",
      price: 18000.0,
      credits: 30,
      pricePerCredit: 600.0,
      basePrice: creditPrice * 30,
      discountAmount: creditPrice * 30 - 18000.0,
      discountPercentage:
        creditPrice * 30 > 0
          ? ((creditPrice * 30 - 18000.0) / (creditPrice * 30)) * 100
          : 0,
      description: "30 rides + friend pass + priority booking",
      descriptionTr: "30 sürüş + arkadaş hakkı + öncelikli rezervasyon",
      benefits: ["friend_pass", "priority_booking", "elite_badge"],
      isActive: true,
      displayOrder: 5,
    },
  });
  console.log(`✅ Created: ${elite30.name}`);

  // 6. All Access - 30 Days
  const allAccess = await prisma.package.create({
    data: {
      organizationId: org.id,
      code: "ALL-ACCESS-30",
      name: "All Access - 30 Days",
      nameTr: "All Access - 30 Gün",
      type: "ALL_ACCESS",
      price: 21000.0,
      credits: null,
      pricePerCredit: null,
      basePrice: null,
      discountAmount: null,
      discountPercentage: null,
      description:
        "Unlimited rides for 30 days, max 1 per day. Requires reservation. No-show burns the day.",
      descriptionTr:
        "30 gün boyunca sınırsız sürüş, günde maksimum 1. Rezervasyon gerekli. No-show yanar.",
      isActive: true,
      displayOrder: 6,
    },
  });
  console.log(`✅ Created: ${allAccess.name}`);

  // Create example coupons
  console.log("\n🎫 Creating example coupons...");

  // Delete existing coupons with the same codes
  const couponCodes = ["SUMMER2024", "NEWMEMBER2024"];
  const existingCoupons = await prisma.coupon.findMany({
    where: { code: { in: couponCodes } },
  });
  if (existingCoupons.length > 0) {
    console.log(
      `⚠️  Found ${existingCoupons.length} coupons with conflicting codes. Deleting...`
    );
    await prisma.coupon.deleteMany({
      where: { code: { in: couponCodes } },
    });
    console.log("   ✅ Deleted conflicting coupons.");
  }

  // Summer Discount Coupon
  const summerCoupon = await prisma.coupon.create({
    data: {
      organizationId: org.id,
      code: "SUMMER2024",
      name: "Summer Discount",
      nameTr: "Yaz İndirimi",
      couponType: "DISCOUNT",
      discountType: "PERCENTAGE",
      discountValue: 15.0,
      applicablePackageIds: [
        explorerPack.id,
        corePack.id,
        elitePack.id,
        elite30.id,
      ],
      validFrom: new Date(),
      validUntil: new Date("2024-08-31T23:59:59Z"),
      maxRedemptions: 100,
      maxRedemptionsPerMember: 1,
      isActive: true,
    },
  });
  console.log(`✅ Created coupon: ${summerCoupon.code}`);

  // New Member Bonus Coupon
  const newMemberCoupon = await prisma.coupon.create({
    data: {
      organizationId: org.id,
      code: "NEWMEMBER2024",
      name: "New Member Bonus",
      nameTr: "Yeni Üye Bonusu",
      couponType: "CREDIT_BONUS",
      bonusCredits: 2,
      validFrom: new Date(),
      validUntil: new Date("2024-12-31T23:59:59Z"),
      maxRedemptions: null, // Unlimited
      maxRedemptionsPerMember: 1,
      isActive: true,
    },
  });
  console.log(`✅ Created coupon: ${newMemberCoupon.code}`);

  console.log("\n✨ Seed completed successfully!");
  console.log(`\n📊 Summary:`);
  console.log(`   - Packages created: 6`);
  console.log(`   - Coupons created: 2`);
  console.log(`   - Organization: ${org.name}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding packages:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


