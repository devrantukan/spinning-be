import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

// GET /api/users/[id]/invitation-status - Get invitation status for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    
    // Only admins and tenant admins can check invitation status
    if (user.role !== 'ADMIN' && user.role !== 'TENANT_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can check invitation status' },
        { status: 403 }
      )
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // If tenant admin, verify user belongs to their organization
    if (user.role === 'TENANT_ADMIN' && dbUser.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only check invitation status for users in your organization' },
        { status: 403 }
      )
    }

    // Get Supabase admin client
    const supabase = createServerClient()

    // Check user status in Supabase
    try {
      const { data, error } = await supabase.auth.admin.getUserById(dbUser.supabaseUserId)
      
      if (error) {
        console.error('Supabase getUserById error:', error)
        // Return a status even on error so UI doesn't hang
        return NextResponse.json({
          hasInvitation: false,
          emailConfirmed: false,
          needsResend: false,
          error: true,
          message: error.message || 'User not found in Supabase'
        })
      }

      if (!data?.user) {
        return NextResponse.json({
          hasInvitation: false,
          emailConfirmed: false,
          needsResend: true,
          message: 'User not found in Supabase'
        })
      }

      const supabaseUser = data.user
      const emailConfirmed = !!supabaseUser.email_confirmed_at
      const needsResend = !emailConfirmed

      return NextResponse.json({
        hasInvitation: true,
        emailConfirmed,
        needsResend,
        lastSignIn: supabaseUser.last_sign_in_at,
        createdAt: supabaseUser.created_at,
        emailConfirmedAt: supabaseUser.email_confirmed_at
      })
    } catch (error: any) {
      console.error('Error checking Supabase user:', error)
      // Return a status even on error so UI doesn't hang
      return NextResponse.json({
        hasInvitation: false,
        emailConfirmed: false,
        needsResend: false,
        error: true,
        message: error.message || 'Failed to check user status'
      })
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error in invitation status check:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

