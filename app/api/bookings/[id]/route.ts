import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/bookings/[id] - Get a specific booking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const where: any = {
        id: params.id,
        organizationId: context.organizationId
      }

      // If user is not admin, only allow access to their own bookings
      if (context.user.role === 'MEMBER') {
        where.userId = context.user.id
      }

      const booking = await prisma.booking.findFirst({
        where,
        include: {
          session: {
            include: {
              class: true,
              instructor: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      })

      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(booking)
    } catch (error) {
      console.error('Error fetching booking:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH /api/bookings/[id] - Update a booking (cancel, check-in, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json()
      const { status, checkedIn } = body

      const where: any = {
        id: params.id,
        organizationId: context.organizationId
      }

      // If user is not admin, only allow updates to their own bookings
      if (context.user.role === 'MEMBER') {
        where.userId = context.user.id
      }

      // Get current booking
      const currentBooking = await prisma.booking.findFirst({
        where
      })

      if (!currentBooking) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        )
      }

      const updateData: any = {}
      if (status) updateData.status = status
      if (checkedIn !== undefined) {
        updateData.checkedIn = checkedIn
        updateData.checkedInAt = checkedIn ? new Date() : null
      }

      const booking = await prisma.booking.updateMany({
        where,
        data: updateData
      })

      if (booking.count === 0) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        )
      }

      // If cancelling, decrement session booking count
      if (status === 'CANCELLED' && currentBooking.status !== 'CANCELLED') {
        await prisma.session.update({
          where: { id: currentBooking.sessionId },
          data: {
            currentBookings: {
              decrement: 1
            }
          }
        })
      }

      // If confirming after cancellation, increment count
      if (status === 'CONFIRMED' && currentBooking.status === 'CANCELLED') {
        await prisma.session.update({
          where: { id: currentBooking.sessionId },
          data: {
            currentBookings: {
              increment: 1
            }
          }
        })
      }

      const updatedBooking = await prisma.booking.findUnique({
        where: { id: params.id },
        include: {
          session: {
            include: {
              class: true
            }
          },
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      })

      return NextResponse.json(updatedBooking)
    } catch (error) {
      console.error('Error updating booking:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// DELETE /api/bookings/[id] - Cancel/delete a booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const where: any = {
        id: params.id,
        organizationId: context.organizationId
      }

      // If user is not admin, only allow deletion of their own bookings
      if (context.user.role === 'MEMBER') {
        where.userId = context.user.id
      }

      const booking = await prisma.booking.findFirst({
        where
      })

      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        )
      }

      // Delete booking
      await prisma.booking.delete({
        where: { id: params.id }
      })

      // Decrement session booking count if it was confirmed
      if (booking.status === 'CONFIRMED') {
        await prisma.session.update({
          where: { id: booking.sessionId },
          data: {
            currentBookings: {
              decrement: 1
            }
          }
        })
      }

      return NextResponse.json({ message: 'Booking deleted successfully' })
    } catch (error) {
      console.error('Error deleting booking:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

