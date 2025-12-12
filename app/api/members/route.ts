import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/members - Get all members for the organization
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

      const members = await prisma.member.findMany({
        where,
        include: {
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
    } catch (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// POST /api/members - Create a new member
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can create members
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins and tenant admins can create members' },
          { status: 403 }
        )
      }

      const body = await request.json()
      const { userId, membershipType, creditBalance = 0, status = 'ACTIVE' } = body

      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      }

      // Verify user exists and belongs to the organization
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          organizationId: true,
          role: true
        }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Verify user belongs to the same organization (for tenant admins)
      if (context.user.role === 'TENANT_ADMIN' && user.organizationId !== context.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: User does not belong to your organization' },
          { status: 403 }
        )
      }

      // Check if member already exists for this user in this organization
      const existingMember = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: context.organizationId
          }
        }
      })

      if (existingMember) {
        return NextResponse.json(
          { error: 'Member already exists for this user in this organization' },
          { status: 400 }
        )
      }

      const finalCreditBalance = Math.round(typeof creditBalance === 'number' ? creditBalance : parseFloat(creditBalance) || 0)

      // Create member and transaction in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create member
        const member = await tx.member.create({
          data: {
            userId,
            organizationId: context.organizationId,
            membershipType: membershipType || null,
            creditBalance: finalCreditBalance,
            status: status as any
          },
          include: {
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
          }
        })

        // Create transaction record if credit balance > 0
        if (finalCreditBalance > 0) {
          await tx.creditTransaction.create({
            data: {
              memberId: member.id,
              organizationId: context.organizationId,
              amount: finalCreditBalance,
              balanceBefore: 0,
              balanceAfter: finalCreditBalance,
              type: 'MANUAL_ADD',
              description: 'Initial credit balance',
              performedByUserId: context.user.id
            }
          })
        }

        return member
      })

      return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'Member already exists for this user in this organization' },
          { status: 400 }
        )
      }
      console.error('Error creating member:', error)
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      )
    }
  })
}







