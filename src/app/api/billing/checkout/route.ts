import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, validationError } from "@/lib/errors";
import { createCheckoutOrder } from "@/server/billing/checkout-service";

const bodySchema = z.object({
  planId: z.string().uuid("planId must be a valid UUID"),
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    if (!json) throw validationError("Invalid JSON body");

    // Strict: reject unexpected keys that would imply client-controlled pricing
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw validationError("Invalid checkout request", parsed.error.flatten());
    }

    // Reject if client tried to smuggle amount/currency/tool/buyer
    const extra = json as Record<string, unknown>;
    if ("amountMinor" in extra || "amount_minor" in extra || "currency" in extra || "toolId" in extra || "tool_id" in extra || "isAllAccess" in extra || "billingPeriod" in extra || "buyer_user_id" in extra || "buyerUserId" in extra || "buyerId" in extra || "user_id" in extra) {
      throw validationError("Client-controlled pricing fields not allowed");
    }

    const result = await createCheckoutOrder({
      planId: parsed.data.planId,
      organizationId: parsed.data.organizationId,
    });

    if (!result.keyId) {
      // Safe configuration error, no secret leak
      throw validationError("Payment not configured");
    }

    return NextResponse.json(
      {
        orderId: result.orderId,
        razorpayOrderId: result.razorpayOrderId,
        amountMinor: result.amountMinor,
        currency: result.currency,
        keyId: result.keyId,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
