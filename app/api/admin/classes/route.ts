import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET /api/admin/classes - Get all classes (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admins can view all classes
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can view all classes' },
        { status: 403 }
      )
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const organizationId = searchParams.get('organizationId')

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (organizationId) {
      where.organizationId = organizationId
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
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
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


