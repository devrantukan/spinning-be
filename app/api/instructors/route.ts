import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/instructors - Get all instructors for the organization
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

      console.log("[INSTRUCTORS] Fetching instructors with filter:", {
        organizationId: context.organizationId,
        where,
        userRole: context.user.role,
        userEmail: context.user.email,
        userOrganizationId: context.user.organizationId,
      });

      // Debug: Check all instructors in database first
      const allInstructors = await prisma.instructor.findMany({
        select: {
          id: true,
          userId: true,
          organizationId: true,
        },
      });
      console.log("[INSTRUCTORS] All instructors in database:", allInstructors);

      // First, get all Instructor records
      let instructors = await prisma.instructor.findMany({
        where,
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
        orderBy: {
          createdAt: "desc",
        },
      });

      // Also get users with INSTRUCTOR role who don't have Instructor records yet
      const usersWithInstructorRole = await prisma.user.findMany({
        where: {
          organizationId: context.organizationId,
          role: "INSTRUCTOR",
          instructor: null, // Users without Instructor records
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      // Create Instructor records for users who have INSTRUCTOR role but no Instructor record
      for (const user of usersWithInstructorRole) {
        try {
          const instructor = await prisma.instructor.create({
            data: {
              userId: user.id,
              organizationId: context.organizationId,
              status: "ACTIVE",
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
          instructors.push(instructor);
          console.log(
            `[INSTRUCTORS] Created missing Instructor record for user ${user.id}`
          );
        } catch (error: any) {
          // If creation fails (e.g., race condition), try to fetch again
          if (error.code === "P2002") {
            const existing = await prisma.instructor.findUnique({
              where: { userId: user.id },
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
            if (
              existing &&
              existing.organizationId === context.organizationId
            ) {
              instructors.push(existing);
            }
          } else {
            console.error(
              `[INSTRUCTORS] Error creating instructor for user ${user.id}:`,
              error
            );
          }
        }
      }

      console.log("[INSTRUCTORS] Found instructors:", {
        count: instructors.length,
        organizationId: context.organizationId,
        fromInstructorTable: instructors.filter(
          (i) => !usersWithInstructorRole.some((u) => u.id === i.userId)
        ).length,
        newlyCreated: usersWithInstructorRole.length,
      });

      return NextResponse.json(instructors);
    } catch (error) {
      console.error("Error fetching instructors:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
