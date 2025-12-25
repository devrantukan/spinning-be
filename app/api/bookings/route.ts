import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/bookings - Get all bookings for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { searchParams } = req.nextUrl;
      const sessionId = searchParams.get("sessionId");
      const memberId = searchParams.get("memberId");
      const status = searchParams.get("status");

      const where: any = {
        organizationId: context.organizationId,
      };

      if (sessionId) {
        where.sessionId = sessionId;
      }

      if (memberId) {
        where.memberId = memberId;
      }

      if (status) {
        where.status = status;
      }

      // If user is not admin, only show their own bookings
      if (context.user.role === "MEMBER") {
        where.userId = context.user.id;
      }

      const bookings = await prisma.booking.findMany({
        where,
        include: {
          session: {
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
          },
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
          seat: {
            select: {
              id: true,
              seatNumber: true,
              row: true,
              column: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json();
      const { sessionId, seatId, seats, paymentType, memberId: bodyMemberId } = body;

      if (!sessionId) {
        return NextResponse.json(
          { error: "Missing required field: sessionId" },
          { status: 400 }
        );
      }

      // Get or create member for the user
      // Use memberId from body if provided (for admin bookings), otherwise use context user
      let member;
      if (bodyMemberId && context.user.role !== "MEMBER") {
        // Admin/Tenant Admin can book for other members
        member = await prisma.member.findFirst({
          where: {
            id: bodyMemberId,
            organizationId: context.organizationId,
          },
        });
        if (!member) {
          return NextResponse.json(
            { error: "Member not found" },
            { status: 404 }
          );
        }
      } else {
        // Regular member booking
        member = await prisma.member.findFirst({
          where: {
            userId: context.user.id,
            organizationId: context.organizationId,
          },
        });

        if (!member) {
          member = await prisma.member.create({
            data: {
              userId: context.user.id,
              organizationId: context.organizationId,
              status: "ACTIVE",
            },
          });
        }
      }

      // Verify session exists and belongs to organization
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          organizationId: context.organizationId,
        },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Check if session is full
      if (session.currentBookings >= session.maxCapacity) {
        return NextResponse.json({ error: "Session is full" }, { status: 400 });
      }

      // Determine the seat ID to use (prefer seatId, then first from seats array)
      const finalSeatId = seatId || (Array.isArray(seats) && seats.length > 0 ? seats[0] : null);

      // If a seat is specified, verify it exists and check availability
      let seat = null;
      let creditCost = 1; // Default credit cost
      if (finalSeatId) {
        seat = await prisma.seat.findUnique({
          where: { id: finalSeatId },
        });

        if (!seat) {
          return NextResponse.json(
            { error: "Seat not found" },
            { status: 404 }
          );
        }

        // Check if seat is already taken by another member for this session
        const seatBooking = await prisma.booking.findFirst({
          where: {
            sessionId,
            seatId: finalSeatId,
            status: {
              not: "CANCELLED",
            },
          },
        });

        if (seatBooking && seatBooking.memberId !== member.id) {
          return NextResponse.json(
            { error: "This seat is already taken" },
            { status: 400 }
          );
        }

        // Get credit cost from seat
        creditCost = seat.creditCost || 1;
      }

      // Check if member already has a booking for this session
      const existingBooking = await prisma.booking.findUnique({
        where: {
          sessionId_memberId: {
            sessionId,
            memberId: member.id,
          },
        },
      });

      let booking;
      let isNewBooking = false;

      if (existingBooking) {
        if (existingBooking.status === "CANCELLED") {
          // If booking was cancelled, reactivate it with new seat/payment info
          isNewBooking = true; // Count as new for session booking increment
          
          // Check if the new seat is available (if seat is specified)
          if (finalSeatId && seat) {
            const newSeatBooking = await prisma.booking.findFirst({
              where: {
                sessionId,
                seatId: finalSeatId,
                status: {
                  not: "CANCELLED",
                },
                id: {
                  not: existingBooking.id, // Exclude current cancelled booking
                },
              },
            });

            if (newSeatBooking) {
              return NextResponse.json(
                { error: "This seat is already taken" },
                { status: 400 }
              );
            }
          }

          // Reactivate cancelled booking
          booking = await prisma.booking.update({
            where: { id: existingBooking.id },
            data: {
              seatId: finalSeatId || existingBooking.seatId,
              creditCost,
              paymentType: paymentType || existingBooking.paymentType || "CREDITS",
              status: "CONFIRMED",
            },
          });

          // Increment session booking count (was decremented when cancelled)
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              currentBookings: {
                increment: 1,
              },
            },
          });
        } else {
          // Member already has an active booking - update the seat if different
          if (finalSeatId && existingBooking.seatId !== finalSeatId) {
            // Check if the new seat is available
            if (seat) {
              const newSeatBooking = await prisma.booking.findFirst({
                where: {
                  sessionId,
                  seatId: finalSeatId,
                  status: {
                    not: "CANCELLED",
                  },
                  id: {
                    not: existingBooking.id, // Exclude current booking
                  },
                },
              });

              if (newSeatBooking) {
                return NextResponse.json(
                  { error: "This seat is already taken" },
                  { status: 400 }
                );
              }
            }

            // Update existing booking with new seat
            booking = await prisma.booking.update({
              where: { id: existingBooking.id },
              data: {
                seatId: finalSeatId,
                creditCost,
                paymentType: paymentType || existingBooking.paymentType,
              },
            });
          } else {
            // Same seat or no seat change - return existing booking
            booking = existingBooking;
          }
        }
      } else {
        // Create new booking
        isNewBooking = true;
        console.log("Creating new booking:", {
          sessionId,
          memberId: member.id,
          userId: context.user.id,
          organizationId: context.organizationId,
          seatId: finalSeatId || null,
          creditCost,
          paymentType: paymentType || "CREDITS",
        });
        
        booking = await prisma.booking.create({
          data: {
            sessionId,
            memberId: member.id,
            userId: context.user.id,
            organizationId: context.organizationId,
            seatId: finalSeatId || null,
            creditCost,
            paymentType: paymentType || "CREDITS",
            status: "CONFIRMED",
          },
        });

        console.log("Booking created successfully with ID:", booking.id);

        // Update session booking count only for new bookings
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            currentBookings: {
              increment: 1,
            },
          },
        });
        
        console.log("Session booking count incremented");
      }

      const bookingWithDetails = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          session: {
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
          },
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
          seat: {
            select: {
              id: true,
              seatNumber: true,
              row: true,
              column: true,
              type: true,
            },
          },
        },
      });

      console.log("Returning booking response:", {
        bookingId: bookingWithDetails?.id,
        isNewBooking,
        status: isNewBooking ? 201 : 200,
      });
      
      return NextResponse.json(bookingWithDetails, { status: isNewBooking ? 201 : 200 });
    } catch (error: any) {
      console.error("Error creating booking:", {
        error: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack?.substring(0, 500),
      });
      
      if (error.code === "P2002") {
        // Unique constraint violation
        const target = error.meta?.target || [];
        if (target.includes("sessionId") && target.includes("memberId")) {
          return NextResponse.json(
            { error: "Already booked for this session" },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: "Booking conflict. Please try again." },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}
