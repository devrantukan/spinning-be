import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET /api/admin/members - Get all members across all organizations (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admins can view all members
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can view all members' },
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

    const members = await prisma.member.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        _count: {
          select: {
            bookings: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(members)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error fetching members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

