import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";
import { sendBookingConfirmationEmails } from "@/lib/email";

// GET /api/bookings - Get all bookings for the organization
// Public access when querying by sessionId (for viewing occupied seats)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sessionId = searchParams.get("sessionId");

  // Allow public access when querying by sessionId (for guest users to see occupied seats)
  const requireAuth = !sessionId;

  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const { searchParams } = req.nextUrl;
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

        // If user is not admin and not guest, only show their own bookings
        if (context.user.role === "MEMBER") {
          where.userId = context.user.id;
        }

        // For public access (guest users), only return basic booking info with seat data
        // Exclude sensitive member/user information
        const isPublicAccess = context.user.role === "GUEST";

        if (isPublicAccess) {
          // Public access: only return seat information needed to show occupied seats
          const bookings = await prisma.booking.findMany({
            where: {
              ...where,
              status: {
                not: "CANCELLED", // Only show active bookings
              },
            },
            select: {
              id: true,
              sessionId: true,
              seatId: true,
              seat: {
                select: {
                  id: true,
                  seatNumber: true,
                  row: true,
                  column: true,
                  type: true,
                },
              },
              status: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });
          return NextResponse.json(bookings);
        }

        // Authenticated access: return full booking details
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
                type: true,
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
    },
    { requireAuth }
  );
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json();
      const {
        sessionId,
        seatId,
        seats,
        paymentType,
        memberId: bodyMemberId,
      } = body;

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
      const finalSeatId =
        seatId || (Array.isArray(seats) && seats.length > 0 ? seats[0] : null);

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

      // Determine final payment type
      const finalPaymentType = paymentType || "CREDITS";

      // Validate credit balance before proceeding with booking
      if (finalPaymentType === "CREDITS" && creditCost > 0) {
        const memberWithBalance = await prisma.member.findUnique({
          where: { id: member.id },
          select: { creditBalance: true },
        });

        if (!memberWithBalance) {
          return NextResponse.json(
            { error: "Member not found" },
            { status: 404 }
          );
        }

        if (memberWithBalance.creditBalance < creditCost) {
          return NextResponse.json(
            {
              error: "Insufficient credits",
              required: creditCost,
              available: memberWithBalance.creditBalance,
            },
            { status: 400 }
          );
        }
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

      // Helper function to process credit payment
      const processCreditPayment = async (
        memberId: string,
        creditsToDeduct: number,
        bookingId: string,
        finalPaymentType: string
      ): Promise<{ creditsUsed: number; error?: NextResponse }> => {
        if (finalPaymentType === "CREDITS" && creditsToDeduct > 0) {
          // Get current member balance
          const member = await prisma.member.findUnique({
            where: { id: memberId },
            select: { creditBalance: true },
          });

          if (!member) {
            throw new Error("Member not found");
          }

          const balanceBefore = member.creditBalance;

          // Check if member has enough credits
          if (balanceBefore < creditsToDeduct) {
            return {
              creditsUsed: 0,
              error: NextResponse.json(
                { error: "Insufficient credits" },
                { status: 400 }
              ),
            };
          }

          const balanceAfter = balanceBefore - creditsToDeduct;

          // Update member credit balance
          await prisma.member.update({
            where: { id: memberId },
            data: {
              creditBalance: balanceAfter,
            },
          });

          // Create credit transaction
          await prisma.creditTransaction.create({
            data: {
              memberId,
              organizationId: context.organizationId,
              amount: -creditsToDeduct, // Negative for deduction
              balanceBefore,
              balanceAfter,
              type: "BOOKING_PAYMENT",
              description: `Payment for booking ${bookingId}`,
              performedByUserId: context.user.id,
            },
          });

          return { creditsUsed: creditsToDeduct };
        }
        return { creditsUsed: 0 };
      };

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

          // Process credit payment if needed (for reactivated bookings)
          // Only deduct credits if they weren't already deducted (check if creditsUsed is null or 0)
          const finalPaymentType =
            paymentType || existingBooking.paymentType || "CREDITS";
          let creditsUsed = existingBooking.creditsUsed || 0;

          // Only process payment if credits weren't already used or if payment type changed to CREDITS
          if (
            finalPaymentType === "CREDITS" &&
            (!existingBooking.creditsUsed || existingBooking.creditsUsed === 0)
          ) {
            const creditResult = await processCreditPayment(
              member.id,
              creditCost,
              existingBooking.id,
              finalPaymentType
            );
            if (creditResult.error) {
              return creditResult.error; // Error response
            }
            creditsUsed = creditResult.creditsUsed;
          }

          // Reactivate cancelled booking
          booking = await prisma.booking.update({
            where: { id: existingBooking.id },
            data: {
              seatId: finalSeatId || existingBooking.seatId,
              creditCost,
              creditsUsed,
              paymentType: finalPaymentType,
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

            // Validate credits if changing to a more expensive seat with credit payment
            const updatePaymentType =
              paymentType || existingBooking.paymentType;
            if (
              updatePaymentType === "CREDITS" &&
              creditCost > (existingBooking.creditCost || 0)
            ) {
              const additionalCreditsNeeded =
                creditCost - (existingBooking.creditCost || 0);
              const memberWithBalance = await prisma.member.findUnique({
                where: { id: member.id },
                select: { creditBalance: true },
              });

              if (
                memberWithBalance &&
                memberWithBalance.creditBalance < additionalCreditsNeeded
              ) {
                return NextResponse.json(
                  {
                    error: "Insufficient credits for seat upgrade",
                    required: additionalCreditsNeeded,
                    available: memberWithBalance.creditBalance,
                  },
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
                paymentType: updatePaymentType,
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
          paymentType: finalPaymentType,
        });

        // Process credit payment if needed
        let creditsUsed = 0;
        if (finalPaymentType === "CREDITS") {
          // Use temporary booking ID, will update after creation
          const tempBookingId = `temp-${Date.now()}`;
          const creditResult = await processCreditPayment(
            member.id,
            creditCost,
            tempBookingId,
            finalPaymentType
          );
          if (creditResult.error) {
            return creditResult.error; // Error response (insufficient credits)
          }
          creditsUsed = creditResult.creditsUsed;
        }

        booking = await prisma.booking.create({
          data: {
            sessionId,
            memberId: member.id,
            userId: context.user.id,
            organizationId: context.organizationId,
            seatId: finalSeatId || null,
            creditCost,
            creditsUsed,
            paymentType: finalPaymentType,
            status: "CONFIRMED",
          },
        });

        console.log("Booking created successfully with ID:", booking.id);

        // Update credit transaction with actual booking ID if it was created
        if (finalPaymentType === "CREDITS" && creditsUsed > 0) {
          await prisma.creditTransaction.updateMany({
            where: {
              memberId: member.id,
              organizationId: context.organizationId,
              type: "BOOKING_PAYMENT",
              description: {
                contains: "temp-",
              },
            },
            data: {
              description: `Payment for booking ${booking.id}`,
            },
          });
        }

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

      // Send confirmation emails (only for new bookings or reactivated bookings)
      if (isNewBooking && bookingWithDetails) {
        try {
          // Get organization data for SMTP settings
          const organization = await prisma.organization.findUnique({
            where: { id: context.organizationId },
            select: {
              smtpHost: true,
              smtpPort: true,
              smtpUser: true,
              smtpPassword: true,
              smtpFromEmail: true,
              smtpFromName: true,
              language: true,
              email: true,
              name: true,
            },
          });

          if (
            organization &&
            bookingWithDetails.session &&
            bookingWithDetails.member?.user?.email
          ) {
            const sessionStartTime = new Date(
              bookingWithDetails.session.startTime
            );
            const sessionDate = sessionStartTime.toLocaleDateString(
              organization.language === "tr" ? "tr-TR" : "en-US",
              { year: "numeric", month: "long", day: "numeric" }
            );
            const sessionTime = sessionStartTime.toLocaleTimeString(
              organization.language === "tr" ? "tr-TR" : "en-US",
              { hour: "2-digit", minute: "2-digit" }
            );

            const memberEmail = bookingWithDetails.member.user.email;
            const adminEmail =
              organization.email || context.user.email || undefined;

            if (memberEmail && adminEmail) {
              await sendBookingConfirmationEmails(
                memberEmail,
                adminEmail as string,
                {
                  bookingId: bookingWithDetails.id,
                  className:
                    bookingWithDetails.session.class?.name || undefined,
                  classNameTr:
                    bookingWithDetails.session.class?.nameTr || undefined,
                  sessionDate,
                  sessionTime,
                  location:
                    bookingWithDetails.session.location?.name || undefined,
                  instructor:
                    bookingWithDetails.session.instructor?.user?.name ||
                    bookingWithDetails.session.instructor?.user?.email ||
                    undefined,
                  paymentType: bookingWithDetails.paymentType || undefined,
                  creditsUsed: bookingWithDetails.creditsUsed || undefined,
                  seatNumber: bookingWithDetails.seat?.seatNumber || undefined,
                },
                bookingWithDetails.member.user.name || undefined,
                organization
              );
            }
          }
        } catch (emailError: any) {
          // Log email error but don't fail the booking creation
          console.error(
            "[EMAIL] Error sending booking confirmation emails:",
            emailError
          );
        }
      }

      console.log("Returning booking response:", {
        bookingId: bookingWithDetails?.id,
        isNewBooking,
        status: isNewBooking ? 201 : 200,
      });

      return NextResponse.json(bookingWithDetails, {
        status: isNewBooking ? 201 : 200,
      });
    } catch (error: any) {
      console.error("Error creating booking:", {
        error: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack?.substring(0, 500),
      });

      if (error.code === "P2002") {
        // Unique constraint violation - this means the unique constraint on sessionId_memberId needs to be removed
        // to allow multiple bookings per member per session
        console.error(
          "Unique constraint violation - schema needs to be updated to allow multiple bookings"
        );
        return NextResponse.json(
          { error: "Booking constraint violation. Please contact support." },
          { status: 400 }
        );
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
