import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrganizationContext } from '@/lib/middleware'

// GET /api/locations - Get all locations for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const locations = await prisma.location.findMany({
        where: {
          organizationId: context.organizationId
        },
        include: {
          seatLayouts: {
            where: {
              isActive: true
            },
            include: {
              seats: {
                where: {
                  isActive: true
                },
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
        },
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' }
        ]
      })

      return NextResponse.json(locations)
    } catch (error) {
      console.error('Error fetching locations:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// POST /api/locations - Create a new location
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Check permissions
      if (context.user.role !== 'ADMIN' && context.user.role !== 'TENANT_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only admins can create locations' },
          { status: 403 }
        )
      }

      const body = await req.json()
      const { name, description, address, isDefault } = body

      if (!name) {
        return NextResponse.json(
          { error: 'Missing required field: name' },
          { status: 400 }
        )
      }

      // If setting as default, unset other defaults for this organization
      if (isDefault) {
        await prisma.location.updateMany({
          where: {
            organizationId: context.organizationId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        })
      }

      const locationData: any = {
        name,
        description: description || null,
        address: address || null,
        organizationId: context.organizationId,
        isDefault: isDefault || false
      }

      const newLocation = await prisma.location.create({
        data: locationData,
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
          data: { defaultLocationId: newLocation.id }
        })
      }

      return NextResponse.json(newLocation, { status: 201 })
    } catch (error) {
      console.error('Error creating location:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}






