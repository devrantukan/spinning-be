import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

/**
 * GET /api/seat-layouts - Get seat layout by locationId or seatLayoutId
 * Public endpoint - no authentication required
 *
 * Query params:
 * - locationId: The location ID to get seat layout for
 * - seatLayoutId: The seat layout ID to get seat layout for
 */
export async function GET(request: NextRequest) {
  // Allow public access for GET requests
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const { searchParams } = req.nextUrl;
        const locationId = searchParams.get("locationId");
        const seatLayoutId = searchParams.get("seatLayoutId");

        if (!locationId && !seatLayoutId) {
          return NextResponse.json(
            { error: "locationId or seatLayoutId is required" },
            { status: 400 }
          );
        }

        let seatLayout;

        if (seatLayoutId) {
          // Get seat layout by ID
          seatLayout = await prisma.seatLayout.findFirst({
            where: {
              id: seatLayoutId,
              location: {
                organizationId: context.organizationId,
              },
            },
            include: {
              location: true,
              seats: {
                orderBy: [{ row: "asc" }, { column: "asc" }],
              },
            },
          });
        } else if (locationId) {
          // Get active seat layout by locationId
          seatLayout = await prisma.seatLayout.findFirst({
            where: {
              locationId,
              isActive: true,
              location: {
                organizationId: context.organizationId,
              },
            },
            include: {
              location: true,
              seats: {
                orderBy: [{ row: "asc" }, { column: "asc" }],
              },
            },
          });
        }

        if (!seatLayout) {
          return NextResponse.json(
            { error: "Seat layout not found" },
            { status: 404 }
          );
        }

        return NextResponse.json(seatLayout);
      } catch (error) {
        console.error("Error fetching seat layout:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: false } // Make authentication optional for public access
  );
}



