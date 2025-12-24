import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/instructors/[id] - Get a specific instructor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
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
  });
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

      // Delete the instructor record
      // Note: The User record will remain, but the Instructor record will be deleted
      // If you want to delete the User as well, uncomment the user deletion code below
      await prisma.instructor.delete({
        where: { id },
      });

      // Optional: Also delete the associated user (uncomment if needed)
      // await prisma.user.delete({
      //   where: { id: instructor.userId },
      // });

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
