import type { SupabaseClient } from "@supabase/supabase-js";
import { BgmiOwnershipRateLimitError } from "../../domain/bgmi-ownership";
import { BGMI_OWNERSHIP_RATE_LIMITS } from "../../schemas/bgmi-ownership";

export type BgmiOwnershipRateEventType = keyof typeof BGMI_OWNERSHIP_RATE_LIMITS;

/**
 * Durable per-user rate limit via SECURITY DEFINER RPC + rate_events table.
 * Not distributed across multiple databases; sufficient single-project abuse brake.
 */
export async function assertBgmiOwnershipRateLimit(
  client: SupabaseClient,
  eventType: BgmiOwnershipRateEventType,
): Promise<void> {
  const cfg = BGMI_OWNERSHIP_RATE_LIMITS[eventType];
  const { error } = await client.rpc("assert_bgmi_ownership_rate_limit", {
    p_event_type: eventType,
    p_limit: cfg.limit,
    p_window_seconds: cfg.windowSeconds,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("rate limit") || error.code === "P0001") {
      throw new BgmiOwnershipRateLimitError();
    }
    throw new BgmiOwnershipRateLimitError();
  }
}
