import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";
import { sendBookingCancellationEmails } from "@/lib/email";

// GET /api/bookings/[id] - Get a specific booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      const where: any = {
        id,
        organizationId: context.organizationId,
      };

      // If user is not admin, only allow access to their own bookings
      if (context.user.role === "MEMBER") {
        where.userId = context.user.id;
      }

      const booking = await prisma.booking.findFirst({
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
      });

      if (!booking) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(booking);
    } catch (error) {
      console.error("Error fetching booking:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/bookings/[id] - Update a booking (cancel, check-in, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json();
      const { status, checkedIn, refundCredit } = body;

      const where: any = {
        id,
        organizationId: context.organizationId,
      };

      // If user is not admin, only allow updates to their own bookings
      if (context.user.role === "MEMBER") {
        where.userId = context.user.id;
      }

      // Get current booking with session details
      const currentBooking = await prisma.booking.findFirst({
        where,
        include: {
          session: {
            include: {
              class: {
                select: {
                  name: true,
                  nameTr: true,
                },
              },
              location: {
                select: {
                  name: true,
                },
              },
              instructor: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          member: {
            select: {
              id: true,
              creditBalance: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          friendPassRedemption: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!currentBooking) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      // If cancelling, validate cancellation time
      if (status === "CANCELLED" && currentBooking.status !== "CANCELLED") {
        if (currentBooking.session?.startTime) {
          const sessionStartTime = new Date(currentBooking.session.startTime);
          const now = new Date();
          const hoursUntilStart =
            (sessionStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          // Cannot cancel if less than 12 hours before session
          if (hoursUntilStart < 12) {
            return NextResponse.json(
              {
                error:
                  "Cancellation is allowed only until 12 hours before session start time",
              },
              { status: 400 }
            );
          }

          // Determine if credit should be refunded (6 hours before cutoff)
          const shouldRefundCredit =
            refundCredit !== undefined ? refundCredit : hoursUntilStart >= 6;

          // Refund credits if applicable
          if (
            shouldRefundCredit &&
            currentBooking.paymentType === "CREDITS" &&
            (currentBooking.creditsUsed || currentBooking.creditCost)
          ) {
            const creditsToRefund =
              currentBooking.creditsUsed || currentBooking.creditCost || 1;

            // Get current member balance
            const member = await prisma.member.findUnique({
              where: { id: currentBooking.memberId },
              select: { creditBalance: true },
            });

            if (member) {
              const balanceBefore = member.creditBalance;
              const balanceAfter = balanceBefore + creditsToRefund;

              // Update member credit balance
              await prisma.member.update({
                where: { id: currentBooking.memberId },
                data: {
                  creditBalance: balanceAfter,
                },
              });

              // Create credit transaction for refund
              await prisma.creditTransaction.create({
                data: {
                  memberId: currentBooking.memberId,
                  organizationId: context.organizationId,
                  amount: creditsToRefund,
                  balanceBefore,
                  balanceAfter,
                  type: "REFUND",
                  description: `Refund for cancelled booking ${currentBooking.id}`,
                  performedByUserId: context.user.id,
                },
              });
            }
          }

          // Handle All Access daily usage cancellation
          if (
            currentBooking.paymentType === "ALL_ACCESS" &&
            currentBooking.allAccessDailyUsageId
          ) {
            // Delete the All Access daily usage record to free up the slot
            await prisma.allAccessDailyUsage.deleteMany({
              where: {
                id: currentBooking.allAccessDailyUsageId,
                memberId: currentBooking.memberId,
              },
            });
          }

          // Handle Friend Pass cancellation
          if (
            currentBooking.paymentType === "FRIEND_PASS" &&
            currentBooking.friendPassRedemption
          ) {
            // Reset friend pass usage in redemption
            await prisma.packageRedemption.updateMany({
              where: {
                id: currentBooking.friendPassRedemption.id,
                memberId: currentBooking.memberId,
              },
              data: {
                friendPassUsed: false,
                friendPassUsedAt: null,
                friendPassBookingId: null,
              },
            });
          }
        }

        // Decrement session booking count
        await prisma.session.update({
          where: { id: currentBooking.sessionId },
          data: {
            currentBookings: {
              decrement: 1,
            },
          },
        });

        // Send cancellation emails
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
            currentBooking.session &&
            currentBooking.member?.user?.email
          ) {
            const sessionStartTime = new Date(currentBooking.session.startTime);
            const sessionDate = sessionStartTime.toLocaleDateString(
              organization.language === "tr" ? "tr-TR" : "en-US",
              { year: "numeric", month: "long", day: "numeric" }
            );
            const sessionTime = sessionStartTime.toLocaleTimeString(
              organization.language === "tr" ? "tr-TR" : "en-US",
              { hour: "2-digit", minute: "2-digit" }
            );

            const hoursUntilStart =
              (sessionStartTime.getTime() - new Date().getTime()) /
              (1000 * 60 * 60);
            const shouldRefundCredit =
              refundCredit !== undefined ? refundCredit : hoursUntilStart >= 6;

            const memberEmail = currentBooking.member.user.email;
            const adminEmail =
              organization.email || context.user.email || undefined;

            if (memberEmail && adminEmail) {
              await sendBookingCancellationEmails(
                memberEmail,
                adminEmail as string,
                {
                  bookingId: currentBooking.id,
                  className: currentBooking.session.class?.name || undefined,
                  classNameTr:
                    currentBooking.session.class?.nameTr || undefined,
                  sessionDate,
                  sessionTime,
                  location: currentBooking.session.location?.name || undefined,
                  instructor:
                    currentBooking.session.instructor?.user?.name ||
                    currentBooking.session.instructor?.user?.email ||
                    undefined,
                  paymentType: currentBooking.paymentType || undefined,
                  creditsUsed:
                    currentBooking.creditsUsed ||
                    currentBooking.creditCost ||
                    undefined,
                  creditRefunded:
                    shouldRefundCredit &&
                    currentBooking.paymentType === "CREDITS",
                },
                currentBooking.member.user.name || undefined,
                organization
              );
            }
          }
        } catch (emailError: any) {
          // Log email error but don't fail the cancellation
          console.error(
            "[EMAIL] Error sending booking cancellation emails:",
            emailError
          );
        }
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (checkedIn !== undefined) {
        updateData.checkedIn = checkedIn;
        updateData.checkedInAt = checkedIn ? new Date() : null;
      }

      const booking = await prisma.booking.updateMany({
        where,
        data: updateData,
      });

      if (booking.count === 0) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      // If confirming after cancellation, increment count
      if (status === "CONFIRMED" && currentBooking.status === "CANCELLED") {
        await prisma.session.update({
          where: { id: currentBooking.sessionId },
          data: {
            currentBookings: {
              increment: 1,
            },
          },
        });
      }

      const updatedBooking = await prisma.booking.findUnique({
        where: { id },
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
      });

      return NextResponse.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/bookings/[id] - Cancel/delete a booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrganizationContext(request, async (req, context) => {
    try {
      const where: any = {
        id,
        organizationId: context.organizationId,
      };

      // If user is not admin, only allow deletion of their own bookings
      if (context.user.role === "MEMBER") {
        where.userId = context.user.id;
      }

      const booking = await prisma.booking.findFirst({
        where,
      });

      if (!booking) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      // Delete booking
      await prisma.booking.delete({
        where: { id },
      });

      // Decrement session booking count if it was confirmed
      if (booking.status === "CONFIRMED") {
        await prisma.session.update({
          where: { id: booking.sessionId },
          data: {
            currentBookings: {
              decrement: 1,
            },
          },
        });
      }

      return NextResponse.json({ message: "Booking deleted successfully" });
    } catch (error) {
      console.error("Error deleting booking:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
