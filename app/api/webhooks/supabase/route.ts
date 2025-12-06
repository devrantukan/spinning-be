import { NextRequest, NextResponse } from 'next/server'
import { syncUserFromSupabase } from '@/lib/sync-user'
import { prisma } from '@/lib/prisma'

/**
 * Webhook endpoint for Supabase auth events
 * Configure this in your Supabase dashboard: Settings > Database > Webhooks
 * 
 * This endpoint handles:
 * - auth.users INSERT (new user signup)
 * - auth.users UPDATE (user profile updates)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if you set one in Supabase
    const webhookSecret = request.headers.get('x-webhook-secret')
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, table, record } = body

    // Handle new user signup
    if (type === 'INSERT' && table === 'auth.users') {
      const supabaseUserId = record.id
      const email = record.email
      
      // You may need to get organizationId from metadata or another source
      // For now, this is a placeholder - adjust based on your signup flow
      const organizationId = record.raw_user_meta_data?.organizationId

      if (!organizationId) {
        console.warn('No organizationId found in user metadata')
        return NextResponse.json(
          { error: 'Organization ID required' },
          { status: 400 }
        )
      }

      await syncUserFromSupabase(
        supabaseUserId,
        email,
        organizationId,
        record.raw_user_meta_data?.name
      )

      return NextResponse.json({ success: true })
    }

    // Handle user updates
    if (type === 'UPDATE' && table === 'auth.users') {
      const supabaseUserId = record.id
      const email = record.email

      await prisma.user.updateMany({
        where: { supabaseUserId },
        data: {
          email,
          name: record.raw_user_meta_data?.name || null
        }
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ message: 'Event not handled' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

