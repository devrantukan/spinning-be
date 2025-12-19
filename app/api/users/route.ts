import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// GET /api/users - Get all users for the organization
export async function GET(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      // Log the user's role for debugging
      console.log(`[GET_USERS] User role check:`, {
        userId: context.user.id,
        email: context.user.email,
        role: context.user.role,
        organizationId: context.organizationId,
      });

      // Only admins and tenant admins can view users
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "TENANT_ADMIN"
      ) {
        console.log(
          `[GET_USERS] Access denied - user role is: ${context.user.role}`
        );
        return NextResponse.json(
          { error: "Forbidden: Only admins and tenant admins can view users" },
          { status: 403 }
        );
      }

      console.log(`[GET_USERS] Access granted for role: ${context.user.role}`);

      const { searchParams } = req.nextUrl;
      const role = searchParams.get("role");
      const organizationId = searchParams.get("organizationId");

      const where: any = {};

      // ADMIN can see all users, or filter by organizationId if provided
      // Non-ADMIN users are restricted to their organization (handled by middleware)
      if (context.user.role === "ADMIN") {
        // If organizationId is provided in query, filter by it
        if (organizationId) {
          where.organizationId = organizationId;
        }
        // Otherwise, show all users (no organizationId filter)
      } else {
        // Non-ADMIN users can only see users from their organization
        where.organizationId = context.organizationId;
      }

      if (role) {
        where.role = role;
      }

      const users = await prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              memberships: true,
              bookings: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

// POST /api/users - Create/add a user to the organization
export async function POST(request: NextRequest) {
  return withOrganizationContext(request, async (req, context) => {
    try {
      const body = await request.json();
      const { email, name, role = "MEMBER" } = body;

      // Only admins and tenant admins can add users
      // Note: Users from tenant organizations are allowed to create instructors
      // even if their role in the database is MEMBER (they're effectively tenant admins)
      const canAddUsers =
        context.user.role === "ADMIN" ||
        context.user.role === "TENANT_ADMIN" ||
        (context.user.role === "MEMBER" && role === "INSTRUCTOR");

      if (!canAddUsers) {
        return NextResponse.json(
          { error: "Forbidden: Only admins can add users" },
          { status: 403 }
        );
      }

      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }

      // Validate role
      if (!["ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "MEMBER"].includes(role)) {
        return NextResponse.json(
          {
            error:
              "Invalid role. Must be ADMIN, TENANT_ADMIN, INSTRUCTOR, or MEMBER",
          },
          { status: 400 }
        );
      }

      // Members (acting as tenant admins) and TENANT_ADMIN cannot assign ADMIN role
      if (
        (context.user.role === "TENANT_ADMIN" ||
          context.user.role === "MEMBER") &&
        role === "ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Tenant admins cannot assign ADMIN role" },
          { status: 403 }
        );
      }

      // Members (acting as tenant admins) and TENANT_ADMIN can create INSTRUCTOR and MEMBER users
      if (
        (context.user.role === "TENANT_ADMIN" ||
          context.user.role === "MEMBER") &&
        role !== "INSTRUCTOR" &&
        role !== "MEMBER"
      ) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Tenant admins can only create instructors or members",
          },
          { status: 403 }
        );
      }

      console.log(`[CREATE_USER] Request:`, {
        requesterRole: context.user.role,
        requesterEmail: context.user.email,
        targetEmail: email,
        targetRole: role,
        organizationId: context.organizationId,
      });

      // Check if user already exists in database
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          organizationId: context.organizationId,
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "User already exists in this organization" },
          { status: 400 }
        );
      }

      // Try to find or create user in Supabase
      const { createServerClient } = await import("@/lib/supabase");
      const supabase = createServerClient();

      // Check if service role key is available (required for admin operations)
      const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (
        !hasServiceRoleKey &&
        context.user.role === "TENANT_ADMIN" &&
        role === "INSTRUCTOR"
      ) {
        console.warn(
          "[CREATE_USER] SUPABASE_SERVICE_ROLE_KEY not configured, but attempting to create user anyway"
        );
      }

      // First, try to find existing user
      let supabaseUser = null;
      try {
        const { data: supabaseUsers, error: listError } =
          await supabase.auth.admin.listUsers();

        if (listError) {
          console.error(
            "[CREATE_USER] Error listing users from Supabase:",
            listError
          );
          if (
            listError.message?.includes("JWT") ||
            listError.message?.includes("service")
          ) {
            console.error(
              "[CREATE_USER] This error usually means SUPABASE_SERVICE_ROLE_KEY is missing or invalid"
            );
          }
          // If listing fails, we'll try to create if tenant admin
          // Don't throw error yet - allow tenant admins to create instructors
        } else {
          supabaseUser = supabaseUsers?.users?.find((u) => u.email === email);
          console.log(
            `[CREATE_USER] Found ${
              supabaseUsers?.users?.length || 0
            } users in Supabase, user ${email} ${
              supabaseUser ? "exists" : "does not exist"
            }`
          );
        }
      } catch (error: any) {
        console.error(
          "[CREATE_USER] Error fetching users from Supabase:",
          error
        );
        // Continue - allow tenant admins to create instructors even if listing fails
      }

      // If user doesn't exist and tenant admin (or member acting as tenant admin) is creating an instructor or member, create them in Supabase
      const isTenantAdmin =
        context.user.role === "TENANT_ADMIN" || context.user.role === "MEMBER";
      const shouldCreateUser =
        !supabaseUser &&
        isTenantAdmin &&
        (role === "INSTRUCTOR" || role === "MEMBER");
      console.log(`[CREATE_USER] Checking conditions:`, {
        shouldCreate: shouldCreateUser,
        hasSupabaseUser: !!supabaseUser,
        requesterRole: context.user.role,
        targetRole: role,
        hasServiceKey: hasServiceRoleKey,
      });

      if (shouldCreateUser) {
        console.log(
          `[CREATE_USER] Creating ${role.toLowerCase()} ${email} in Supabase for tenant admin`
        );

        if (!hasServiceRoleKey) {
          return NextResponse.json(
            {
              error: "Configuration error",
              details:
                "SUPABASE_SERVICE_ROLE_KEY is required to create users. Please configure it in the main backend environment variables.",
            },
            { status: 500 }
          );
        }

        // Get organization SMTP settings
        const organization = await prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: {
            smtpHost: true,
            smtpPort: true,
            smtpUser: true,
            smtpPassword: true,
            smtpFromEmail: true,
            smtpFromName: true,
            name: true,
            language: true,
          },
        });

        // Get TENANT_URL from request header, body, or environment
        let tenantUrlRaw: string | null = null;
        const tenantUrlFromHeader = req.headers.get("X-Tenant-URL");

        if (tenantUrlFromHeader) {
          tenantUrlRaw = tenantUrlFromHeader;
        } else {
          try {
            const clonedRequest = req.clone();
            const body = await clonedRequest.json().catch(() => ({}));
            if (body && body.tenantUrl) {
              tenantUrlRaw = body.tenantUrl;
            }
          } catch (e) {
            // Body might be empty or already consumed
          }

          if (!tenantUrlRaw) {
            tenantUrlRaw =
              process.env.TENANT_URL ||
              process.env.NEXT_PUBLIC_SITE_URL ||
              null;
          }
        }

        const tenantUrl = tenantUrlRaw ? tenantUrlRaw.replace(/\/$/, "") : null;
        const redirectUrl = tenantUrl
          ? `${tenantUrl}/accept-invitation`
          : "http://localhost:3000/accept-invitation";

        // Generate invitation link using generateLink (instead of inviteUserByEmail)
        // This gives us the link to send via our SMTP
        const { data: linkData, error: linkError } =
          await supabase.auth.admin.generateLink({
            type: "invite",
            email: email,
            options: {
              redirectTo: redirectUrl,
              data: {
                name: name || null,
                organizationId: context.organizationId,
                role: role,
              },
            },
          });

        if (linkError || !linkData?.properties?.action_link) {
          console.error("Error generating invitation link:", linkError);
          // Fallback: try inviteUserByEmail
          const { data: newSupabaseUser, error: inviteError } =
            await supabase.auth.admin.inviteUserByEmail(email, {
              data: {
                name: name || null,
                organizationId: context.organizationId,
                role: role,
              },
            });

          if (inviteError) {
            console.error("Error inviting user to Supabase:", inviteError);
            // Try alternative: create user without email confirmation
            const { data: createdUser, error: createError } =
              await supabase.auth.admin.createUser({
                email,
                email_confirm: true, // Auto-confirm email so user can set password
                user_metadata: {
                  name: name || null,
                  organizationId: context.organizationId,
                  role: role,
                },
              });

            if (createError || !createdUser.user) {
              console.error("Error creating user in Supabase:", createError);
              return NextResponse.json(
                {
                  error: "Failed to create user in Supabase",
                  details:
                    createError?.message ||
                    inviteError.message ||
                    "Please ensure SUPABASE_SERVICE_ROLE_KEY is configured",
                },
                { status: 400 }
              );
            }

            supabaseUser = createdUser.user;
            console.log(`User created in Supabase: ${supabaseUser.id}`);

            // Generate password reset link and send via SMTP
            const { data: resetLinkData } =
              await supabase.auth.admin.generateLink({
                type: "recovery",
                email: email,
                options: { redirectTo: redirectUrl },
              });

            if (resetLinkData?.properties?.action_link) {
              const { sendPasswordResetEmail } = await import("@/lib/email");
              const emailResult = await sendPasswordResetEmail(
                email,
                resetLinkData.properties.action_link,
                name || undefined,
                organization
              );

              if (!emailResult.success) {
                console.warn(
                  "Failed to send password reset email via SMTP:",
                  emailResult.error
                );
              }
            }
          } else {
            supabaseUser = newSupabaseUser.user;
            console.log(`User invited via Supabase: ${supabaseUser.id}`);
          }
        } else {
          // Successfully generated link - send invitation email via SMTP
          const invitationLink = linkData.properties.action_link;
          console.log(`[CREATE_USER] Generated invitation link for ${email}`);

          // Send invitation email via SMTP
          const { sendInvitationEmail } = await import("@/lib/email");
          const emailResult = await sendInvitationEmail(
            email,
            invitationLink,
            name || undefined,
            organization
          );

          if (!emailResult.success) {
            console.error(
              `[CREATE_USER] Failed to send invitation email via SMTP:`,
              emailResult.error
            );
            // Still continue - user can be created even if email fails
          } else {
            console.log(
              `[CREATE_USER] Invitation email sent successfully to ${email} via SMTP`
            );
          }

          // Create or get user in Supabase
          // Since we generated a link, the user might not exist yet - create them
          const { data: createdUser, error: createError } =
            await supabase.auth.admin.createUser({
              email,
              email_confirm: false, // User needs to confirm via invitation link
              user_metadata: {
                name: name || null,
                organizationId: context.organizationId,
                role: role,
              },
            });

          if (createError || !createdUser?.user) {
            // User might already exist, try to get them by listing users
            const { data: usersList, error: listError } =
              await supabase.auth.admin.listUsers();
            if (!listError && usersList?.users) {
              const foundUser = usersList.users.find((u) => u.email === email);
              if (foundUser) {
                supabaseUser = foundUser;
                console.log(
                  `[CREATE_USER] Found existing user in Supabase: ${foundUser.id}`
                );
              } else {
                console.error("Error creating user in Supabase:", createError);
                return NextResponse.json(
                  {
                    error: "Failed to create user in Supabase",
                    details:
                      createError?.message ||
                      "Please ensure SUPABASE_SERVICE_ROLE_KEY is configured",
                  },
                  { status: 400 }
                );
              }
            } else {
              console.error("Error creating user in Supabase:", createError);
              return NextResponse.json(
                {
                  error: "Failed to create user in Supabase",
                  details:
                    createError?.message ||
                    "Please ensure SUPABASE_SERVICE_ROLE_KEY is configured",
                },
                { status: 400 }
              );
            }
          } else {
            supabaseUser = createdUser.user;
          }
        }
      } else if (!supabaseUser) {
        // For non-tenant-admin or non-instructor creation, user must exist
        console.log(`[CREATE_USER] User not found and cannot create:`, {
          requesterRole: context.user.role,
          targetRole: role,
          email,
        });
        return NextResponse.json(
          {
            error: "User not found in Supabase",
            details:
              "The user must first sign up in Supabase authentication before they can be added to the organization. Tenant admins can create instructors by providing their email.",
          },
          { status: 400 }
        );
      }

      if (!supabaseUser) {
        console.error(
          `[CREATE_USER] No supabase user found after creation attempt`
        );
        return NextResponse.json(
          {
            error: "Failed to create or find user in Supabase",
            details:
              "Unable to create user in Supabase. Please ensure SUPABASE_SERVICE_ROLE_KEY is configured.",
          },
          { status: 400 }
        );
      }

      // Check if user exists in another organization
      const userInOtherOrg = await prisma.user.findUnique({
        where: { supabaseUserId: supabaseUser.id },
      });

      if (userInOtherOrg) {
        // Extract additional user metadata from Supabase user
        const userMetadata = supabaseUser.user_metadata || {};
        const dateOfBirth = userMetadata.dob
          ? new Date(userMetadata.dob)
          : null;
        const mobilePhone = userMetadata.mobilePhone || null;
        const countryCode = userMetadata.countryCode || null;

        // Parse TOC and liability waiver acceptance
        let tocAcceptedAt: Date | null = null;
        let liabilityWaiverAcceptedAt: Date | null = null;
        if (userMetadata.tocAcceptedAt) {
          try {
            tocAcceptedAt = new Date(userMetadata.tocAcceptedAt);
            if (isNaN(tocAcceptedAt.getTime())) tocAcceptedAt = null;
          } catch (e) {
            console.warn(
              "Invalid TOC accepted date:",
              userMetadata.tocAcceptedAt
            );
          }
        }
        if (userMetadata.liabilityWaiverAcceptedAt) {
          try {
            liabilityWaiverAcceptedAt = new Date(
              userMetadata.liabilityWaiverAcceptedAt
            );
            if (isNaN(liabilityWaiverAcceptedAt.getTime()))
              liabilityWaiverAcceptedAt = null;
          } catch (e) {
            console.warn(
              "Invalid liability waiver accepted date:",
              userMetadata.liabilityWaiverAcceptedAt
            );
          }
        }

        // Update user's organization
        const updatedUser = await prisma.user.update({
          where: { id: userInOtherOrg.id },
          data: {
            organizationId: context.organizationId,
            role: role as any,
            name: name || userInOtherOrg.name,
            dateOfBirth:
              dateOfBirth !== null ? dateOfBirth : userInOtherOrg.dateOfBirth,
            mobilePhone: mobilePhone || userInOtherOrg.mobilePhone,
            countryCode: countryCode || userInOtherOrg.countryCode,
            tocAccepted:
              userMetadata.tocAccepted !== undefined
                ? userMetadata.tocAccepted
                : userInOtherOrg.tocAccepted,
            tocAcceptedAt:
              tocAcceptedAt !== null
                ? tocAcceptedAt
                : userInOtherOrg.tocAcceptedAt,
            liabilityWaiverAccepted:
              userMetadata.liabilityWaiverAccepted !== undefined
                ? userMetadata.liabilityWaiverAccepted
                : userInOtherOrg.liabilityWaiverAccepted,
            liabilityWaiverAcceptedAt:
              liabilityWaiverAcceptedAt !== null
                ? liabilityWaiverAcceptedAt
                : userInOtherOrg.liabilityWaiverAcceptedAt,
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                memberships: true,
                bookings: true,
              },
            },
          },
        });
        return NextResponse.json(updatedUser, { status: 200 });
      }

      // Extract additional user metadata from Supabase user
      const userMetadata = supabaseUser.user_metadata || {};
      const dateOfBirth = userMetadata.dob ? new Date(userMetadata.dob) : null;
      const mobilePhone = userMetadata.mobilePhone || null;
      const countryCode = userMetadata.countryCode || null;

      // Create new user in database
      const user = await prisma.user.create({
        data: {
          supabaseUserId: supabaseUser.id,
          email,
          name: name || userMetadata.name || null,
          dateOfBirth: dateOfBirth,
          mobilePhone: mobilePhone,
          countryCode: countryCode,
          role: role as any,
          organizationId: context.organizationId,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              memberships: true,
              bookings: true,
            },
          },
        },
      });

      // If user role is INSTRUCTOR, also create an Instructor record
      if (role === "INSTRUCTOR") {
        try {
          await prisma.instructor.create({
            data: {
              userId: user.id,
              organizationId: context.organizationId,
              status: "ACTIVE",
            },
          });
          console.log(
            `[CREATE_USER] Created Instructor record for user ${user.id}`
          );
        } catch (instructorError: any) {
          // If instructor already exists, that's okay
          if (instructorError.code !== "P2002") {
            // P2002 is unique constraint violation
            console.error(
              "[CREATE_USER] Error creating instructor record:",
              instructorError
            );
          }
        }
      }

      // Log success message about email being sent
      if (
        context.user.role === "TENANT_ADMIN" &&
        (role === "INSTRUCTOR" || role === "MEMBER")
      ) {
        console.log(`${role} ${email} created and invitation email sent`);
      }

      return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
      console.error("Error creating user:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      );
    }
  });
}
