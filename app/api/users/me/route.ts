import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationContext } from '@/lib/middleware'

/**
 * GET /api/users/me - Get current authenticated user's information
 * This endpoint doesn't require admin access - any authenticated user can get their own info
 */
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Return the current user's information
      // This endpoint is accessible to any authenticated user
      return NextResponse.json({
        id: context.user.id,
        email: context.user.email,
        supabaseUserId: context.user.supabaseUserId,
        organizationId: context.user.organizationId,
        role: context.user.role,
      })
    } catch (error) {
      console.error('Error fetching current user:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

