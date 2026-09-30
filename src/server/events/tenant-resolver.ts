import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";

/**
 * Resolve organization_id from trusted server-side connected_channels.
 * Never trust organization_id from webhook payload/header/query.
 * Returns null if no connected channel matches (unmapped/ignored).
 */
export async function resolveTenantForWebhook(
  supabase: SupabaseClient,
  provider: Platform,
  externalChannelId: string | null,
): Promise<string | null> {
  if (!externalChannelId) return null;
  const { data, error } = await supabase
    .from("connected_channels")
    .select("organization_id")
    .eq("platform", provider)
    .eq("external_channel_id", externalChannelId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as { organization_id: string };
  return row.organization_id ?? null;
}
