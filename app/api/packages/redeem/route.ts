import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// POST /api/packages/redeem - Redeem a package (direct or with coupon)
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json();
      const { memberId, packageId, couponCode, couponId, notes } = body;

      if (!memberId) {
        return NextResponse.json(
          { error: "Member ID is required" },
          { status: 400 }
        );
      }

      // Verify member exists and belongs to organization
      const member = await prisma.member.findFirst({
        where: {
          id: memberId,
          organizationId: context.organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              supabaseUserId: true,
            },
          },
        },
      });

      if (!member) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }

      // Check permissions:
      // - Admins/Tenant Admins can redeem for any member
      // - Regular members can only redeem for themselves
      const isAdmin =
        context.user.role === "ADMIN" || context.user.role === "TENANT_ADMIN";
      const isRedeemingForSelf =
        member.user?.supabaseUserId === context.user.supabaseUserId;

      if (!isAdmin && !isRedeemingForSelf) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You can only redeem packages for yourself. Admins can redeem for any member.",
          },
          { status: 403 }
        );
      }

      let packageData = null;
      let coupon = null;
      let redemptionType:
        | "PACKAGE_DIRECT"
        | "COUPON_PACKAGE"
        | "COUPON_DISCOUNT" = "PACKAGE_DIRECT";

      // Get package
      if (packageId) {
        packageData = await prisma.package.findFirst({
          where: {
            id: packageId,
            organizationId: context.organizationId,
            isActive: true,
          },
        });

        if (!packageData) {
          return NextResponse.json(
            { error: "Package not found or inactive" },
            { status: 404 }
          );
        }
      }

      // Get coupon if provided
      if (couponCode || couponId) {
        coupon = await prisma.coupon.findFirst({
          where: {
            ...(couponCode ? { code: couponCode } : { id: couponId }),
            organizationId: context.organizationId,
            isActive: true,
          },
          include: {
            package: true,
          },
        });

        if (!coupon) {
          return NextResponse.json(
            { error: "Coupon not found or inactive" },
            { status: 404 }
          );
        }

        // Validate coupon
        const now = new Date();
        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
          return NextResponse.json(
            { error: "Coupon not yet valid" },
            { status: 400 }
          );
        }
        if (coupon.validUntil && new Date(coupon.validUntil) < now) {
          return NextResponse.json(
            { error: "Coupon has expired" },
            { status: 400 }
          );
        }

        // Check redemption limits (only count ACTIVE redemptions)
        if (coupon.maxRedemptions) {
          const redemptionCount = await prisma.packageRedemption.count({
            where: {
              couponId: coupon.id,
              status: "ACTIVE",
            },
          });

          if (redemptionCount >= coupon.maxRedemptions) {
            return NextResponse.json(
              { error: "Coupon redemption limit reached" },
              { status: 400 }
            );
          }
        }

        // Check per-member redemption limit (only count ACTIVE redemptions)
        const memberRedemptionCount = await prisma.packageRedemption.count({
          where: {
            memberId,
            couponId: coupon.id,
            status: "ACTIVE",
          },
        });

        if (memberRedemptionCount >= coupon.maxRedemptionsPerMember) {
          return NextResponse.json(
            {
              error:
                "You have already used this coupon the maximum number of times",
            },
            { status: 400 }
          );
        }

        // If coupon has a package, use that
        if (coupon.packageId && coupon.couponType === "PACKAGE") {
          packageData = await prisma.package.findFirst({
            where: {
              id: coupon.packageId,
              organizationId: context.organizationId,
            },
          });
          redemptionType = "COUPON_PACKAGE";
        } else if (coupon.couponType === "DISCOUNT") {
          redemptionType = "COUPON_DISCOUNT";
        }
      }

      if (!packageData) {
        return NextResponse.json(
          { error: "Package is required" },
          { status: 400 }
        );
      }

      // Calculate pricing
      let originalPrice = packageData.price;
      let discountAmount = 0;
      let finalPrice = packageData.price;

      if (coupon && coupon.couponType === "DISCOUNT") {
        if (coupon.discountType === "PERCENTAGE" && coupon.discountValue) {
          discountAmount = (originalPrice * coupon.discountValue) / 100;
        } else if (
          coupon.discountType === "FIXED_AMOUNT" &&
          coupon.discountValue
        ) {
          discountAmount = coupon.discountValue;
        }
        finalPrice = Math.max(0, originalPrice - discountAmount);
      } else if (
        coupon &&
        coupon.couponType === "PACKAGE" &&
        coupon.customPrice
      ) {
        originalPrice = packageData.price;
        discountAmount = originalPrice - coupon.customPrice;
        finalPrice = coupon.customPrice;
      }

      // Determine credits to add
      let creditsToAdd = 0;
      if (packageData.type !== "ALL_ACCESS") {
        if (coupon?.customCredits) {
          creditsToAdd = coupon.customCredits;
        } else {
          creditsToAdd = packageData.credits || 0;
        }
      }

      // Calculate All Access expiration
      let allAccessExpiresAt: Date | null = null;
      let allAccessDays: number | null = null;
      if (packageData.type === "ALL_ACCESS") {
        allAccessDays = 30; // Default 30 days
        allAccessExpiresAt = new Date();
        allAccessExpiresAt.setDate(
          allAccessExpiresAt.getDate() + allAccessDays
        );
        allAccessExpiresAt.setHours(23, 59, 59, 999);
      }

      // Calculate friend pass expiration (for Elite 30)
      let friendPassAvailable = false;
      let friendPassExpiresAt: Date | null = null;
      if (
        packageData.type === "ELITE_30" &&
        packageData.benefits &&
        Array.isArray(packageData.benefits) &&
        packageData.benefits.includes("friend_pass")
      ) {
        friendPassAvailable = true;
        friendPassExpiresAt = new Date();
        friendPassExpiresAt.setDate(friendPassExpiresAt.getDate() + 30);
        friendPassExpiresAt.setHours(23, 59, 59, 999);
      }

      // Create redemption with PENDING status
      // Credit balance and transactions will be created only when admin approves
      const redemption = await prisma.packageRedemption.create({
        data: {
          memberId,
          organizationId: context.organizationId,
          packageId: packageData.id,
          couponId: coupon?.id || null,
          redemptionType,
          redeemedBy: context.user.id,
          originalPrice,
          discountAmount,
          finalPrice,
          creditsAdded: creditsToAdd > 0 ? creditsToAdd : null,
          allAccessExpiresAt,
          allAccessDays,
          friendPassAvailable,
          friendPassExpiresAt,
          notes: notes || null,
          // Status defaults to PENDING in schema, but explicitly set it here
        },
      });

      // Fetch redemption with relations
      const redemptionWithRelations = await prisma.packageRedemption.findUnique(
        {
          where: { id: redemption.id },
          include: {
            package: true,
            coupon: true,
            member: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        }
      );

      return NextResponse.json(redemptionWithRelations, { status: 201 });
    } catch (error: any) {
      console.error("Error redeeming package:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}
