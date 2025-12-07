import { NextRequest } from 'next/server'
import { createAuthClient } from './supabase'
import { prisma } from './prisma'

export interface AuthUser {
  id: string
  email: string
  supabaseUserId: string
  organizationId: string
  role: string
}

/**
 * Get authenticated user from Supabase session
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Use anon key client for token verification (service role bypasses auth checks)
    const supabase = createAuthClient()
    
    // Verify the token with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.error('Token verification error:', error.message, error.status)
      return null
    }
    
    if (!supabaseUser) {
      console.error('No user found after token verification')
      return null
    }

    // Get user from database with organization
    let dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: supabaseUser.id },
      include: { organization: true }
    })

    // If user doesn't exist in database, try to create them
    // This handles the case where user authenticated but wasn't synced yet
    if (!dbUser) {
      console.log(`User ${supabaseUser.id} not found in database, creating...`)
      
      // Try to get or create a default organization
      let organization = await prisma.organization.findFirst()
      
      if (!organization) {
        // Create a default organization if none exists
        organization = await prisma.organization.create({
          data: {
            name: 'Default Organization',
            slug: 'default-org'
          }
        })
        console.log('Created default organization:', organization.id)
      }

      // Create user in database
      try {
        dbUser = await prisma.user.create({
          data: {
            supabaseUserId: supabaseUser.id,
            email: supabaseUser.email || '',
            name: supabaseUser.user_metadata?.name || null,
            organizationId: organization.id,
            role: 'MEMBER'
          },
          include: { organization: true }
        })
        console.log('Created user in database:', dbUser.id)
      } catch (createError: any) {
        console.error('Error creating user:', createError)
        // If creation fails (e.g., duplicate), try to fetch again
        dbUser = await prisma.user.findUnique({
          where: { supabaseUserId: supabaseUser.id },
          include: { organization: true }
        })
      }
    }

    if (!dbUser) {
      return null
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      supabaseUserId: dbUser.supabaseUserId,
      organizationId: dbUser.organizationId,
      role: dbUser.role
    }
  } catch (error) {
    console.error('Error getting auth user:', error)
    return null
  }
}

/**
 * Require authentication and return user or throw error
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

/**
 * Require specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthUser> {
  const user = await requireAuth(request)
  
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions')
  }
  
  return user
}

