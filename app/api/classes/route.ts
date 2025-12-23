import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/classes - Get all classes for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { searchParams } = req.nextUrl;
      const status = searchParams.get("status");

      const where: any = {
        organizationId: context.organizationId,
      };

      if (status) {
        where.status = status;
      }

      const classes = await prisma.class.findMany({
        where,
        include: {
          _count: {
            select: {
              sessions: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      return NextResponse.json(classes);
    } catch (error) {
      console.error("Error fetching classes:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// POST /api/classes - Create a new class
export async function POST(request: NextRequest) {
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
            error: "Forbidden: Only admins and instructors can create classes",
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
        musicGenre,
        musicGenreTr,
      } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Missing required fields: name" },
          { status: 400 }
        );
      }

      const classData: any = {
        name,
        nameTr: nameTr || null,
        description: description || null,
        descriptionTr: descriptionTr || null,
        musicGenre: musicGenre || null,
        musicGenreTr: musicGenreTr || null,
        organizationId: context.organizationId,
        status: "ACTIVE",
      };

      const newClass = await prisma.class.create({
        data: classData,
      });

      return NextResponse.json(newClass, { status: 201 });
    } catch (error) {
      console.error("Error creating class:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
