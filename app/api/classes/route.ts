import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/classes - Get all classes for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { searchParams } = req.nextUrl
      const status = searchParams.get('status')

      const where: any = {
        organizationId: context.organizationId
      }

      if (status) {
        where.status = status
      }

      const classes = await prisma.class.findMany({
        where,
        include: {
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
              sessions: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      })

      return NextResponse.json(classes)
    } catch (error) {
      console.error('Error fetching classes:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// POST /api/classes - Create a new class
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'INSTRUCTOR') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins and instructors can create classes' },
          { status: 403 }
        )
      }

      const body = await req.json()
      const { name, description, duration, maxCapacity, instructorId } = body

      if (!name || !duration) {
        return NextResponse.json(
          { error: 'Missing required fields: name, duration' },
          { status: 400 }
        )
      }

      const classData: any = {
        name,
        description: description || null,
        duration: parseInt(duration),
        maxCapacity: maxCapacity || 20,
        organizationId: context.organizationId,
        status: 'ACTIVE'
      }

      if (instructorId) {
        // Verify instructor belongs to organization
        const instructor = await prisma.instructor.findFirst({
          where: {
            id: instructorId,
            organizationId: context.organizationId
          }
        })

        if (!instructor) {
          return NextResponse.json(
            { error: 'Instructor not found or does not belong to organization' },
            { status: 404 }
          )
        }

        classData.instructorId = instructorId
      }

      const newClass = await prisma.class.create({
        data: classData,
        include: {
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

      return NextResponse.json(newClass, { status: 201 })
    } catch (error) {
      console.error('Error creating class:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

