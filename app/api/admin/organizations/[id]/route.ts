import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/organizations/[id] - Get a specific organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Only admins can view any organization, or tenant admins can view their own organization
    if (user.role === "ADMIN") {
      // Admins can view any organization
    } else if (user.role === "TENANT_ADMIN" && user.organizationId === id) {
      // Tenant admins can only view their own organization
    } else {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only admins can view organizations, or tenant admins can view their own organization",
        },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            members: true,
            classes: true,
            sessions: true,
            bookings: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Exclude SMTP password from response for security
    const { smtpPassword, ...organizationSafe } = organization as any;

    return NextResponse.json({
      ...organizationSafe,
      // Include smtpPassword field but set to null/masked for frontend display
      smtpPassword: smtpPassword ? "••••••••" : null,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/organizations/[id] - Update an organization
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Only admins can update any organization, or tenant admins can update their own organization
    if (user.role === "ADMIN") {
      // Admins can update any organization
    } else if (user.role === "TENANT_ADMIN" && user.organizationId === id) {
      // Tenant admins can only update their own organization
    } else {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only admins can update organizations, or tenant admins can update their own organization",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
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
      linkedin,
      tiktok,
      latitude,
      longitude,
      // SMTP Configuration
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFromEmail,
      smtpFromName,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (contactUserId !== undefined) {
      if (contactUserId) {
        // Verify contact user exists
        const contactUser = await prisma.user.findUnique({
          where: { id: contactUserId },
        });
        if (!contactUser) {
          return NextResponse.json(
            { error: "Contact user not found" },
            { status: 400 }
          );
        }
        updateData.contactUser = { connect: { id: contactUserId } };
      } else {
        // Disconnect the relation when contactUserId is null or empty
        updateData.contactUser = { disconnect: true };
      }
    }
    if (address !== undefined) updateData.address = address || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (website !== undefined) updateData.website = website || null;
    if (email !== undefined) updateData.email = email || null;
    if (facebook !== undefined) updateData.facebook = facebook || null;
    if (twitter !== undefined) updateData.twitter = twitter || null;
    if (instagram !== undefined) updateData.instagram = instagram || null;
    if (linkedin !== undefined) updateData.linkedin = linkedin || null;
    if (tiktok !== undefined) updateData.tiktok = tiktok || null;
    if (latitude !== undefined)
      updateData.latitude =
        latitude !== null && latitude !== "" ? parseFloat(latitude) : null;
    if (longitude !== undefined)
      updateData.longitude =
        longitude !== null && longitude !== "" ? parseFloat(longitude) : null;
    // SMTP Configuration
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost || null;
    if (smtpPort !== undefined) {
      if (smtpPort === null || smtpPort === "" || smtpPort === undefined) {
        updateData.smtpPort = null;
      } else {
        // Handle both number and string inputs
        const portNum =
          typeof smtpPort === "number"
            ? smtpPort
            : parseInt(String(smtpPort), 10);
        updateData.smtpPort = isNaN(portNum) ? null : portNum;
      }
    }
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser || null;
    if (smtpPassword !== undefined) {
      // Only update password if it's provided and not empty (empty string means keep current)
      if (smtpPassword === "" || smtpPassword === null) {
        // Don't update password - keep current one
      } else {
        updateData.smtpPassword = smtpPassword;
      }
    }
    if (smtpFromEmail !== undefined)
      updateData.smtpFromEmail = smtpFromEmail || null;
    if (smtpFromName !== undefined)
      updateData.smtpFromName = smtpFromName || null;

    if (slug) {
      // Check if slug is already taken by another organization
      const existing = await prisma.organization.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Organization with this slug already exists" },
          { status: 400 }
        );
      }

      updateData.slug = slug;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            members: true,
            classes: true,
            sessions: true,
            bookings: true,
          },
        },
      },
    });

    return NextResponse.json(organization);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating organization:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? {
                code: error.code,
                meta: error.meta,
              }
            : undefined,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/organizations/[id] - Delete an organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Only admins can delete organizations
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only admins can delete organizations" },
        { status: 403 }
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Delete organization (cascade will delete related records)
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Organization deleted successfully" });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
