import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/classes/[id] - Get a specific class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      const classData = await prisma.class.findFirst({
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

      if (!classData) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      return NextResponse.json(classData);
    } catch (error) {
      console.error("Error fetching class:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/classes/[id] - Update a class
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN" &&
        context.user.role !== "INSTRUCTOR"
      ) {
        return NextResponse.json(
          {
            error: "Forbidden: Only admins and instructors can update classes",
          },
          { status: 403 }
        );
      }

      const body = await req.json();
      const {
        name,
        nameTr,
        description,
        descriptionTr,
        status,
        musicGenre,
        musicGenreTr,
      } = body;

      // Verify class belongs to organization
      const existingClass = await prisma.class.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingClass) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (nameTr !== undefined) updateData.nameTr = nameTr || null;
      if (description !== undefined)
        updateData.description = description || null;
      if (descriptionTr !== undefined)
        updateData.descriptionTr = descriptionTr || null;
      if (musicGenre !== undefined) updateData.musicGenre = musicGenre || null;
      if (musicGenreTr !== undefined)
        updateData.musicGenreTr = musicGenreTr || null;
      if (status) updateData.status = status;

      const updatedClass = await prisma.class.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              sessions: true,
            },
          },
        },
      });

      return NextResponse.json(updatedClass);
    } catch (error) {
      console.error("Error updating class:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/classes/[id] - Delete a class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can delete classes
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can delete classes" },
          { status: 403 }
        );
      }

      // Verify class belongs to organization
      const existingClass = await prisma.class.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingClass) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      await prisma.class.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Class deleted successfully" });
    } catch (error) {
      console.error("Error deleting class:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
