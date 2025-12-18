import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/redemptions/[id]/all-access-usage - Get All Access daily usage for a redemption
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params;

      // Verify redemption exists and belongs to organization
      const redemption = await prisma.packageRedemption.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!redemption) {
        return NextResponse.json(
          { error: "Redemption not found" },
          { status: 404 }
        );
      }

      const usage = await prisma.allAccessDailyUsage.findMany({
        where: {
          packageRedemptionId: id,
        },
        include: {
          booking: {
            select: {
              id: true,
              sessionId: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          usageDate: "desc",
        },
      });

      return NextResponse.json(usage);
    } catch (error) {
      console.error("Error fetching All Access usage:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}



