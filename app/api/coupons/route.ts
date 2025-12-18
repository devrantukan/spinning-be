import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/coupons - Get all coupons for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const coupons = await prisma.coupon.findMany({
        where: {
          organizationId: context.organizationId,
        },
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// POST /api/coupons - Create a new coupon
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can create coupons
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can create coupons" },
          { status: 403 }
        );
      }

      const body = await req.json();
      const {
        code,
        name,
        nameTr,
        couponType,
        packageId,
        customPrice,
        customCredits,
        discountType,
        discountValue,
        applicablePackageIds,
        bonusCredits,
        validFrom,
        validUntil,
        maxRedemptions,
        maxRedemptionsPerMember = 1,
      } = body;

      if (!code || !name || !couponType) {
        return NextResponse.json(
          { error: "Missing required fields: code, name, couponType" },
          { status: 400 }
        );
      }

      const coupon = await prisma.coupon.create({
        data: {
          organizationId: context.organizationId,
          code,
          name,
          nameTr: nameTr || null,
          couponType,
          packageId: packageId || null,
          customPrice: customPrice || null,
          customCredits: customCredits || null,
          discountType: discountType || null,
          discountValue: discountValue || null,
          applicablePackageIds: applicablePackageIds || [],
          bonusCredits: bonusCredits || null,
          validFrom: validFrom ? new Date(validFrom) : null,
          validUntil: validUntil ? new Date(validUntil) : null,
          maxRedemptions: maxRedemptions || null,
          maxRedemptionsPerMember,
        },
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json(coupon, { status: 201 });
    } catch (error: any) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Coupon code already exists" },
          { status: 400 }
        );
      }
      console.error("Error creating coupon:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}



