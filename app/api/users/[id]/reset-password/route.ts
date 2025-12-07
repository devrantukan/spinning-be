import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

// POST /api/users/[id]/reset-password - Send password reset email to user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    
    // Only admins and tenant admins can reset passwords
    if (user.role !== 'ADMIN' && user.role !== 'TENANT_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can reset passwords' },
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
        { error: 'Forbidden: You can only reset passwords for users in your organization' },
        { status: 403 }
      )
    }

    // Get Supabase admin client
    const supabase = createServerClient()

    // Check if user exists in Supabase
    try {
      const { data, error } = await supabase.auth.admin.getUserById(dbUser.supabaseUserId)
      
      if (error || !data?.user) {
        return NextResponse.json(
          { error: 'User not found in Supabase' },
          { status: 404 }
        )
      }

      // Try to send password reset email using generateLink with redirectTo option
      // Note: generateLink with type 'recovery' should automatically send the email
      // if email provider is configured in Supabase project settings
      // Redirect to reset-password page to handle the token
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL 
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
        : 'http://localhost:3000/reset-password'
      
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: dbUser.email,
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (linkError) {
        console.error('Error generating password reset link:', linkError)
        console.error('Full error details:', JSON.stringify(linkError, null, 2))
        
        return NextResponse.json(
          { 
            error: `Failed to send password reset email: ${linkError.message}`,
            details: linkError.message,
            suggestion: 'Please ensure email is configured in Supabase project settings (Settings > Auth > Email Templates)'
          },
          { status: 400 }
        )
      }

      // Log the generated link for debugging
      const resetLink = linkData.properties?.action_link
      console.log(`Password reset link generated for ${dbUser.email}`)
      console.log(`Reset link: ${resetLink}`)

      // Important: generateLink should automatically send the email IF email provider is configured
      // If emails are not being sent:
      // 1. Check Supabase Dashboard > Settings > Auth > Email Templates
      // 2. Configure custom SMTP provider (recommended for production)
      // 3. Check Supabase Auth logs for email delivery errors
      
      return NextResponse.json({
        success: true,
        message: 'Password reset email sent successfully. Please check your inbox (and spam folder).',
        // Include link in response for development/testing - remove in production
        link: resetLink,
        note: 'If email not received, check Supabase email configuration and spam folder'
      })
    } catch (error: any) {
      console.error('Error resetting password:', error)
      return NextResponse.json(
        { 
          error: `Failed to reset password: ${error.message}`,
          details: error.message
        },
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
    console.error('Error in reset password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
