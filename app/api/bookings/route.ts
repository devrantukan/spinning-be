import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/bookings - Get all bookings for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { searchParams } = req.nextUrl
      const sessionId = searchParams.get('sessionId')
      const memberId = searchParams.get('memberId')
      const status = searchParams.get('status')

      const where: any = {
        organizationId: context.organizationId
      }

      if (sessionId) {
        where.sessionId = sessionId
      }

      if (memberId) {
        where.memberId = memberId
      }

      if (status) {
        where.status = status
      }

      // If user is not admin, only show their own bookings
      if (context.user.role === 'MEMBER') {
        where.userId = context.user.id
      }

      const bookings = await prisma.booking.findMany({
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
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return NextResponse.json(bookings)
    } catch (error) {
      console.error('Error fetching bookings:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await req.json()
      const { sessionId } = body

      if (!sessionId) {
        return NextResponse.json(
          { error: 'Missing required field: sessionId' },
          { status: 400 }
        )
      }

      // Get or create member for the user
      let member = await prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: context.organizationId
        }
      })

      if (!member) {
        member = await prisma.member.create({
          data: {
            userId: context.user.id,
            organizationId: context.organizationId,
            status: 'ACTIVE'
          }
        })
      }

      // Verify session exists and belongs to organization
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          organizationId: context.organizationId
        }
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      // Check if session is full
      if (session.currentBookings >= session.maxCapacity) {
        return NextResponse.json(
          { error: 'Session is full' },
          { status: 400 }
        )
      }

      // Check if already booked
      const existingBooking = await prisma.booking.findUnique({
        where: {
          sessionId_memberId: {
            sessionId,
            memberId: member.id
          }
        }
      })

      if (existingBooking && existingBooking.status !== 'CANCELLED') {
        return NextResponse.json(
          { error: 'Already booked for this session' },
          { status: 400 }
        )
      }

      // Create booking
      const booking = await prisma.booking.create({
        data: {
          sessionId,
          memberId: member.id,
          userId: context.user.id,
          organizationId: context.organizationId,
          status: 'CONFIRMED'
        }
      })

      // Update session booking count
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          currentBookings: {
            increment: 1
          }
        }
      })

      const bookingWithDetails = await prisma.booking.findUnique({
        where: { id: booking.id },
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

      return NextResponse.json(bookingWithDetails, { status: 201 })
    } catch (error: any) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Already booked for this session' },
          { status: 400 }
        )
      }
      console.error('Error creating booking:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}







