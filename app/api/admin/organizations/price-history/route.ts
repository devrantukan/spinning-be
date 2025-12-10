import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET /api/admin/organizations/price-history - Get price history for the authenticated user's organization
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Get price history for the user's organization
    const priceHistory = await prisma.priceHistory.findMany({
      where: {
        organizationId: user.organizationId,
      },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(priceHistory)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching price history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

