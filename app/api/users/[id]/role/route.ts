import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// PATCH /api/users/[id]/role - Update user role (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can update user roles
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can update user roles' },
          { status: 403 }
        )
      }
      
      const body = await req.json()
      const { role } = body
      
      // TENANT_ADMIN can only set roles within their organization and cannot set ADMIN role
      if (context.user.role === 'TENANT_ADMIN' && role === 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Tenant admins cannot assign ADMIN role' },
          { status: 403 }
        )
      }

      if (!role || !['ADMIN', 'TENANT_ADMIN', 'INSTRUCTOR', 'MEMBER'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be ADMIN, TENANT_ADMIN, INSTRUCTOR, or MEMBER' },
          { status: 400 }
        )
      }

      // Verify user belongs to the same organization
      const user = await prisma.user.findFirst({
        where: {
          id,
          organizationId: context.organizationId
        }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Update user role
      const updated = await prisma.user.update({
        where: { id },
        data: { role }
      })

      return NextResponse.json(updated)
    } catch (error) {
      console.error('Error updating user role:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

