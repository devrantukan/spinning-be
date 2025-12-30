import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganizationContext } from "@/lib/middleware";

// POST /api/contact - Create a new contact submission
export async function POST(request: NextRequest) {
  return withOrganizationContext(
    request,
    async (req, context) => {
      try {
        const body = await req.json();
        const { name, email, phone, message } = body;

        if (!name || !email || !message) {
          return NextResponse.json(
            { error: "Name, email, and message are required" },
            { status: 400 }
          );
        }

        const submission = await prisma.contactSubmission.create({
          data: {
            name,
            email,
            phone,
            message,
            organizationId: context.organizationId,
          },
        });

        return NextResponse.json(submission, { status: 201 });
      } catch (error) {
        console.error("[CONTACT] Error creating submission:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
    { requireAuth: false }
  );
}
