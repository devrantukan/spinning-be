import { prisma } from "./prisma";
import { createServerClient } from "./supabase";

/**
 * Sync user from Supabase auth to database
 * This should be called after a user signs up in Supabase
 * You can set this up as a Supabase webhook or call it from your signup flow
 */
export async function syncUserFromSupabase(
  supabaseUserId: string,
  email: string,
  organizationId: string,
  name?: string,
  userMetadata?: {
    dob?: string;
    mobilePhone?: string;
    countryCode?: string;
    tocAccepted?: boolean;
    tocAcceptedAt?: string;
    liabilityWaiverAccepted?: boolean;
    liabilityWaiverAcceptedAt?: string;
  }
) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { supabaseUserId },
    });

    // Parse date of birth if provided
    let dateOfBirth: Date | null = null;
    if (userMetadata?.dob) {
      try {
        dateOfBirth = new Date(userMetadata.dob);
        // Check if date is valid
        if (isNaN(dateOfBirth.getTime())) {
          dateOfBirth = null;
        }
      } catch (e) {
        console.warn("Invalid date of birth format:", userMetadata.dob);
      }
    }

    if (existingUser) {
      // Update existing user with new metadata if provided
      if (userMetadata) {
        const updateData: any = {
          name: name || existingUser.name,
          dateOfBirth:
            dateOfBirth !== null ? dateOfBirth : existingUser.dateOfBirth,
          mobilePhone: userMetadata.mobilePhone || existingUser.mobilePhone,
          countryCode: userMetadata.countryCode || existingUser.countryCode,
        };

        // Update TOC and liability waiver if provided
        if (userMetadata.tocAccepted !== undefined) {
          updateData.tocAccepted = userMetadata.tocAccepted;
          updateData.tocAcceptedAt = userMetadata.tocAcceptedAt
            ? new Date(userMetadata.tocAcceptedAt)
            : null;
        }
        if (userMetadata.liabilityWaiverAccepted !== undefined) {
          updateData.liabilityWaiverAccepted =
            userMetadata.liabilityWaiverAccepted;
          updateData.liabilityWaiverAcceptedAt =
            userMetadata.liabilityWaiverAcceptedAt
              ? new Date(userMetadata.liabilityWaiverAcceptedAt)
              : null;
        }

        return await prisma.user.update({
          where: { supabaseUserId },
          data: updateData,
        });
      }
      return existingUser;
    }

    // Parse TOC and liability waiver acceptance dates if provided
    let tocAcceptedAt: Date | null = null;
    let liabilityWaiverAcceptedAt: Date | null = null;

    if (userMetadata?.tocAcceptedAt) {
      try {
        tocAcceptedAt = new Date(userMetadata.tocAcceptedAt);
        if (isNaN(tocAcceptedAt.getTime())) tocAcceptedAt = null;
      } catch (e) {
        console.warn(
          "Invalid TOC accepted date format:",
          userMetadata.tocAcceptedAt
        );
      }
    }

    if (userMetadata?.liabilityWaiverAcceptedAt) {
      try {
        liabilityWaiverAcceptedAt = new Date(
          userMetadata.liabilityWaiverAcceptedAt
        );
        if (isNaN(liabilityWaiverAcceptedAt.getTime()))
          liabilityWaiverAcceptedAt = null;
      } catch (e) {
        console.warn(
          "Invalid liability waiver accepted date format:",
          userMetadata.liabilityWaiverAcceptedAt
        );
      }
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        supabaseUserId,
        email,
        name: name || null,
        dateOfBirth: dateOfBirth,
        mobilePhone: userMetadata?.mobilePhone || null,
        countryCode: userMetadata?.countryCode || null,
        tocAccepted: userMetadata?.tocAccepted || false,
        tocAcceptedAt: tocAcceptedAt,
        liabilityWaiverAccepted: userMetadata?.liabilityWaiverAccepted || false,
        liabilityWaiverAcceptedAt: liabilityWaiverAcceptedAt,
        organizationId,
        role: "MEMBER",
      },
    });

    return user;
  } catch (error) {
    console.error("Error syncing user from Supabase:", error);
    throw error;
  }
}

/**
 * Get or create organization
 * Useful for initial setup
 */
export async function getOrCreateOrganization(name: string, slug: string) {
  try {
    let organization = await prisma.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name,
          slug,
        },
      });
    }

    return organization;
  } catch (error) {
    console.error("Error getting or creating organization:", error);
    throw error;
  }
}
