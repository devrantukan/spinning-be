import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

// Debug endpoint to check token and user status
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'No authorization header',
        hasToken: false
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    
    // Verify token
    const { data: { user: supabaseUser }, error: tokenError } = await supabase.auth.getUser(token)
    
    if (tokenError || !supabaseUser) {
      return NextResponse.json({
        error: 'Token verification failed',
        tokenError: tokenError?.message,
        hasToken: true,
        tokenValid: false
      }, { status: 401 })
    }

    // Check if user exists in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: supabaseUser.id },
      include: { organization: true }
    })

    return NextResponse.json({
      success: true,
      tokenValid: true,
      supabaseUser: {
        id: supabaseUser.id,
        email: supabaseUser.email
      },
      dbUser: dbUser ? {
        id: dbUser.id,
        email: dbUser.email,
        organizationId: dbUser.organizationId,
        role: dbUser.role,
        organization: dbUser.organization
      } : null,
      userExistsInDb: !!dbUser,
      message: dbUser 
        ? 'User found in database' 
        : 'User authenticated but not found in database. User will be created on first API call.'
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Internal error',
      message: error.message
    }, { status: 500 })
  }
}



