import { prisma } from './prisma'
import { createServerClient } from './supabase'

/**
 * Sync user from Supabase auth to database
 * This should be called after a user signs up in Supabase
 * You can set this up as a Supabase webhook or call it from your signup flow
 */
export async function syncUserFromSupabase(
  supabaseUserId: string,
  email: string,
  organizationId: string,
  name?: string
) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { supabaseUserId }
    })

    if (existingUser) {
      return existingUser
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        supabaseUserId,
        email,
        name: name || null,
        organizationId,
        role: 'MEMBER'
      }
    })

    return user
  } catch (error) {
    console.error('Error syncing user from Supabase:', error)
    throw error
  }
}

/**
 * Get or create organization
 * Useful for initial setup
 */
export async function getOrCreateOrganization(
  name: string,
  slug: string
) {
  try {
    let organization = await prisma.organization.findUnique({
      where: { slug }
    })

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name,
          slug
        }
      })
    }

    return organization
  } catch (error) {
    console.error('Error getting or creating organization:', error)
    throw error
  }
}



