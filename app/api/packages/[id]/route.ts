import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/packages/[id] - Get a specific package
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params;

      const packageData = await prisma.package.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!packageData) {
        return NextResponse.json(
          { error: "Package not found" },
          { status: 404 }
        );
      }

      // Enrich with calculated fields if needed
      if (
        packageData.type !== "ALL_ACCESS" &&
        packageData.credits &&
        !packageData.basePrice
      ) {
        const organization = await prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { creditPrice: true },
        });

        if (organization?.creditPrice) {
          const basePrice = organization.creditPrice * packageData.credits;
          const discountAmount = basePrice - packageData.price;
          const discountPercentage =
            basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;
          const pricePerCredit = packageData.price / packageData.credits;

          return NextResponse.json({
            ...packageData,
            basePrice,
            discountAmount,
            discountPercentage,
            pricePerCredit,
          });
        }
      }

      return NextResponse.json(packageData);
    } catch (error) {
      console.error("Error fetching package:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/packages/[id] - Update a package
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can update packages
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can update packages" },
          { status: 403 }
        );
      }

      const { id } = await params;
      const body = await req.json();

      // Verify package exists and belongs to organization
      const existingPackage = await prisma.package.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingPackage) {
        return NextResponse.json(
          { error: "Package not found" },
          { status: 404 }
        );
      }

      // Recalculate pricing if price or credits changed
      if (body.price !== undefined || body.credits !== undefined) {
        const organization = await prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { creditPrice: true },
        });

        const finalPrice = body.price ?? existingPackage.price;
        const finalCredits =
          body.credits !== undefined ? body.credits : existingPackage.credits;

        if (
          existingPackage.type !== "ALL_ACCESS" &&
          finalCredits &&
          organization?.creditPrice
        ) {
          body.basePrice = organization.creditPrice * finalCredits;
          body.discountAmount = body.basePrice - finalPrice;
          body.discountPercentage =
            body.basePrice > 0
              ? (body.discountAmount / body.basePrice) * 100
              : 0;
          body.pricePerCredit = finalPrice / finalCredits;
        }
      }

      const updatedPackage = await prisma.package.update({
        where: { id },
        data: body,
      });

      return NextResponse.json(updatedPackage);
    } catch (error: any) {
      console.error("Error updating package:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/packages/[id] - Delete a package
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can delete packages
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can delete packages" },
          { status: 403 }
        );
      }

      const { id } = await params;

      // Verify package exists and belongs to organization
      const existingPackage = await prisma.package.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingPackage) {
        return NextResponse.json(
          { error: "Package not found" },
          { status: 404 }
        );
      }

      await prisma.package.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}
