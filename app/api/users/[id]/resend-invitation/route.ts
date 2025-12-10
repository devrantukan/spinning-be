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

    // Get organization SMTP settings
    const organization = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        name: true,
        language: true,
      },
    })

    // Get TENANT_URL from request header, body, or environment
    let tenantUrlRaw: string | null = null
    const tenantUrlFromHeader = request.headers.get('X-Tenant-URL')
    
    if (tenantUrlFromHeader) {
      tenantUrlRaw = tenantUrlFromHeader
    } else {
      try {
        const clonedRequest = request.clone()
        const body = await clonedRequest.json().catch(() => ({}))
        if (body && body.tenantUrl) {
          tenantUrlRaw = body.tenantUrl
        }
      } catch (e) {
        // Body might be empty or already consumed
      }
      
      if (!tenantUrlRaw) {
        tenantUrlRaw = process.env.TENANT_URL || process.env.NEXT_PUBLIC_SITE_URL || null
      }
    }
    
    const tenantUrl = tenantUrlRaw ? tenantUrlRaw.replace(/\/$/, '') : null
    const redirectUrl = tenantUrl ? `${tenantUrl}/accept-invitation` : 'http://localhost:3000/accept-invitation'

    // Get Supabase admin client
    const supabase = createServerClient()

    // Check if user exists in Supabase and get their status
    let supabaseUser
    try {
      const { data, error } = await supabase.auth.admin.getUserById(dbUser.supabaseUserId)
      if (error || !data?.user) {
        // User might not exist in Supabase yet, generate invitation link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email: dbUser.email,
          options: {
            redirectTo: redirectUrl,
            data: {
              name: dbUser.name || null,
              organizationId: dbUser.organizationId,
              role: dbUser.role,
            },
          },
        })

        if (linkError || !linkData?.properties?.action_link) {
          console.error('Error generating invitation link:', linkError)
          return NextResponse.json(
            { error: `Failed to send invitation: ${linkError?.message || 'Unknown error'}` },
            { status: 400 }
          )
        }

        // Send invitation email via SMTP
        const { sendInvitationEmail } = await import('@/lib/email')
        const emailResult = await sendInvitationEmail(
          dbUser.email,
          linkData.properties.action_link,
          dbUser.name || undefined,
          organization
        )

        if (!emailResult.success) {
          return NextResponse.json(
            { 
              error: 'Invitation link generated but email sending failed',
              details: emailResult.error,
              link: linkData.properties.action_link // Return link so admin can send manually
            },
            { status: 400 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Invitation sent successfully',
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

    // Generate invitation link and send via SMTP
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: dbUser.email,
        options: {
          redirectTo: redirectUrl,
          data: {
            name: dbUser.name || null,
            organizationId: dbUser.organizationId,
            role: dbUser.role,
          },
        },
      })

      if (linkError || !linkData?.properties?.action_link) {
        return NextResponse.json(
          { error: `Failed to generate invitation link: ${linkError?.message || 'Unknown error'}` },
          { status: 400 }
        )
      }

      // Send invitation email via SMTP
      const { sendInvitationEmail } = await import('@/lib/email')
      const emailResult = await sendInvitationEmail(
        dbUser.email,
        linkData.properties.action_link,
        dbUser.name || undefined,
        organization
      )

      if (!emailResult.success) {
        return NextResponse.json(
          { 
            error: 'Invitation link generated but email sending failed',
            details: emailResult.error,
            link: linkData.properties.action_link // Return link so admin can send manually
          },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation resent successfully via SMTP',
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

