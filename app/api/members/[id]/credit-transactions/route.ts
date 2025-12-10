import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/members/[id]/credit-transactions - Get credit transaction history for a member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params
      
      // Verify member exists and belongs to organization
      const member = await prisma.member.findUnique({
        where: { id },
        select: {
          id: true,
          organizationId: true
        }
      })

      if (!member) {
        return NextResponse.json(
          { error: 'Member not found' },
          { status: 404 }
        )
      }

      if (member.organizationId !== context.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Member does not belong to your organization' },
          { status: 403 }
        )
      }

      // Get transaction history
      const transactions = await prisma.creditTransaction.findMany({
        where: {
          memberId: id,
          organizationId: context.organizationId
        },
        include: {
          performedBy: {
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

      return NextResponse.json(transactions)
    } catch (error) {
      console.error('Error fetching credit transactions:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

