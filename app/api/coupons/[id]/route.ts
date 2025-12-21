import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/coupons/[id] - Get a specific coupon
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const { id } = await params;

      const coupon = await prisma.coupon.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      if (!coupon) {
        return NextResponse.json(
          { error: "Coupon not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(coupon);
    } catch (error) {
      console.error("Error fetching coupon:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/coupons/[id] - Update a coupon
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can update coupons
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can update coupons" },
          { status: 403 }
        );
      }

      const { id } = await params;
      const body = await req.json();

      // Verify coupon exists and belongs to organization
      const existingCoupon = await prisma.coupon.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingCoupon) {
        return NextResponse.json(
          { error: "Coupon not found" },
          { status: 404 }
        );
      }

      const updatedCoupon = await prisma.coupon.update({
        where: { id },
        data: body,
        include: {
          package: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json(updatedCoupon);
    } catch (error: any) {
      console.error("Error updating coupon:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/coupons/[id] - Delete a coupon
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Only admins and tenant admins can delete coupons
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can delete coupons" },
          { status: 403 }
        );
      }

      const { id } = await params;

      // Verify coupon exists and belongs to organization
      const existingCoupon = await prisma.coupon.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
      });

      if (!existingCoupon) {
        return NextResponse.json(
          { error: "Coupon not found" },
          { status: 404 }
        );
      }

      await prisma.coupon.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting coupon:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}
