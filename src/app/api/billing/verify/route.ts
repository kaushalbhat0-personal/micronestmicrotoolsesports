import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, validationError } from "@/lib/errors";
import { verifyPaymentAndActivate } from "@/server/billing/verify-service";

const bodySchema = z.object({
  orderId: z.string().uuid("orderId must be a valid UUID"),
  razorpayOrderId: z.string().min(1, "razorpayOrderId required"),
  razorpayPaymentId: z.string().min(1, "razorpayPaymentId required"),
  razorpaySignature: z.string().min(1, "razorpaySignature required"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    if (!json) throw validationError("Invalid JSON body");

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw validationError("Invalid verification request", parsed.error.flatten());

    // Strict: reject unexpected pricing fields
    const extra = json as Record<string, unknown>;
    if ("amountMinor" in extra || "amount_minor" in extra || "currency" in extra) {
      throw validationError("Client-controlled amount/currency not allowed");
    }

    const result = await verifyPaymentAndActivate({
      orderId: parsed.data.orderId,
      razorpayOrderId: parsed.data.razorpayOrderId,
      razorpayPaymentId: parsed.data.razorpayPaymentId,
      razorpaySignature: parsed.data.razorpaySignature,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
