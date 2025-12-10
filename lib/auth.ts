import { NextRequest } from "next/server";
import { createAuthClient } from "./supabase";
import { prisma } from "./prisma";

export interface AuthUser {
  id: string;
  email: string;
  supabaseUserId: string;
  organizationId: string;
  role: string;
}

/**
 * Get authenticated user from Supabase session
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.replace("Bearer ", "");

    // Use anon key client for token verification (service role bypasses auth checks)
    const supabase = createAuthClient();

    // Verify the token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.error("Token verification error:", error.message, error.status);
      return null;
    }

    if (!supabaseUser) {
      console.error("No user found after token verification");
      return null;
    }

    // Get user from database with organization
    // Add retry logic for connection failures
    let dbUser;
    let retries = 3;
    while (retries > 0) {
      try {
        dbUser = await prisma.user.findUnique({
          where: { supabaseUserId: supabaseUser.id },
          include: { organization: true },
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        // Check if it's a connection error (P1001) or prepared statement error (26000)
        const isConnectionError = error.code === "P1001";
        const isPreparedStatementError =
          error.code === "26000" ||
          (error.message && error.message.includes("prepared statement"));

        if ((isConnectionError || isPreparedStatementError) && retries > 1) {
          // Connection or prepared statement error, retry after a short delay
          console.warn(
            `Database query failed (${
              isPreparedStatementError ? "prepared statement" : "connection"
            } error), retrying... (${retries - 1} retries left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before retry
          retries--;
          continue;
        }
        // Not a retryable error or out of retries, throw
        throw error;
      }
    }

    // If user doesn't exist in database, try to create them
    // This handles the case where user authenticated but wasn't synced yet
    if (!dbUser) {
      console.log(`User ${supabaseUser.id} not found in database, creating...`);

      // Check for role in user metadata or use default
      const metadataRole = supabaseUser.user_metadata?.role;
      let defaultRole = "MEMBER";

      // Check if role is specified in metadata
      if (
        metadataRole &&
        ["ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "MEMBER"].includes(metadataRole)
      ) {
        defaultRole = metadataRole;
        console.log(`Role from user metadata: ${defaultRole}`);
      }

      // Check for organizationId from request (query params or header) - this comes from tenant backend
      const requestOrgId =
        request.nextUrl.searchParams.get("organizationId") ||
        request.headers.get("X-Organization-Id");

      // Try to get organization from metadata, request, or find/create default
      const metadataOrgId = supabaseUser.user_metadata?.organizationId;
      let organization = null;

      // Priority: 1. Request organizationId (from tenant backend), 2. Metadata, 3. Default
      if (requestOrgId) {
        // Organization ID provided by tenant backend - use this
        let orgRetries = 3;
        while (orgRetries > 0) {
          try {
            organization = await prisma.organization.findUnique({
              where: { id: requestOrgId },
            });
            if (organization) {
              console.log(
                `Found organization from request (tenant backend): ${organization.id}`
              );
            }
            break;
          } catch (error: any) {
            if (error.code === "P1001" && orgRetries > 1) {
              console.warn(
                `Database connection failed during organization lookup, retrying... (${
                  orgRetries - 1
                } retries left)`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              orgRetries--;
              continue;
            }
            throw error;
          }
        }
      }

      if (!organization && metadataOrgId) {
        // Retry logic for organization lookup
        let orgRetries = 3;
        while (orgRetries > 0) {
          try {
            organization = await prisma.organization.findUnique({
              where: { id: metadataOrgId },
            });
            if (organization) {
              console.log(
                `Found organization from metadata: ${organization.id}`
              );
            }
            break; // Success or not found, exit loop
          } catch (error: any) {
            if (error.code === "P1001" && orgRetries > 1) {
              console.warn(
                `Database connection failed during organization lookup, retrying... (${
                  orgRetries - 1
                } retries left)`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              orgRetries--;
              continue;
            }
            throw error;
          }
        }
      }

      // If no organization from metadata, try to get or create a default organization
      if (!organization) {
        // Retry logic for finding first organization
        let findRetries = 3;
        while (findRetries > 0) {
          try {
            organization = await prisma.organization.findFirst();
            break; // Success or not found, exit loop
          } catch (error: any) {
            if (error.code === "P1001" && findRetries > 1) {
              console.warn(
                `Database connection failed during organization find, retrying... (${
                  findRetries - 1
                } retries left)`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              findRetries--;
              continue;
            }
            throw error;
          }
        }

        if (!organization) {
          // Create a default organization if none exists with retry logic
          let createOrgRetries = 3;
          while (createOrgRetries > 0) {
            try {
              organization = await prisma.organization.create({
                data: {
                  name: "Default Organization",
                  slug: "default-org",
                },
              });
              console.log("Created default organization:", organization.id);
              break; // Success
            } catch (error: any) {
              if (error.code === "P1001" && createOrgRetries > 1) {
                console.warn(
                  `Database connection failed during organization creation, retrying... (${
                    createOrgRetries - 1
                  } retries left)`
                );
                await new Promise((resolve) => setTimeout(resolve, 500));
                createOrgRetries--;
                continue;
              }
              throw error;
            }
          }
        }
      }

      // Check if this is the tenant organization and assign TENANT_ADMIN if appropriate
      const tenantOrgId = process.env.TENANT_ORGANIZATION_ID;
      if (
        organization &&
        tenantOrgId &&
        organization.id === tenantOrgId &&
        defaultRole === "MEMBER"
      ) {
        // Check if this is the first user in the tenant organization with retry logic
        let countRetries = 3;
        let existingUsers = 0;
        while (countRetries > 0) {
          try {
            existingUsers = await prisma.user.count({
              where: { organizationId: tenantOrgId },
            });
            break; // Success
          } catch (error: any) {
            if (error.code === "P1001" && countRetries > 1) {
              console.warn(
                `Database connection failed during user count, retrying... (${
                  countRetries - 1
                } retries left)`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              countRetries--;
              continue;
            }
            throw error;
          }
        }

        if (existingUsers === 0) {
          // First user in tenant organization should be TENANT_ADMIN
          defaultRole = "TENANT_ADMIN";
          console.log(
            "First user in tenant organization, assigning TENANT_ADMIN role"
          );
        } else if (metadataRole === "TENANT_ADMIN") {
          defaultRole = "TENANT_ADMIN";
          console.log("User metadata indicates TENANT_ADMIN role");
        }
      }

      // Ensure we have an organization before creating user
      if (!organization) {
        console.error("No organization found or created, cannot create user");
        return null;
      }

      // Create user in database with retry logic
      let createRetries = 3;
      while (createRetries > 0) {
        try {
          dbUser = await prisma.user.create({
            data: {
              supabaseUserId: supabaseUser.id,
              email: supabaseUser.email || "",
              name: supabaseUser.user_metadata?.name || null,
              organizationId: organization.id,
              role: defaultRole as
                | "ADMIN"
                | "TENANT_ADMIN"
                | "INSTRUCTOR"
                | "MEMBER",
            },
            include: { organization: true },
          });
          console.log(
            `Created user in database: ${dbUser.id} with role: ${defaultRole}`
          );
          break; // Success, exit retry loop
        } catch (createError: any) {
          // Check if it's a connection error
          if (createError.code === "P1001" && createRetries > 1) {
            console.warn(
              `Database connection failed during user creation, retrying... (${
                createRetries - 1
              } retries left)`
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
            createRetries--;
            continue;
          }

          // If it's a duplicate error (user already exists), try to fetch
          if (createError.code === "P2002") {
            console.log("User already exists, fetching from database...");
            // Try to fetch with retry logic
            let fetchRetries = 3;
            while (fetchRetries > 0) {
              try {
                dbUser = await prisma.user.findUnique({
                  where: { supabaseUserId: supabaseUser.id },
                  include: { organization: true },
                });
                console.log(
                  `Fetched existing user: ${dbUser?.id}, org: ${dbUser?.organizationId}`
                );
                break; // Success
              } catch (fetchError: any) {
                if (fetchError.code === "P1001" && fetchRetries > 1) {
                  console.warn(
                    `Database connection failed during user fetch, retrying... (${
                      fetchRetries - 1
                    } retries left)`
                  );
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  fetchRetries--;
                  continue;
                }
                throw fetchError;
              }
            }
            // After fetching, check if organization needs to be updated
            if (
              dbUser &&
              organization &&
              dbUser.organizationId !== organization.id
            ) {
              console.log(
                `User belongs to different org (${dbUser.organizationId} vs ${organization.id}), updating...`
              );
              try {
                dbUser = await prisma.user.update({
                  where: { id: dbUser.id },
                  data: { organizationId: organization.id },
                  include: { organization: true },
                });
                console.log(`Updated user organization to ${organization.id}`);
              } catch (updateError) {
                console.error(
                  "Error updating user organization after fetch:",
                  updateError
                );
              }
            }
            break; // Exit outer loop
          }

          // Other errors, throw
          console.error("Error creating user:", createError);
          throw createError;
        }
      }
    } else {
      // User exists - check if organizationId needs to be updated from request
      const requestOrgId =
        request.nextUrl.searchParams.get("organizationId") ||
        request.headers.get("X-Organization-Id");

      console.log(
        `[AUTH] User exists in DB. Current org: ${
          dbUser.organizationId
        }, Requested org: ${requestOrgId || "none"}`
      );

      if (requestOrgId && dbUser.organizationId !== requestOrgId) {
        console.log(
          `[AUTH] Organization mismatch detected. Updating user organization...`
        );
        // Verify the requested organization exists
        let orgRetries = 3;
        let requestedOrg = null;
        while (orgRetries > 0) {
          try {
            requestedOrg = await prisma.organization.findUnique({
              where: { id: requestOrgId },
            });
            if (requestedOrg) {
              console.log(
                `[AUTH] Found requested organization: ${requestedOrg.id} - ${requestedOrg.name}`
              );
            } else {
              console.warn(
                `[AUTH] Requested organization ${requestOrgId} not found in database`
              );
            }
            break;
          } catch (error: any) {
            if (error.code === "P1001" && orgRetries > 1) {
              console.warn(
                `Database connection failed during organization lookup, retrying... (${
                  orgRetries - 1
                } retries left)`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              orgRetries--;
              continue;
            }
            throw error;
          }
        }

        if (requestedOrg) {
          console.log(
            `[AUTH] Updating user organization from ${dbUser.organizationId} to ${requestOrgId} based on tenant backend request`
          );
          // Update user's organization
          let updateRetries = 3;
          while (updateRetries > 0) {
            try {
              dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: { organizationId: requestOrgId },
                include: { organization: true },
              });
              console.log(
                `[AUTH] Successfully updated user organization to ${requestOrgId}`
              );
              break; // Success
            } catch (updateError: any) {
              if (updateError.code === "P1001" && updateRetries > 1) {
                console.warn(
                  `Database connection failed during organization update, retrying... (${
                    updateRetries - 1
                  } retries left)`
                );
                await new Promise((resolve) => setTimeout(resolve, 500));
                updateRetries--;
                continue;
              }
              console.error(
                "[AUTH] Error updating user organization:",
                updateError
              );
              break; // Exit loop on other errors
            }
          }
        } else {
          console.error(
            `[AUTH] Cannot update user organization: requested organization ${requestOrgId} does not exist`
          );
        }
      } else if (requestOrgId && dbUser.organizationId === requestOrgId) {
        console.log(
          `[AUTH] User already belongs to requested organization ${requestOrgId}`
        );
      }

      // Check if role should be updated from metadata
      const metadataRole = supabaseUser.user_metadata?.role;
      if (
        metadataRole &&
        ["ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "MEMBER"].includes(
          metadataRole
        ) &&
        dbUser.role !== metadataRole
      ) {
        console.log(
          `Updating user role from ${dbUser.role} to ${metadataRole} based on metadata`
        );
        // Retry logic for user update
        let updateRetries = 3;
        while (updateRetries > 0) {
          try {
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: { role: metadataRole },
              include: { organization: true },
            });
            break; // Success
          } catch (updateError: any) {
            if (updateError.code === "P1001" && updateRetries > 1) {
              console.warn(
                `Database connection failed during user update, retrying... (${
                  updateRetries - 1
                } retries left)`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              updateRetries--;
              continue;
            }
            console.error("Error updating user role:", updateError);
            break; // Exit loop on other errors
          }
        }
      }
    }

    if (!dbUser) {
      console.log("[AUTH] getAuthUser: dbUser is null, returning null");
      return null;
    }

    console.log(
      `[AUTH] getAuthUser: Returning user ${dbUser.id} with organizationId: ${dbUser.organizationId}, role: ${dbUser.role}`
    );

    // Check if existing user's role should be updated
    // This handles cases where user was created as MEMBER but should be TENANT_ADMIN
    const metadataRole = supabaseUser.user_metadata?.role;
    const tenantOrgId = process.env.TENANT_ORGANIZATION_ID;
    let finalRole = dbUser.role;

    // If user has role in metadata and it's different from database, update it
    if (
      metadataRole &&
      ["ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "MEMBER"].includes(
        metadataRole
      ) &&
      dbUser.role !== metadataRole
    ) {
      console.log(
        `[AUTH] Updating user role from ${dbUser.role} to ${metadataRole} based on Supabase metadata`
      );
      try {
        const updatedUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { role: metadataRole },
          include: { organization: true },
        });
        dbUser = updatedUser;
        finalRole = metadataRole;
        console.log(`[AUTH] User role updated successfully`);
      } catch (updateError) {
        console.error("[AUTH] Error updating user role:", updateError);
      }
    }
    // If user belongs to tenant organization and is MEMBER, check if they should be TENANT_ADMIN
    else if (
      tenantOrgId &&
      dbUser.organizationId === tenantOrgId &&
      dbUser.role === "MEMBER" &&
      !metadataRole
    ) {
      // Check if this user should be promoted to TENANT_ADMIN
      // For now, we'll keep them as MEMBER unless explicitly set in metadata
      // But log this for investigation
      console.log(
        `[AUTH] User ${dbUser.email} is MEMBER in tenant organization ${tenantOrgId}. Consider promoting to TENANT_ADMIN if needed.`
      );
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      supabaseUserId: dbUser.supabaseUserId,
      organizationId: dbUser.organizationId,
      role: finalRole,
    };
  } catch (error: any) {
    console.error("[AUTH] Error in getAuthUser:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      error: error,
    });
    // Log the full error for debugging
    if (error.code === 'P2002') {
      console.error("[AUTH] Unique constraint violation - user might already exist with different unique field");
    }
    return null;
  }
}

/**
 * Require authentication and return user or throw error
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

/**
 * Require specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthUser> {
  const user = await requireAuth(request);

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user;
}
