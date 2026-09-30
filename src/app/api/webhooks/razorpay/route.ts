import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/errors";

/**
 * Razorpay webhook — stub, same pattern as Stripe.
 */

export async function POST(_request: Request) {
  try {
    console.warn("[webhook:razorpay] received — not yet implemented (foundation stub)");
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
