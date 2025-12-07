import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

// POST /api/users/[id]/resend-invitation - Resend invitation email to user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    
    // Only admins and tenant admins can resend invitations
    if (user.role !== 'ADMIN' && user.role !== 'TENANT_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can resend invitations' },
        { status: 403 }
      )
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
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
        { error: 'Forbidden: You can only resend invitations for users in your organization' },
        { status: 403 }
      )
    }

    // Get Supabase admin client
    const supabase = createServerClient()

    // Check if user exists in Supabase and get their status
    let supabaseUser
    try {
      const { data, error } = await supabase.auth.admin.getUserById(dbUser.supabaseUserId)
      if (error || !data?.user) {
        // User might not exist in Supabase yet, try to invite them
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
          dbUser.email,
          {
            data: {
              name: dbUser.name || null,
              organizationId: dbUser.organizationId,
              role: dbUser.role,
            },
          }
        )

        if (inviteError) {
          console.error('Error inviting user:', inviteError)
          return NextResponse.json(
            { error: `Failed to send invitation: ${inviteError.message}` },
            { status: 400 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Invitation sent successfully',
          user: inviteData.user
        })
      }
      supabaseUser = data.user
    } catch (error: any) {
      console.error('Error checking Supabase user:', error)
      return NextResponse.json(
        { error: 'Failed to check user status' },
        { status: 500 }
      )
    }

    // Check if user has confirmed their email
    if (supabaseUser.email_confirmed_at) {
      return NextResponse.json(
        { error: 'User has already confirmed their email. Invitation not needed.' },
        { status: 400 }
      )
    }

    // Resend invitation using Supabase Admin API
    // For users who haven't confirmed, we can use inviteUserByEmail again
    // Supabase will resend the invitation email if the user already exists
    try {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        dbUser.email,
        {
          data: {
            name: dbUser.name || null,
            organizationId: dbUser.organizationId,
            role: dbUser.role,
          },
        }
      )

      if (inviteError) {
        // If invite fails, try using generateLink as fallback
        console.warn('inviteUserByEmail failed, trying generateLink:', inviteError)
        
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email: dbUser.email,
          options: {
            data: {
              name: dbUser.name || null,
              organizationId: dbUser.organizationId,
              role: dbUser.role,
            },
          },
        })

        if (linkError) {
          return NextResponse.json(
            { error: `Failed to resend invitation: ${linkError.message}` },
            { status: 400 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Invitation link generated successfully',
          link: linkData.properties?.action_link
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation resent successfully',
        user: inviteData.user
      })
    } catch (error: any) {
      console.error('Error resending invitation:', error)
      return NextResponse.json(
        { error: `Failed to resend invitation: ${error.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error in resend invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

