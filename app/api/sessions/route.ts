import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/sessions - Get all sessions for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { searchParams } = req.nextUrl
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const classId = searchParams.get('classId')
      const status = searchParams.get('status')

      const where: any = {
        organizationId: context.organizationId
      }

      if (startDate || endDate) {
        where.startTime = {}
        if (startDate) where.startTime.gte = new Date(startDate)
        if (endDate) where.startTime.lte = new Date(endDate)
      }

      if (classId) {
        where.classId = classId
      }

      if (status) {
        where.status = status
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
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              bookings: true
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        }
      })

      return NextResponse.json(sessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check if user has permission to create sessions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN' && context.user.role !== 'INSTRUCTOR') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins and instructors can create sessions' },
          { status: 403 }
        )
      }

      const body = await req.json()
      const { classId, instructorId, locationId, startTime, endTime, maxCapacity } = body

      if (!classId || !startTime || !endTime) {
        return NextResponse.json(
          { error: 'Missing required fields: classId, startTime, endTime' },
          { status: 400 }
        )
      }

      // Verify class belongs to organization
      const classExists = await prisma.class.findFirst({
        where: {
          id: classId,
          organizationId: context.organizationId
        }
      })

      if (!classExists) {
        return NextResponse.json(
          { error: 'Class not found or does not belong to organization' },
          { status: 404 }
        )
      }

      const session = await prisma.session.create({
        data: {
          classId,
          organizationId: context.organizationId,
          instructorId: instructorId || null,
          locationId: locationId || null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          maxCapacity: maxCapacity || classExists.maxCapacity,
          currentBookings: 0,
          status: 'SCHEDULED'
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
                  email: true
                }
              }
            }
          }
        }
      })

      return NextResponse.json(session, { status: 201 })
    } catch (error) {
      console.error('Error creating session:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}


