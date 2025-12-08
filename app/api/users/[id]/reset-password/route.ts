import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

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

    // Get user from database with organization SMTP settings
    const dbUser = await prisma.user.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            // SMTP Configuration
            smtpHost: true,
            smtpPort: true,
            smtpUser: true,
            smtpPassword: true,
            smtpFromEmail: true,
            smtpFromName: true,
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

      // Generate password reset link using generateLink
      // IMPORTANT: generateLink does NOT send emails automatically!
      // Supabase will only send the email if SMTP is configured in Dashboard:
      // - Go to: Authentication > Emails > SMTP Settings
      // - Enable "Custom SMTP" and configure your SMTP provider (SendGrid, Mailgun, Resend, etc.)
      // Without SMTP configured, the link will be generated but no email will be sent
      // Redirect to reset-password page to handle the token
      // Get tenant URL from request header (preferred), body, or environment variable
      // Priority: Header > Body > Environment Variable
      let tenantUrlRaw: string | null = null
      
      // Check header first (most reliable, doesn't consume request body)
      const tenantUrlFromHeader = request.headers.get('X-Tenant-URL')
      console.log(`[RESET_PASSWORD] Checking for tenant URL:`, {
        headerPresent: !!tenantUrlFromHeader,
        headerValue: tenantUrlFromHeader,
        envTenantUrl: process.env.TENANT_URL,
        envNextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL
      })
      
      if (tenantUrlFromHeader) {
        tenantUrlRaw = tenantUrlFromHeader
      } else {
        // Try to read from body (only if header not present)
        try {
          // Clone the request to read body without consuming it
          const clonedRequest = request.clone()
          const body = await clonedRequest.json().catch(() => ({}))
          if (body && body.tenantUrl) {
            tenantUrlRaw = body.tenantUrl
            console.log(`[RESET_PASSWORD] Found tenant URL in body:`, body.tenantUrl)
          }
        } catch (e) {
          // Body might be empty or already consumed, that's okay
          console.log(`[RESET_PASSWORD] Could not read body:`, e)
        }
        
        // Fall back to environment variables
        if (!tenantUrlRaw) {
          tenantUrlRaw = process.env.TENANT_URL || process.env.NEXT_PUBLIC_SITE_URL || null
          if (tenantUrlRaw) {
            console.log(`[RESET_PASSWORD] Using tenant URL from environment:`, tenantUrlRaw)
          }
        }
      }
      
      // Normalize the URL (remove trailing slash if present)
      const tenantUrl = tenantUrlRaw ? tenantUrlRaw.replace(/\/$/, '') : null
      
      const redirectUrl = tenantUrl
        ? `${tenantUrl}/reset-password`
        : 'http://localhost:3000/reset-password'
      
      console.log(`[RESET_PASSWORD] Final redirect URL: ${redirectUrl}`, {
        fromHeader: !!tenantUrlFromHeader,
        tenantUrlRaw,
        tenantUrl,
        redirectUrl
      })
      
      // Generate password reset link
      // IMPORTANT: redirectTo URL must be whitelisted in Supabase Dashboard:
      // Authentication > URL Configuration > Redirect URLs
      // Also check: Authentication > Settings > Site URL (should not override redirectTo)
      console.log(`[RESET_PASSWORD] Calling generateLink with:`, {
        type: 'recovery',
        email: dbUser.email,
        redirectTo: redirectUrl
      })
      
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
            suggestion: 'Please ensure email is configured in Supabase project settings (Settings > Auth > Email Templates) and that redirectTo URL is whitelisted in Authentication > URL Configuration > Redirect URLs'
          },
          { status: 400 }
        )
      }

      // Log the generated link for debugging
      let resetLink = linkData.properties?.action_link
      console.log(`[RESET_PASSWORD] Link generated for ${dbUser.email}`)
      console.log(`[RESET_PASSWORD] Original generated link: ${resetLink}`)
      
      // Check if the redirect URL in the generated link matches what we requested
      // If not, manually fix it (Supabase might be using Site URL from dashboard instead of redirectTo)
      if (resetLink) {
        try {
          const urlObj = new URL(resetLink)
          const redirectParam = urlObj.searchParams.get('redirect_to')
          
          if (redirectParam && redirectParam !== redirectUrl) {
            console.warn(`[RESET_PASSWORD] Redirect URL mismatch detected!`, {
              requested: redirectUrl,
              actual: redirectParam,
              message: 'Supabase used a different redirect URL. Fixing it manually.'
            })
            
            // Replace the redirect_to parameter with our correct URL
            urlObj.searchParams.set('redirect_to', redirectUrl)
            resetLink = urlObj.toString()
            
            console.log(`[RESET_PASSWORD] Fixed link with correct redirect URL: ${resetLink}`)
          } else if (!redirectParam) {
            // If no redirect_to param exists, add it
            urlObj.searchParams.set('redirect_to', redirectUrl)
            resetLink = urlObj.toString()
            console.log(`[RESET_PASSWORD] Added redirect_to parameter to link: ${resetLink}`)
          }
        } catch (e) {
          console.error(`[RESET_PASSWORD] Error parsing/fixing link:`, e)
          // Continue with original link if parsing fails
        }
      }

      // Send password reset email directly using our SMTP configuration
      // This bypasses Supabase's email sending and uses our own SMTP server
      if (!resetLink) {
        return NextResponse.json(
          { error: 'Failed to generate password reset link' },
          { status: 500 }
        )
      }

      console.log(`[RESET_PASSWORD] Sending password reset email to ${dbUser.email} via SMTP`)
      // Use organization SMTP settings if available, otherwise fallback to env vars
      const emailResult = await sendPasswordResetEmail(
        dbUser.email,
        resetLink,
        dbUser.name || undefined,
        dbUser.organization // Pass organization SMTP config
      )

      if (!emailResult.success) {
        // If email sending fails, still return success but include the link
        // This allows admin to manually send the link if needed
        console.error(`[RESET_PASSWORD] Failed to send email:`, emailResult.error)
        
        return NextResponse.json({
          success: true,
          message: 'Password reset link generated, but email sending failed.',
          link: resetLink,
          emailSent: false,
          emailError: emailResult.error,
          warning: 'Please configure SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD) or send the link manually.',
        })
      }

      console.log(`[RESET_PASSWORD] Password reset email sent successfully to ${dbUser.email}`)
      
      return NextResponse.json({
        success: true,
        message: 'Password reset email sent successfully. Please check your inbox (and spam folder).',
        emailSent: true,
        // Include link in response for development/testing only
        ...(process.env.NODE_ENV === 'development' && { link: resetLink }),
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
