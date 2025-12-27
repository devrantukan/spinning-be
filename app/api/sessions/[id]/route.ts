import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/sessions/[id] - Get a specific session (public access)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(
    request,
    async (req, context) => {
    try {
      const session = await prisma.session.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
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
          bookings: {
            include: {
              member: {
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
          },
        },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
    },
    { requireAuth: false } // Make GET endpoint public
  );
}

// PATCH /api/sessions/[id] - Update a session
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
            error: "Forbidden: Only admins and instructors can update sessions",
          },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { startTime, endTime, instructorId, status, locationId } = body;

      // Verify instructor if provided in update
      if (instructorId !== undefined) {
        if (!instructorId) {
          return NextResponse.json(
            { error: "Instructor is required and cannot be empty" },
            { status: 400 }
          );
        }
        const instructorExists = await prisma.instructor.findFirst({
          where: {
            id: instructorId,
            organizationId: context.organizationId,
          },
        });
        if (!instructorExists) {
          return NextResponse.json(
            {
              error: "Instructor not found or does not belong to organization",
            },
            { status: 404 }
          );
        }
      }

      // Get existing session to calculate duration/amPm if times are updated
      const existingSession = await prisma.session.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const updateData: any = {};
      let newStartTime = existingSession.startTime;
      let newEndTime = existingSession.endTime;

      if (startTime) {
        newStartTime = new Date(startTime);
        // Allow past dates when editing (only prevent past dates when creating new sessions)
        updateData.startTime = newStartTime;
      }
      if (endTime) {
        newEndTime = new Date(endTime);
      }

      // Validate that endTime is after startTime
      if (startTime || endTime) {
        if (newEndTime <= newStartTime) {
          return NextResponse.json(
            { error: "End time must be after start time." },
            { status: 400 }
          );
        }
      }

      // Recalculate duration and AM/PM if startTime or endTime was updated
      if (startTime || endTime) {
        const durationMinutes = Math.round(
          (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60)
        );
        const startHour = newStartTime.getHours();
        const amPm = startHour < 12 ? "AM" : "PM";
        updateData.duration = durationMinutes;
        updateData.amPm = amPm;
      }

      // Recalculate maxCapacity if location is changed
      if (locationId !== undefined) {
        const newLocationId = locationId || null;
        updateData.locationId = newLocationId;

        if (newLocationId) {
          const activeSeatLayout = await prisma.seatLayout.findFirst({
            where: {
              locationId: newLocationId,
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
            updateData.maxCapacity = activeSeatLayout.seats.length;
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
                "Location is required for sessions (needed for seat layout capacity)",
            },
            { status: 400 }
          );
        }
      }

      if (instructorId !== undefined) updateData.instructorId = instructorId;
      if (status) updateData.status = status;

      const session = await prisma.session.updateMany({
        where: {
          id,
          organizationId: context.organizationId,
        },
        data: updateData,
      });

      if (session.count === 0) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const updatedSession = await prisma.session.findUnique({
        where: { id },
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

      return NextResponse.json(updatedSession);
    } catch (error) {
      console.error("Error updating session:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can delete sessions
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can delete sessions" },
          { status: 403 }
        );
      }

      const session = await prisma.session.deleteMany({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (session.count === 0) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
