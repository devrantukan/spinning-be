# Package System Implementation - Main Backend

## ✅ Completed Changes

### 1. Database Schema (`prisma/schema.prisma`)

Added the following models:

- ✅ **Package** - Standard packages with fixed pricing
- ✅ **Coupon** - Flexible promotional codes
- ✅ **PackageRedemption** - Unified redemption tracking
- ✅ **AllAccessDailyUsage** - Daily usage tracking for All Access

Updated existing models:

- ✅ **Booking** - Added package-related fields (paymentType, packageRedemptionId, etc.)
- ✅ **Member** - Added quick reference fields (isEliteMember, hasAllAccess, allAccessExpiresAt)
- ✅ **Organization** - Added relations to new models

### 2. API Endpoints Created

#### Packages

- ✅ `GET /api/packages` - List all packages (with calculated pricing)
- ✅ `POST /api/packages` - Create package
- ✅ `GET /api/packages/[id]` - Get package
- ✅ `PATCH /api/packages/[id]` - Update package
- ✅ `DELETE /api/packages/[id]` - Delete package

#### Coupons

- ✅ `GET /api/coupons` - List all coupons
- ✅ `POST /api/coupons` - Create coupon
- ✅ `GET /api/coupons/[id]` - Get coupon
- ✅ `GET /api/coupons/code/[code]` - Get coupon by code
- ✅ `PATCH /api/coupons/[id]` - Update coupon
- ✅ `DELETE /api/coupons/[id]` - Delete coupon

#### Redemptions

- ✅ `POST /api/packages/redeem` - Redeem package (with coupon support)
- ✅ `GET /api/redemptions` - List all redemptions
- ✅ `GET /api/redemptions/[id]` - Get redemption
- ✅ `GET /api/redemptions/[id]/all-access-usage` - Get All Access daily usage
- ✅ `GET /api/members/[id]/redemptions` - Get member's redemptions

## 📋 Next Steps

### 1. Run Database Migration

```bash
cd spinning-be
npx prisma migrate dev --name add_package_system
npx prisma generate
```

### 2. Seed Initial Packages

Run the seed data from `MAIN_BACKEND_SEED_DATA.sql` (in tenant backend repo) or create a seed script.

### 3. Update Booking Creation Logic

The booking creation endpoint (`app/api/bookings/route.ts`) needs to be updated to:

- Check for All Access availability
- Check for sufficient credits
- Check for friend pass availability
- Create AllAccessDailyUsage records
- Update redemption status

### 4. Add Background Jobs (Optional)

Consider adding background jobs to:

- Expire All Access packages
- Expire friend passes
- Update member flags (isEliteMember, hasAllAccess)

## 🔧 Integration Points

### Booking Creation Flow

When creating a booking, the system should:

1. **Check payment methods** (in order of priority):

   - Active All Access (not expired, not used today)
   - Sufficient credits
   - Available friend pass

2. **Determine payment type**:

   - `ALL_ACCESS` - If All Access is used
   - `CREDIT` - If credits are used
   - `FRIEND_PASS` - If friend pass is used
   - `FREE` - For special cases

3. **Create booking with payment info**:

   - Set `paymentType`
   - Link to `packageRedemptionId` if applicable
   - Set `creditsUsed` if credits were deducted
   - Link to `allAccessDailyUsageId` if All Access was used

4. **Update member/redemption**:
   - Deduct credits (if used)
   - Create AllAccessDailyUsage record (if All Access used)
   - Mark friend pass as used (if friend pass used)

## 📝 Example Booking Creation Update

```typescript
// In app/api/bookings/route.ts POST handler

// After verifying session and member...

// Check payment methods
const member = await prisma.member.findFirst({
  where: { id: member.id },
  include: {
    packageRedemptions: {
      where: {
        status: "ACTIVE",
        OR: [
          { allAccessExpiresAt: { gte: new Date() } },
          { creditsAdded: { gt: 0 } },
          { friendPassAvailable: true, friendPassUsed: false },
        ],
      },
    },
  },
});

// Determine payment method
let paymentType = "CREDIT";
let packageRedemptionId = null;
let creditsUsed = seat?.creditCost || 1;
let allAccessDailyUsageId = null;

// Check All Access first
const activeAllAccess = member.packageRedemptions.find(
  (r) => r.allAccessExpiresAt && new Date(r.allAccessExpiresAt) >= new Date()
);

if (activeAllAccess) {
  // Check if already used today
  const today = new Date().toISOString().split("T")[0];
  const usedToday = await prisma.allAccessDailyUsage.findFirst({
    where: {
      packageRedemptionId: activeAllAccess.id,
      usageDate: new Date(today),
      wasNoShow: false,
    },
  });

  if (!usedToday) {
    paymentType = "ALL_ACCESS";
    packageRedemptionId = activeAllAccess.id;
    creditsUsed = null;

    // Create daily usage record
    const dailyUsage = await prisma.allAccessDailyUsage.create({
      data: {
        packageRedemptionId: activeAllAccess.id,
        memberId: member.id,
        usageDate: new Date(today),
      },
    });
    allAccessDailyUsageId = dailyUsage.id;
  }
}

// If not All Access, check credits
if (paymentType === "CREDIT") {
  if (member.creditBalance < creditsUsed) {
    return NextResponse.json(
      { error: "Insufficient credits" },
      { status: 400 }
    );
  }

  // Deduct credits
  await prisma.member.update({
    where: { id: member.id },
    data: {
      creditBalance: {
        decrement: creditsUsed,
      },
    },
  });

  // Create credit transaction
  await prisma.creditTransaction.create({
    data: {
      memberId: member.id,
      organizationId: context.organizationId,
      amount: -creditsUsed,
      balanceBefore: member.creditBalance,
      balanceAfter: member.creditBalance - creditsUsed,
      type: "BOOKING_PAYMENT",
      description: `Booking for session`,
    },
  });
}

// Create booking with payment info
const booking = await prisma.booking.create({
  data: {
    sessionId,
    memberId: member.id,
    userId: context.user.id,
    organizationId: context.organizationId,
    seatId: seatId || null,
    creditCost: seat?.creditCost || 1,
    paymentType,
    packageRedemptionId,
    creditsUsed,
    allAccessDailyUsageId,
    status: "CONFIRMED",
  },
});
```

## 🎯 Testing Checklist

- [ ] Create packages via API
- [ ] Create coupons via API
- [ ] Redeem package directly
- [ ] Redeem package with coupon
- [ ] Verify credits are added correctly
- [ ] Verify All Access expiration is set
- [ ] Verify friend pass is granted for Elite 30
- [ ] Test booking with All Access
- [ ] Test booking with credits
- [ ] Test All Access daily limit (max 1/day)
- [ ] Test friend pass usage
- [ ] Test no-show handling for All Access

## 📚 Related Files

- Tenant Backend: `/Users/devrantukan/Sites/spinning-tenant-be/`
- Package System Docs: `PACKAGE_SYSTEM.md`
- Seed Data: `MAIN_BACKEND_SEED_DATA.sql`



