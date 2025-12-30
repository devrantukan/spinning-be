import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/contact/list - Fetch all contact submissions for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can view submissions
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can view contact submissions" },
          { status: 403 }
        );
      }

      const submissions = await prisma.contactSubmission.findMany({
        where: {
          organizationId: context.organizationId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json(submissions);
    } catch (error) {
      console.error("[CONTACT-LIST] Error fetching submissions:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
