import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/seat-layouts/[id]/seats - Get all seats for a seat layout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id: seatLayoutId } = await params

      // Verify seat layout belongs to organization
      const seatLayout = await prisma.seatLayout.findFirst({
        where: {
          id: seatLayoutId,
          location: {
            organizationId: context.organizationId
          }
        }
      })

      if (!seatLayout) {
        return NextResponse.json(
          { error: 'Seat layout not found' },
          { status: 404 }
        )
      }

      const seats = await prisma.seat.findMany({
        where: {
          seatLayoutId
        },
        orderBy: [
          { row: 'asc' },
          { column: 'asc' }
        ]
      })

      return NextResponse.json(seats)
    } catch (error) {
      console.error('Error fetching seats:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// POST /api/seat-layouts/[id]/seats - Create a new seat (or bulk create)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can create seats' },
          { status: 403 }
        )
      }

      const { id: seatLayoutId } = await params
      const body = await req.json()

      // Verify seat layout belongs to organization
      const seatLayout = await prisma.seatLayout.findFirst({
        where: {
          id: seatLayoutId,
          location: {
            organizationId: context.organizationId
          }
        }
      })

      if (!seatLayout) {
        return NextResponse.json(
          { error: 'Seat layout not found' },
          { status: 404 }
        )
      }

      // Support both single seat and bulk creation
      const seatsData = Array.isArray(body) ? body : [body]

      const createdSeats = await Promise.all(
        seatsData.map(async (seatData: any) => {
          const { seatNumber, row, column, type, creditCost, x, y, isActive } = seatData

          if (!seatNumber) {
            throw new Error('Missing required field: seatNumber')
          }

          // Check if seat number already exists in this layout
          const existing = await prisma.seat.findUnique({
            where: {
              seatLayoutId_seatNumber: {
                seatLayoutId,
                seatNumber
              }
            }
          })

          if (existing) {
            throw new Error(`Seat ${seatNumber} already exists in this layout`)
          }

          return prisma.seat.create({
            data: {
              seatLayoutId,
              seatNumber,
              row: row || null,
              column: column || null,
              type: type || 'NORMAL',
              creditCost: creditCost || 1,
              x: x || null,
              y: y || null,
              isActive: isActive !== false
            }
          })
        })
      )

      return NextResponse.json(
        seatsData.length === 1 ? createdSeats[0] : createdSeats,
        { status: 201 }
      )
    } catch (error: any) {
      console.error('Error creating seats:', error)
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      )
    }
  })
}



