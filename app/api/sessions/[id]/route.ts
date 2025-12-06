import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/sessions/[id] - Get a specific session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withOrganizationContext(request, async (req, context) => {
    try {
      const session = await prisma.session.findFirst({
        where: {
          id,
          organizationId: context.organizationId
        },
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
          },
          bookings: {
            include: {
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
          }
        }
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(session)
    } catch (error) {
      console.error('Error fetching session:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH /api/sessions/[id] - Update a session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'INSTRUCTOR') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins and instructors can update sessions' },
          { status: 403 }
        )
      }

      const body = await req.json()
      const { startTime, endTime, instructorId, status, maxCapacity } = body

      const updateData: any = {}
      if (startTime) updateData.startTime = new Date(startTime)
      if (endTime) updateData.endTime = new Date(endTime)
      if (instructorId !== undefined) updateData.instructorId = instructorId
      if (status) updateData.status = status
      if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity

      const session = await prisma.session.updateMany({
        where: {
          id,
          organizationId: context.organizationId
        },
        data: updateData
      })

      if (session.count === 0) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      const updatedSession = await prisma.session.findUnique({
        where: { id },
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
      })

      return NextResponse.json(updatedSession)
    } catch (error) {
      console.error('Error updating session:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins can delete sessions
      if (context.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can delete sessions' },
          { status: 403 }
        )
      }

      const session = await prisma.session.deleteMany({
        where: {
          id,
          organizationId: context.organizationId
        }
      })

      if (session.count === 0) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ message: 'Session deleted successfully' })
    } catch (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

