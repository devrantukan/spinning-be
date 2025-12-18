import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/redemptions/[id] - Get a specific redemption
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params;

      const redemption = await prisma.packageRedemption.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
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
      });

      if (!redemption) {
        return NextResponse.json(
          { error: "Redemption not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(redemption);
    } catch (error) {
      console.error("Error fetching redemption:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/redemptions/[id]/approve - Approve a redemption (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can approve redemptions
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can approve redemptions" },
          { status: 403 }
        );
      }

      const { id } = await params;

      // Get redemption with package and member info
      const redemption = await prisma.packageRedemption.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
        include: {
          package: true,
          member: true,
        },
      });

      if (!redemption) {
        return NextResponse.json(
          { error: "Redemption not found" },
          { status: 404 }
        );
      }

      // Only approve PENDING redemptions
      if (redemption.status !== "PENDING") {
        return NextResponse.json(
          {
            error: `Redemption is already ${redemption.status}. Only PENDING redemptions can be approved.`,
          },
          { status: 400 }
        );
      }

      // Update redemption status to ACTIVE and apply credits/benefits
      const result = await prisma.$transaction(async (tx) => {
        // Update redemption status
        const updatedRedemption = await tx.packageRedemption.update({
          where: { id },
          data: { status: "ACTIVE" },
        });

        // Prepare member update data
        const updateData: any = {};

        // Add credits if redemption has credits
        if (redemption.creditsAdded && redemption.creditsAdded > 0) {
          updateData.creditBalance = {
            increment: redemption.creditsAdded,
          };
        }

        // Update All Access flags if applicable
        if (redemption.allAccessExpiresAt) {
          updateData.hasAllAccess = true;
          updateData.allAccessExpiresAt = redemption.allAccessExpiresAt;
        }

        // Update Elite member flag if applicable
        if (redemption.package?.type === "ELITE_30") {
          updateData.isEliteMember = true;
        }

        // Update member
        const updatedMember = await tx.member.update({
          where: { id: redemption.memberId },
          data: updateData,
        });

        // Create credit transaction if credits were added
        if (redemption.creditsAdded && redemption.creditsAdded > 0) {
          const balanceBefore = redemption.member.creditBalance;
          const balanceAfter = updatedMember.creditBalance;

          await tx.creditTransaction.create({
            data: {
              memberId: redemption.memberId,
              organizationId: context.organizationId,
              amount: redemption.creditsAdded,
              balanceBefore,
              balanceAfter,
              type: "MANUAL_ADD",
              description: `Package redemption approved: ${
                redemption.package?.name || "Package"
              }`,
              performedByUserId: context.user.id,
            },
          });
        }

        return updatedRedemption;
      });

      // Fetch updated redemption with relations
      const redemptionWithRelations = await prisma.packageRedemption.findUnique(
        {
          where: { id: result.id },
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

      return NextResponse.json(redemptionWithRelations);
    } catch (error: any) {
      console.error("Error approving redemption:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}

