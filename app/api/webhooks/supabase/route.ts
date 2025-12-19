import { NextRequest, NextResponse } from "next/server";
import { syncUserFromSupabase } from "@/lib/sync-user";
import { prisma } from "@/lib/prisma";

/**
 * Webhook endpoint for Supabase auth events
 * Configure this in your Supabase dashboard: Settings > Database > Webhooks
 *
 * This endpoint handles:
 * - auth.users INSERT (new user signup)
 * - auth.users UPDATE (user profile updates)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if you set one in Supabase
    const webhookSecret = request.headers.get("x-webhook-secret");
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, table, record } = body;

    // Handle new user signup
    if (type === "INSERT" && table === "auth.users") {
      const supabaseUserId = record.id;
      const email = record.email;

      // You may need to get organizationId from metadata or another source
      // For now, this is a placeholder - adjust based on your signup flow
      const organizationId = record.raw_user_meta_data?.organizationId;

      if (!organizationId) {
        console.warn("No organizationId found in user metadata");
        return NextResponse.json(
          { error: "Organization ID required" },
          { status: 400 }
        );
      }

      await syncUserFromSupabase(
        supabaseUserId,
        email,
        organizationId,
        record.raw_user_meta_data?.name,
        {
          dob: record.raw_user_meta_data?.dob,
          mobilePhone: record.raw_user_meta_data?.mobilePhone,
          countryCode: record.raw_user_meta_data?.countryCode,
          tocAccepted: record.raw_user_meta_data?.tocAccepted,
          tocAcceptedAt: record.raw_user_meta_data?.tocAcceptedAt,
          liabilityWaiverAccepted:
            record.raw_user_meta_data?.liabilityWaiverAccepted,
          liabilityWaiverAcceptedAt:
            record.raw_user_meta_data?.liabilityWaiverAcceptedAt,
        }
      );

      return NextResponse.json({ success: true });
    }

    // Handle user updates
    if (type === "UPDATE" && table === "auth.users") {
      const supabaseUserId = record.id;
      const email = record.email;

      // Parse date of birth if provided
      let dateOfBirth: Date | null = null;
      if (record.raw_user_meta_data?.dob) {
        try {
          dateOfBirth = new Date(record.raw_user_meta_data.dob);
          if (isNaN(dateOfBirth.getTime())) {
            dateOfBirth = null;
          }
        } catch (e) {
          console.warn(
            "Invalid date of birth format:",
            record.raw_user_meta_data.dob
          );
        }
      }

      // Parse TOC and liability waiver acceptance dates
      let tocAcceptedAt: Date | null = null;
      let liabilityWaiverAcceptedAt: Date | null = null;
      if (record.raw_user_meta_data?.tocAcceptedAt) {
        try {
          tocAcceptedAt = new Date(record.raw_user_meta_data.tocAcceptedAt);
          if (isNaN(tocAcceptedAt.getTime())) tocAcceptedAt = null;
        } catch (e) {
          console.warn(
            "Invalid TOC accepted date format:",
            record.raw_user_meta_data.tocAcceptedAt
          );
        }
      }
      if (record.raw_user_meta_data?.liabilityWaiverAcceptedAt) {
        try {
          liabilityWaiverAcceptedAt = new Date(
            record.raw_user_meta_data.liabilityWaiverAcceptedAt
          );
          if (isNaN(liabilityWaiverAcceptedAt.getTime()))
            liabilityWaiverAcceptedAt = null;
        } catch (e) {
          console.warn(
            "Invalid liability waiver accepted date format:",
            record.raw_user_meta_data.liabilityWaiverAcceptedAt
          );
        }
      }

      const updateData: any = {
        email,
        name: record.raw_user_meta_data?.name || null,
        dateOfBirth: dateOfBirth !== null ? dateOfBirth : undefined,
        mobilePhone: record.raw_user_meta_data?.mobilePhone || undefined,
        countryCode: record.raw_user_meta_data?.countryCode || undefined,
      };

      // Only update TOC and liability waiver if provided in metadata
      if (record.raw_user_meta_data?.tocAccepted !== undefined) {
        updateData.tocAccepted = record.raw_user_meta_data.tocAccepted;
        updateData.tocAcceptedAt =
          tocAcceptedAt !== null ? tocAcceptedAt : undefined;
      }
      if (record.raw_user_meta_data?.liabilityWaiverAccepted !== undefined) {
        updateData.liabilityWaiverAccepted =
          record.raw_user_meta_data.liabilityWaiverAccepted;
        updateData.liabilityWaiverAcceptedAt =
          liabilityWaiverAcceptedAt !== null
            ? liabilityWaiverAcceptedAt
            : undefined;
      }

      await prisma.user.updateMany({
        where: { supabaseUserId },
        data: updateData,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Event not handled" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
