import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/sessions - Get all sessions for the organization
// Public endpoint - authentication is optional
export async function GET(request: NextRequest) {
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const { searchParams } = req.nextUrl;
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const classId = searchParams.get("classId");
        const status = searchParams.get("status");
        const timeFilter = searchParams.get("timeFilter"); // 'all', 'am', or 'pm'

        const where: any = {
          organizationId: context.organizationId,
        };

        if (startDate || endDate) {
          where.startTime = {};
          if (startDate) where.startTime.gte = new Date(startDate);
          if (endDate) where.startTime.lte = new Date(endDate);
        }

        if (classId) {
          where.classId = classId;
        }

        if (status) {
          where.status = status;
        }

        // Filter by AM/PM using the indexed amPm field
        if (timeFilter && timeFilter !== "all") {
          const upperTimeFilter = timeFilter.toUpperCase();
          if (upperTimeFilter === "AM" || upperTimeFilter === "PM") {
            where.amPm = upperTimeFilter;
          }
        }

        const sessions = await prisma.session.findMany({
          where,
          include: {
            class: true,
            location: true,
            instructor: {
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
            _count: {
              select: {
                bookings: true,
              },
            },
          },
          orderBy: {
            startTime: "asc",
          },
        });

        return NextResponse.json(sessions);
      } catch (error) {
        console.error("Error fetching sessions:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: false } // Make GET endpoint public
  );
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check if user has permission to create sessions
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN" &&
        context.user.role !== "INSTRUCTOR"
      ) {
        return NextResponse.json(
          {
            error: "Forbidden: Only admins and instructors can create sessions",
          },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { classId, instructorId, locationId, startTime, endTime } = body;

      if (!classId || !startTime || !endTime || !instructorId) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: classId, startTime, endTime, instructorId",
          },
          { status: 400 }
        );
      }

      // Validate that startTime is not in the past
      const startDateTime = new Date(startTime);
      const now = new Date();
      if (startDateTime < now) {
        return NextResponse.json(
          {
            error:
              "Cannot create sessions in the past. Please select a future date.",
          },
          { status: 400 }
        );
      }

      // Validate that endTime is after startTime
      const endDateTime = new Date(endTime);
      if (endDateTime <= startDateTime) {
        return NextResponse.json(
          { error: "End time must be after start time." },
          { status: 400 }
        );
      }

      // Verify class belongs to organization
      const classExists = await prisma.class.findFirst({
        where: {
          id: classId,
          organizationId: context.organizationId,
        },
      });

      if (!classExists) {
        return NextResponse.json(
          { error: "Class not found or does not belong to organization" },
          { status: 404 }
        );
      }

      // Verify instructor belongs to organization
      const instructorExists = await prisma.instructor.findFirst({
        where: {
          id: instructorId,
          organizationId: context.organizationId,
        },
      });

      if (!instructorExists) {
        return NextResponse.json(
          { error: "Instructor not found or does not belong to organization" },
          { status: 404 }
        );
      }

      // Calculate maxCapacity from location's active seat layout
      let calculatedMaxCapacity = 0; // Will be set from seat layout
      if (locationId) {
        const activeSeatLayout = await prisma.seatLayout.findFirst({
          where: {
            locationId: locationId,
            isActive: true,
          },
          include: {
            seats: {
              where: {
                isActive: true,
              },
            },
          },
        });

        if (activeSeatLayout) {
          // Count only active seats
          calculatedMaxCapacity = activeSeatLayout.seats.length;
        } else {
          return NextResponse.json(
            {
              error:
                "Selected location does not have an active seat layout. Please activate a seat layout for this location first.",
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error:
              "Location is required to create a session (needed for seat layout capacity)",
          },
          { status: 400 }
        );
      }

      // Calculate duration and AM/PM (using already validated dates)
      const durationMinutes = Math.round(
        (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60)
      );
      const startHour = startDateTime.getHours();
      const amPm = startHour < 12 ? "AM" : "PM";

      const session = await prisma.session.create({
        data: {
          classId,
          organizationId: context.organizationId,
          instructorId,
          locationId: locationId || null,
          startTime: startDateTime,
          endTime: endDateTime,
          duration: durationMinutes,
          amPm: amPm,
          maxCapacity: calculatedMaxCapacity,
          currentBookings: 0,
          status: "SCHEDULED",
        },
        include: {
          class: true,
          location: true,
          instructor: {
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

      return NextResponse.json(session, { status: 201 });
    } catch (error: any) {
      console.error("Error creating session:", error);
      const errorMessage = error?.message || "Internal server error";
      const errorDetails = error?.meta || error?.code || "";
      console.error("Error details:", { errorMessage, errorDetails, error });
      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails ? String(errorDetails) : undefined,
        },
        { status: 500 }
      );
    }
  });
}
