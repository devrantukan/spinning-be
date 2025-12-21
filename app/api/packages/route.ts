import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/packages - Get all packages for the organization
// Public endpoint - packages should be viewable without authentication
export async function GET(request: NextRequest) {
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const packages = await prisma.package.findMany({
          where: {
            organizationId: context.organizationId,
            isActive: true,
          },
          orderBy: {
            displayOrder: "asc",
          },
        });

        // Get organization credit price to calculate pricing fields
        const organization = await prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { creditPrice: true },
        });

        // Enrich packages with calculated fields
        const enrichedPackages = packages.map((pkg) => {
          if (
            pkg.type === "ALL_ACCESS" ||
            !pkg.credits ||
            !organization?.creditPrice
          ) {
            return pkg;
          }

          const basePrice = organization.creditPrice * pkg.credits;
          const discountAmount = basePrice - pkg.price;
          const discountPercentage =
            basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;
          const pricePerCredit = pkg.price / pkg.credits;

          return {
            ...pkg,
            basePrice,
            discountAmount,
            discountPercentage,
            pricePerCredit,
          };
        });

        return NextResponse.json(enrichedPackages);
      } catch (error) {
        console.error("Error fetching packages:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: false } // Make packages publicly accessible
  );
}

// POST /api/packages - Create a new package (requires auth)
export async function POST(request: NextRequest) {
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        // Only admins and tenant admins can create packages
        if (
          context.user.role !== "ADMIN" &&
          context.user.role !== "TENANT_ADMIN"
        ) {
          return NextResponse.json(
            { error: "Forbidden: Only admins can create packages" },
            { status: 403 }
          );
        }

        const body = await req.json();
        const {
          code,
          name,
          nameTr,
          type,
          price,
          credits,
          description,
          descriptionTr,
          benefits,
          validFrom,
          validUntil,
          displayOrder = 0,
        } = body;

        if (!code || !name || !type || price === undefined) {
          return NextResponse.json(
            { error: "Missing required fields: code, name, type, price" },
            { status: 400 }
          );
        }

        // Get organization credit price to calculate pricing fields
        const organization = await prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { creditPrice: true },
        });

        let basePrice: number | null = null;
        let discountAmount: number | null = null;
        let discountPercentage: number | null = null;
        let pricePerCredit: number | null = null;

        if (type !== "ALL_ACCESS" && credits && organization?.creditPrice) {
          basePrice = organization.creditPrice * credits;
          discountAmount = basePrice - price;
          discountPercentage =
            basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;
          pricePerCredit = price / credits;
        }

        const packageData = await prisma.package.create({
          data: {
            organizationId: context.organizationId,
            code,
            name,
            nameTr: nameTr || null,
            type,
            price,
            credits: type === "ALL_ACCESS" ? null : credits || null,
            pricePerCredit,
            basePrice,
            discountAmount,
            discountPercentage,
            description: description || null,
            descriptionTr: descriptionTr || null,
            benefits: benefits ? JSON.parse(JSON.stringify(benefits)) : null,
            validFrom: validFrom ? new Date(validFrom) : null,
            validUntil: validUntil ? new Date(validUntil) : null,
            displayOrder,
          },
        });

        return NextResponse.json(packageData, { status: 201 });
      } catch (error: any) {
        if (error.code === "P2002") {
          return NextResponse.json(
            { error: "Package code already exists" },
            { status: 400 }
          );
        }
        console.error("Error creating package:", error);
        return NextResponse.json(
          { error: error.message || "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: true } // POST requires authentication
  );
}
