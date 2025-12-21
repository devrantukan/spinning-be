import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/seats/[id] - Get a specific seat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params;

      const seat = await prisma.seat.findFirst({
        where: {
          id,
          seatLayout: {
            location: {
              organizationId: context.organizationId,
            },
          },
        },
        include: {
          seatLayout: {
            include: {
              location: true,
            },
          },
        },
      });

      if (!seat) {
        return NextResponse.json({ error: "Seat not found" }, { status: 404 });
      }

      return NextResponse.json(seat);
    } catch (error) {
      console.error("Error fetching seat:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/seats/[id] - Update a seat
export async function PATCH(
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
          { error: "Forbidden: Only admins can update seats" },
          { status: 403 }
        );
      }

      const { id } = await params;
      const body = await req.json();

      // Verify seat belongs to organization
      const existingSeat = await prisma.seat.findFirst({
        where: {
          id,
          seatLayout: {
            location: {
              organizationId: context.organizationId,
            },
          },
        },
      });

      if (!existingSeat) {
        return NextResponse.json({ error: "Seat not found" }, { status: 404 });
      }

      const { seatNumber, row, column, type, creditCost, x, y, isActive } =
        body;

      // If seat number is being changed, check for conflicts
      if (seatNumber && seatNumber !== existingSeat.seatNumber) {
        const conflict = await prisma.seat.findUnique({
          where: {
            seatLayoutId_seatNumber: {
              seatLayoutId: existingSeat.seatLayoutId,
              seatNumber,
            },
          },
        });

        if (conflict) {
          return NextResponse.json(
            { error: `Seat ${seatNumber} already exists in this layout` },
            { status: 400 }
          );
        }
      }

      const updateData: any = {};
      if (seatNumber !== undefined) updateData.seatNumber = seatNumber;
      if (row !== undefined) updateData.row = row || null;
      if (column !== undefined) updateData.column = column || null;
      if (type !== undefined) updateData.type = type;
      if (creditCost !== undefined) updateData.creditCost = creditCost;
      if (x !== undefined) updateData.x = x || null;
      if (y !== undefined) updateData.y = y || null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedSeat = await prisma.seat.update({
        where: { id },
        data: updateData,
        include: {
          seatLayout: {
            include: {
              location: true,
            },
          },
        },
      });

      return NextResponse.json(updatedSeat);
    } catch (error: any) {
      console.error("Error updating seat:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/seats/[id] - Delete a seat
export async function DELETE(
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
          { error: "Forbidden: Only admins can delete seats" },
          { status: 403 }
        );
      }

      const { id } = await params;

      // Verify seat belongs to organization
      const seat = await prisma.seat.findFirst({
        where: {
          id,
          seatLayout: {
            location: {
              organizationId: context.organizationId,
            },
          },
        },
        include: {
          _count: {
            select: {
              bookings: true,
            },
          },
        },
      });

      if (!seat) {
        return NextResponse.json({ error: "Seat not found" }, { status: 404 });
      }

      // Check if seat has active bookings
      if (seat._count.bookings > 0) {
        return NextResponse.json(
          { error: "Cannot delete seat with active bookings" },
          { status: 400 }
        );
      }

      await prisma.seat.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Seat deleted successfully" });
    } catch (error) {
      console.error("Error deleting seat:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
