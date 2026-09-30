import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/errors";

/**
 * Stripe webhook — stub establishing secure pattern.
 * Future: verify signature, check idempotency via webhook_events, delegate to billing service.
 */

export async function POST(_request: Request) {
  try {
    // 1. Verify signature — requires STRIPE_WEBHOOK_SECRET
    // const sig = request.headers.get("stripe-signature");
    // if (!sig) throw validationError("Missing stripe-signature");
    // const event = stripe.webhooks.constructEvent(await request.text(), sig, secret);

    // 2. Idempotency — insert into webhook_events (provider_event_id unique)
    // 3. Delegate to server/services/billing

    console.warn("[webhook:stripe] received — not yet implemented (foundation stub)");

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
