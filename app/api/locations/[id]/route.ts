import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/locations/[id] - Get a specific location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params

      const location = await prisma.location.findFirst({
        where: {
          id,
          organizationId: context.organizationId
        },
        include: {
          seatLayouts: {
            include: {
              seats: {
                orderBy: [
                  { row: 'asc' },
                  { column: 'asc' }
                ]
              }
            }
          },
          _count: {
            select: {
              sessions: true,
              seatLayouts: true
            }
          }
        }
      })

      if (!location) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(location)
    } catch (error) {
      console.error('Error fetching location:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH /api/locations/[id] - Update a location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can update locations' },
          { status: 403 }
        )
      }

      const { id } = await params
      const body = await req.json()

      // Verify location belongs to organization
      const existingLocation = await prisma.location.findFirst({
        where: {
          id,
          organizationId: context.organizationId
        }
      })

      if (!existingLocation) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        )
      }

      const { name, description, address, isDefault } = body

      // If setting as default, unset other defaults for this organization
      if (isDefault && !existingLocation.isDefault) {
        await prisma.location.updateMany({
          where: {
            organizationId: context.organizationId,
            isDefault: true,
            id: { not: id }
          },
          data: {
            isDefault: false
          }
        })
      }

      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description || null
      if (address !== undefined) updateData.address = address || null
      if (isDefault !== undefined) updateData.isDefault = isDefault

      const updatedLocation = await prisma.location.update({
        where: { id },
        data: updateData,
        include: {
          seatLayouts: {
            where: {
              isActive: true
            },
            include: {
              seats: {
                where: {
                  isActive: true
                }
              }
            }
          }
        }
      })

      // Update organization's default location if needed
      if (isDefault) {
        await prisma.organization.update({
          where: { id: context.organizationId },
          data: { defaultLocationId: updatedLocation.id }
        })
      }

      return NextResponse.json(updatedLocation)
    } catch (error) {
      console.error('Error updating location:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// DELETE /api/locations/[id] - Delete a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can delete locations' },
          { status: 403 }
        )
      }

      const { id } = await params

      // Verify location belongs to organization
      const location = await prisma.location.findFirst({
        where: {
          id,
          organizationId: context.organizationId
        },
        include: {
          _count: {
            select: {
              sessions: true
            }
          }
        }
      })

      if (!location) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        )
      }

      // Check if location has active sessions
      if (location._count.sessions > 0) {
        return NextResponse.json(
          { error: 'Cannot delete location with active sessions' },
          { status: 400 }
        )
      }

      // If this was the default location, clear it from organization
      if (location.isDefault) {
        await prisma.organization.update({
          where: { id: context.organizationId },
          data: { defaultLocationId: null }
        })
      }

      await prisma.location.delete({
        where: { id }
      })

      return NextResponse.json({ message: 'Location deleted successfully' })
    } catch (error) {
      console.error('Error deleting location:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}



