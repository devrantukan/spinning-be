import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/members/[id] - Get a specific member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params
      const member = await prisma.member.findUnique({
        where: { id },
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

      if (!member) {
        return NextResponse.json(
          { error: 'Member not found' },
          { status: 404 }
        )
      }

      // Verify member belongs to the organization
      if (member.organizationId !== context.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Member does not belong to your organization' },
          { status: 403 }
        )
      }

      return NextResponse.json(member)
    } catch (error) {
      console.error('Error fetching member:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH /api/members/[id] - Update a member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params
      
      // Validate ID
      if (!id || id === 'undefined' || id === 'null') {
        return NextResponse.json(
          { error: 'Invalid member ID' },
          { status: 400 }
        )
      }

      // Only admins and tenant admins can update members
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins and tenant admins can update members' },
          { status: 403 }
        )
      }

      const body = await request.json()
      const { membershipType, creditBalance, creditChange, description, status } = body

      // Get current member to check existing balance - use findUnique without select first to verify field exists
      const existingMember = await prisma.member.findUnique({
        where: { id }
      })

      if (!existingMember) {
        return NextResponse.json(
          { error: 'Member not found' },
          { status: 404 }
        )
      }

      if (existingMember.organizationId !== context.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Member does not belong to your organization' },
          { status: 403 }
        )
      }

      // Extract balance (handle both old and new Prisma clients)
      const oldBalance = (existingMember as any).creditBalance ?? 0

      const updateData: any = {}
      if (membershipType !== undefined) {
        updateData.membershipType = membershipType || null
      }
      
      let transactionType: string | null = null
      let transactionAmount: number | null = null
      let transactionDescription = description || null

      // Handle credit balance changes
      if (creditBalance !== undefined) {
        const newBalance = typeof creditBalance === 'number' ? creditBalance : parseFloat(creditBalance) || 0
        
        if (newBalance !== oldBalance) {
          updateData.creditBalance = newBalance
          const difference = newBalance - oldBalance
          
          if (difference > 0) {
            transactionType = 'MANUAL_ADD'
            transactionAmount = difference
            if (!transactionDescription) {
              transactionDescription = 'Credit added manually'
            }
          } else if (difference < 0) {
            transactionType = 'MANUAL_DEDUCT'
            transactionAmount = Math.abs(difference)
            if (!transactionDescription) {
              transactionDescription = 'Credit deducted manually'
            }
          }
        }
      } else if (creditChange !== undefined) {
        // Alternative: specify creditChange (positive to add, negative to deduct)
        const changeAmount = typeof creditChange === 'number' ? creditChange : parseFloat(creditChange) || 0
        if (changeAmount !== 0) {
          const newBalance = oldBalance + changeAmount
          updateData.creditBalance = Math.max(0, newBalance) // Prevent negative balance
          
          if (changeAmount > 0) {
            transactionType = 'MANUAL_ADD'
            transactionAmount = changeAmount
            if (!transactionDescription) {
              transactionDescription = 'Credit added manually'
            }
          } else {
            transactionType = 'MANUAL_DEDUCT'
            transactionAmount = Math.abs(changeAmount)
            if (!transactionDescription) {
              transactionDescription = 'Credit deducted manually'
            }
          }
        }
      }

      if (status !== undefined) {
        updateData.status = status
      }

      // Update member and create transaction record in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const member = await tx.member.update({
          where: { id },
          data: updateData,
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

        // Create transaction record if credit balance changed
        if (transactionType && transactionAmount !== null) {
          await tx.creditTransaction.create({
            data: {
              memberId: member.id,
              organizationId: context.organizationId,
              amount: transactionAmount * (transactionType === 'MANUAL_ADD' ? 1 : -1),
              balanceBefore: oldBalance,
              balanceAfter: (member as any).creditBalance ?? 0,
              type: transactionType as any,
              description: transactionDescription,
              performedByUserId: context.user.id
            }
          })
        }

        return member
      })

      return NextResponse.json(result)
    } catch (error: any) {
      console.error('Error updating member:', error)
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// DELETE /api/members/[id] - Delete a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params
      
      // Only admins and tenant admins can delete members
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins and tenant admins can delete members' },
          { status: 403 }
        )
      }

      // Verify member exists and belongs to organization
      const existingMember = await prisma.member.findUnique({
        where: { id },
        select: {
          id: true,
          organizationId: true
        }
      })

      if (!existingMember) {
        return NextResponse.json(
          { error: 'Member not found' },
          { status: 404 }
        )
      }

      if (existingMember.organizationId !== context.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Member does not belong to your organization' },
          { status: 403 }
        )
      }

      await prisma.member.delete({
        where: { id }
      })

      return NextResponse.json({ success: true })
    } catch (error: any) {
      console.error('Error deleting member:', error)
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      )
    }
  })
}


