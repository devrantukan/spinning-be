import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/redemptions - Get all redemptions for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { searchParams } = req.nextUrl;
      const memberId = searchParams.get("memberId");
      const status = searchParams.get("status");

      const where: any = {
        organizationId: context.organizationId,
      };

      if (memberId) {
        where.memberId = memberId;
      }

      if (status) {
        where.status = status;
      }

      const redemptions = await prisma.packageRedemption.findMany({
        where,
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
          coupon: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
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
        orderBy: {
          redeemedAt: "desc",
        },
      });

      return NextResponse.json(redemptions);
    } catch (error) {
      console.error("Error fetching redemptions:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
