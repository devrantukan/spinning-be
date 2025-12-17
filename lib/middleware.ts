import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "./auth";

export interface RequestContext {
  user: {
    id: string;
    email: string;
    supabaseUserId: string;
    organizationId: string;
    role: string;
  };
  organizationId: string;
}

/**
 * Middleware to extract organization ID from request
 * Can be from query params, headers, or user's default organization
 * For public endpoints, can work without authentication if organizationId is provided
 */
export async function withOrganizationContext(
  request: NextRequest,
  handler: (req: NextRequest, context: RequestContext) => Promise<NextResponse>,
  options?: { requireAuth?: boolean }
): Promise<NextResponse> {
  try {
    const requireAuth = options?.requireAuth !== false; // Default to true

    // Get authenticated user (if available)
    const user = await getAuthUser(request);

    // Get organization ID from query params, headers, or user's default
    const orgIdFromQuery = request.nextUrl.searchParams.get("organizationId");
    const orgIdFromHeader = request.headers.get("x-organization-id");
    const organizationId =
      orgIdFromQuery || orgIdFromHeader || user?.organizationId;

    // If auth is required and no user, return error
    if (requireAuth && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If no organization ID can be determined, return error
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // If user exists, verify access to this organization
    if (user) {
      // ADMIN can access all organizations, TENANT_ADMIN can only access their own
      if (organizationId !== user.organizationId && user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Access denied to this organization" },
          { status: 403 }
        );
      }
    }

    // Create context - user may be null for public endpoints
    const context: RequestContext = {
      user: user || {
        id: "",
        email: "",
        supabaseUserId: "",
        organizationId: organizationId,
        role: "GUEST",
      },
      organizationId,
    };

    return handler(request, context);
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
