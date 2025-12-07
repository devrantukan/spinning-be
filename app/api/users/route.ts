import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/users - Get all users for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins can view all users
      if (context.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can view users' },
          { status: 403 }
        )
      }

      const { searchParams } = req.nextUrl
      const role = searchParams.get('role')

      const where: any = {
        organizationId: context.organizationId
      }

      if (role) {
        where.role = role
      }

      const users = await prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              memberships: true,
              bookings: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return NextResponse.json(users)
    } catch (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}



