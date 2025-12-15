import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/seat-layouts/[id] - Get a specific seat layout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params

      const seatLayout = await prisma.seatLayout.findFirst({
        where: {
          id,
          location: {
            organizationId: context.organizationId
          }
        },
        include: {
          location: true,
          seats: {
            orderBy: [
              { row: 'asc' },
              { column: 'asc' }
            ]
          }
        }
      })

      if (!seatLayout) {
        return NextResponse.json(
          { error: 'Seat layout not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(seatLayout)
    } catch (error) {
      console.error('Error fetching seat layout:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH /api/seat-layouts/[id] - Update a seat layout
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can update seat layouts' },
          { status: 403 }
        )
      }

      const { id } = await params
      const body = await req.json()

      // Verify seat layout belongs to organization
      const existingLayout = await prisma.seatLayout.findFirst({
        where: {
          id,
          location: {
            organizationId: context.organizationId
          }
        }
      })

      if (!existingLayout) {
        return NextResponse.json(
          { error: 'Seat layout not found' },
          { status: 404 }
        )
      }

      const { name, description, isActive, gridRows, gridColumns } = body

      // If setting as active, deactivate other layouts for this location
      if (isActive && !existingLayout.isActive) {
        await prisma.seatLayout.updateMany({
          where: {
            locationId: existingLayout.locationId,
            isActive: true,
            id: { not: id }
          },
          data: {
            isActive: false
          }
        })
      }

      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description || null
      if (isActive !== undefined) updateData.isActive = isActive
      if (gridRows !== undefined) updateData.gridRows = gridRows || null
      if (gridColumns !== undefined) updateData.gridColumns = gridColumns || null

      const updatedLayout = await prisma.seatLayout.update({
        where: { id },
        data: updateData,
        include: {
          location: true,
          seats: {
            orderBy: [
              { row: 'asc' },
              { column: 'asc' }
            ]
          }
        }
      })

      return NextResponse.json(updatedLayout)
    } catch (error) {
      console.error('Error updating seat layout:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// DELETE /api/seat-layouts/[id] - Delete a seat layout
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can delete seat layouts' },
          { status: 403 }
        )
      }

      const { id } = await params

      // Verify seat layout belongs to organization
      const seatLayout = await prisma.seatLayout.findFirst({
        where: {
          id,
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

      await prisma.seatLayout.delete({
        where: { id }
      })

      return NextResponse.json({ message: 'Seat layout deleted successfully' })
    } catch (error) {
      console.error('Error deleting seat layout:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

