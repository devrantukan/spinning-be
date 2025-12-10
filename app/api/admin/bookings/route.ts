import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET /api/admin/bookings - Get all bookings across all organizations (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admins can view all bookings
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can view all bookings' },
        { status: 403 }
      )
    }

    const { searchParams } = request.nextUrl
    const sessionId = searchParams.get('sessionId')
    const memberId = searchParams.get('memberId')
    const status = searchParams.get('status')
    const organizationId = searchParams.get('organizationId')

    const where: any = {}

    if (sessionId) {
      where.sessionId = sessionId
    }

    if (memberId) {
      where.memberId = memberId
    }

    if (status) {
      where.status = status
    }

    if (organizationId) {
      where.organizationId = organizationId
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
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
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(bookings)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

