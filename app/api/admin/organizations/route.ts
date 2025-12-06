import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET /api/admin/organizations - Get all organizations (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admins can view all organizations
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can view all organizations' },
        { status: 403 }
      )
    }

    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ]
    }

      const organizations = await prisma.organization.findMany({
        where,
        include: {
          contactUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              users: true,
              members: true,
              classes: true,
              sessions: true,
              bookings: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    return NextResponse.json(organizations)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/organizations - Create a new organization (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admins can create organizations
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can create organizations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      name, 
      slug, 
      description, 
      contactUserId, 
      address, 
      phone, 
      website, 
      email,
      facebook,
      twitter,
      instagram,
      linkedin
    } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existing = await prisma.organization.findUnique({
      where: { slug }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Organization with this slug already exists' },
        { status: 400 }
      )
    }

    // Verify contact user exists and belongs to an organization (optional check)
    if (contactUserId) {
      const contactUser = await prisma.user.findUnique({
        where: { id: contactUserId }
      })
      if (!contactUser) {
        return NextResponse.json(
          { error: 'Contact user not found' },
          { status: 400 }
        )
      }
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description: description || null,
        contactUserId: contactUserId || null,
        address: address || null,
        phone: phone || null,
        website: website || null,
        email: email || null,
        facebook: facebook || null,
        twitter: twitter || null,
        instagram: instagram || null,
        linkedin: linkedin || null
      },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            users: true,
            members: true,
            classes: true,
            sessions: true,
            bookings: true
          }
        }
      }
    })

    return NextResponse.json(organization, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

