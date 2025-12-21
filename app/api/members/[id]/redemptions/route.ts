import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/members/[id]/redemptions - Get all redemptions for a member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params;

      // Verify member exists and belongs to organization
      const member = await prisma.member.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!member) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }

      const redemptions = await prisma.packageRedemption.findMany({
        where: {
          memberId: id,
          organizationId: context.organizationId,
        },
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
              nameTr: true,
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
        },
        orderBy: {
          redeemedAt: "desc",
        },
      });

      return NextResponse.json(redemptions);
    } catch (error) {
      console.error("Error fetching member redemptions:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
