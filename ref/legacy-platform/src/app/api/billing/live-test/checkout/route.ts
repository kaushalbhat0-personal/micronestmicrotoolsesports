import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, validationError } from "@/lib/errors";
import { createLiveTestCheckoutOrder } from "@/server/billing/live-test-service";

const bodySchema = z.object({
  planId: z.string().uuid("planId must be a valid UUID"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    if (!json) throw validationError("Invalid JSON body");

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw validationError("Invalid live-test checkout request", parsed.error.flatten());
    }

    // Reject ANY pricing/control field injection — fail closed
    const extra = json as Record<string, unknown>;
    if (
      "amountMinor" in extra ||
      "amount_minor" in extra ||
      "amount" in extra ||
      "price" in extra ||
      "currency" in extra ||
      "toolId" in extra ||
      "tool_id" in extra ||
      "isAllAccess" in extra ||
      "is_all_access" in extra ||
      "billingPeriod" in extra ||
      "billing_period" in extra ||
      "organizationId" in extra ||
      "organization_id" in extra ||
      "orgId" in extra ||
      "userId" in extra ||
      "user_id" in extra ||
      "email" in extra
    ) {
      throw validationError("Client-controlled pricing/org fields not allowed");
    }

    const result = await createLiveTestCheckoutOrder({
      planId: parsed.data.planId,
    });

    if (!result.keyId) {
      throw validationError("Payment not configured");
    }

    return NextResponse.json(
      {
        orderId: result.orderId,
        razorpayOrderId: result.razorpayOrderId,
        amountMinor: result.amountMinor,
        currency: result.currency,
        keyId: result.keyId,
        planId: result.planId,
        isLiveTest: true,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
