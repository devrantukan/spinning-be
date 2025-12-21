import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/coupons/code/[code] - Get a coupon by code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { code } = await params;

      const coupon = await prisma.coupon.findFirst({
        where: {
          code,
          organizationId: context.organizationId,
        },
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              price: true,
              credits: true,
            },
          },
        },
      });

      if (!coupon) {
        return NextResponse.json(
          { error: "Coupon not found" },
          { status: 404 }
        );
      }

      // Check if coupon is valid
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
      if (!coupon.isActive) {
        return NextResponse.json(
          { error: "Coupon is not active" },
          { status: 400 }
        );
      }

      return NextResponse.json(coupon);
    } catch (error) {
      console.error("Error fetching coupon by code:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
