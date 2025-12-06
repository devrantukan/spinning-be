import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from './auth'

export interface RequestContext {
  user: {
    id: string
    email: string
    supabaseUserId: string
    organizationId: string
    role: string
  }
  organizationId: string
}

/**
 * Middleware to extract organization ID from request
 * Can be from query params, headers, or user's default organization
 */
export async function withOrganizationContext(
  request: NextRequest,
  handler: (req: NextRequest, context: RequestContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get organization ID from query params, headers, or user's default
    const orgIdFromQuery = request.nextUrl.searchParams.get('organizationId')
    const orgIdFromHeader = request.headers.get('x-organization-id')
    const organizationId = orgIdFromQuery || orgIdFromHeader || user.organizationId

    // Verify user has access to this organization
    // ADMIN can access all organizations, TENANT_ADMIN can only access their own
    if (organizationId !== user.organizationId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Access denied to this organization' },
        { status: 403 }
      )
    }

    const context: RequestContext = {
      user,
      organizationId
    }

    return handler(request, context)
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


