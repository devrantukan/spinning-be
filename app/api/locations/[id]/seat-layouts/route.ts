import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/locations/[id]/seat-layouts - Get all seat layouts for a location
// Public endpoint - no authentication required for viewing seat layouts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const { id: locationId } = await params;

        // Verify location belongs to organization
        const location = await prisma.location.findFirst({
          where: {
            id: locationId,
            organizationId: context.organizationId,
          },
        });

        if (!location) {
          return NextResponse.json(
            { error: "Location not found" },
            { status: 404 }
          );
        }

        const seatLayouts = await prisma.seatLayout.findMany({
          where: {
            locationId,
          },
          include: {
            seats: {
              orderBy: [{ row: "asc" }, { column: "asc" }],
            },
            _count: {
              select: {
                seats: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return NextResponse.json(seatLayouts);
      } catch (error) {
        console.error("Error fetching seat layouts:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: false } // Make authentication optional for public access
  );
}

// POST /api/locations/[id]/seat-layouts - Create a new seat layout
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can create seat layouts" },
          { status: 403 }
        );
      }

      const { id: locationId } = await params;
      const body = await req.json();

      // Verify location belongs to organization
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          organizationId: context.organizationId,
        },
      });

      if (!location) {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        );
      }

      const { name, description, isActive, gridRows, gridColumns } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Missing required field: name" },
          { status: 400 }
        );
      }

      // If setting as active, deactivate other layouts for this location
      if (isActive !== false) {
        await prisma.seatLayout.updateMany({
          where: {
            locationId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });
      }

      const seatLayout = await prisma.seatLayout.create({
        data: {
          name,
          description: description || null,
          locationId,
          gridRows: gridRows || null,
          gridColumns: gridColumns || null,
          isActive: isActive !== false,
        },
        include: {
          seats: true,
        },
      });

      return NextResponse.json(seatLayout, { status: 201 });
    } catch (error) {
      console.error("Error creating seat layout:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
