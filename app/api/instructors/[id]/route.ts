import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/instructors/[id] - Get a specific instructor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const instructor = await prisma.instructor.findFirst({
          where: {
            id,
            organizationId: context.organizationId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            _count: {
              select: {
                sessions: true,
              },
            },
          },
        });

        if (!instructor) {
          return NextResponse.json(
            { error: "Instructor not found" },
            { status: 404 }
          );
        }

        return NextResponse.json(instructor);
      } catch (error) {
        console.error("Error fetching instructor:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: false }
  );
}

// PATCH /api/instructors/[id] - Update an instructor
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json();
      const { bio, photoUrl, specialties, status } = body;

      // Check if instructor exists and belongs to organization
      const existingInstructor = await prisma.instructor.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingInstructor) {
        return NextResponse.json(
          { error: "Instructor not found" },
          { status: 404 }
        );
      }

      // Only admins and tenant admins can update instructors
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Update instructor
      const updateData: any = {};
      if (bio !== undefined) updateData.bio = bio || null;
      if (photoUrl !== undefined) updateData.photoUrl = photoUrl || null;
      if (specialties !== undefined) updateData.specialties = specialties;
      if (status !== undefined) updateData.status = status;

      const instructor = await prisma.instructor.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              sessions: true,
            },
          },
        },
      });

      return NextResponse.json(instructor);
    } catch (error: any) {
      console.error("Error updating instructor:", error);
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Instructor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/instructors/[id] - Delete an instructor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check if instructor exists and belongs to organization
      const instructor = await prisma.instructor.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
        include: {
          _count: {
            select: {
              sessions: true,
            },
          },
        },
      });

      if (!instructor) {
        return NextResponse.json(
          { error: "Instructor not found" },
          { status: 404 }
        );
      }

      // Only admins and tenant admins can delete instructors
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Check if instructor has active sessions
      if (instructor._count?.sessions && instructor._count.sessions > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete instructor with active sessions. Please reassign or cancel sessions first.",
          },
          { status: 400 }
        );
      }

      // Perform deletion and role update in a transaction
      await prisma.$transaction([
        // 1. Delete the instructor record
        prisma.instructor.delete({
          where: { id },
        }),
        // 2. Update the user's role to MEMBER to prevent auto-recreation
        // This is crucial because the GET endpoint re-creates instructors for users with INSTRUCTOR role
        prisma.user.update({
          where: { id: instructor.userId },
          data: { role: "MEMBER" },
        }),
      ]);

      console.log(`[INSTRUCTORS] Successfully deleted instructor ${id} and updated user ${instructor.userId} role to MEMBER`);

      return NextResponse.json({ message: "Instructor deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting instructor:", error);
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Instructor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}
