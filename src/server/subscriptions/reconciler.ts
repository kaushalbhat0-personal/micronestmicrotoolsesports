import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import { createTwitchClient } from "@/server/integrations/twitch/client";
import { TwitchSubscriptionAdapter } from "./twitch";
import { createKickClient } from "@/server/integrations/kick/client";
import { KickSubscriptionAdapter } from "./kick";
import { YouTubeSubscriptionAdapter } from "./youtube";
import type { ConnectedChannel } from "@/types/database";

export type ReconcileRunResult = {
  readonly runId: string;
  readonly attempted: number;
  readonly created: number;
  readonly alreadyExists: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly errors: Array<{ organizationId: string; channelId: string; provider: Platform; errorKind: string }>;
};

/**
 * Narrow reconciliation — desired = connected_channels where connection_status=connected
 * and platform supports webhooks. Bound sequential, failure isolated.
 */
export async function reconcileAllSubscriptions(
  supabase: SupabaseClient,
  opts?: { runId?: string; fetchFn?: typeof fetch },
): Promise<ReconcileRunResult> {
  const runId = opts?.runId ?? crypto.randomUUID();
  const start = Date.now();
  const fetchFn = opts?.fetchFn ?? fetch;

  // Discover channels from trusted DB (service_role)
  const { data: channels, error } = await supabase.from("connected_channels").select("*").eq("connection_status", "connected");
  if (error) throw error;
  const list = (channels ?? []) as ConnectedChannel[];

  // Adapters are created per-channel below to respect organization credentials (resolver with fallback)
  const youtubeAdapterFallback = new YouTubeSubscriptionAdapter(fetchFn);

  let attempted = 0;
  let created = 0;
  let alreadyExists = 0;
  let failed = 0;
  const errors: ReconcileRunResult["errors"] = [];

  // Bounded sequential — not Promise.all
  for (const ch of list) {
    const provider = ch.platform as Platform;
    const externalChannelId = ch.external_channel_id;
    const organizationId = ch.organization_id;

    // Skip if provider not supports webhooks (all three do)
    let adapter: { reconcileForChannel: (input: { organizationId: string; platform: Platform; externalChannelId: string }) => Promise<{ created: number; alreadyExists: number; failed: number }> } | null = null;
    if (provider === "twitch") {
      const { resolveTwitchCredentials } = await import("@/server/credentials/resolver");
      const creds = await resolveTwitchCredentials(supabase, organizationId);
      let client: ReturnType<typeof createTwitchClient> = null;
      if (creds) {
        const { TwitchClient: TC } = await import("@/server/integrations/twitch/client");
        client = new TC({ clientId: creds.clientId, clientSecret: creds.clientSecret }, fetchFn);
      } else {
        client = createTwitchClient(fetchFn);
      }
      if (client) adapter = new TwitchSubscriptionAdapter(client);
    } else if (provider === "kick") {
      const { resolveKickCredentials } = await import("@/server/credentials/resolver");
      const creds = await resolveKickCredentials(supabase, organizationId);
      let client: ReturnType<typeof createKickClient> = null;
      if (creds) {
        const { KickClient: KC } = await import("@/server/integrations/kick/client");
        client = new KC({ clientId: creds.clientId, clientSecret: creds.clientSecret }, fetchFn);
      } else {
        client = createKickClient(fetchFn);
      }
      if (client) adapter = new KickSubscriptionAdapter(client);
    } else if (provider === "youtube") {
      // YouTube uses verify token, not API key for WebSub; but check org credential fallback for API key not needed here
      adapter = youtubeAdapterFallback;
    } else continue;

    if (!adapter) {
      continue;
    }

    attempted++;
    const channelStart = Date.now();
    try {
      const res = await adapter.reconcileForChannel({ organizationId, platform: provider, externalChannelId });
      created += res.created;
      alreadyExists += res.alreadyExists;
      failed += res.failed;
      console.warn(
        JSON.stringify({
          event: "subscription_reconcile_channel",
          runId,
          organizationId,
          channelId: ch.id,
          provider,
          externalChannelId,
          created: res.created,
          alreadyExists: res.alreadyExists,
          failed: res.failed,
          durationMs: Date.now() - channelStart,
        }),
      );
    } catch (e) {
      failed++;
      const kind = (e as { kind?: string }).kind ?? "server";
      errors.push({ organizationId, channelId: ch.id, provider, errorKind: kind });
      console.warn(
        JSON.stringify({
          event: "subscription_reconcile_failed",
          runId,
          organizationId,
          channelId: ch.id,
          provider,
          externalChannelId,
          errorKind: kind,
          durationMs: Date.now() - channelStart,
        }),
      );
      // continue — one failure does not abort run
    }
  }

  const durationMs = Date.now() - start;
  console.warn(JSON.stringify({ event: "subscription_reconcile_completed", runId, attempted, created, alreadyExists, failed, durationMs }));
  return { runId, attempted, created, alreadyExists, failed, durationMs, errors };
}

/**
 * Tenant-safe single channel subscribe — verifies organization ownership before provider call.
 */
export async function subscribeChannelForOrg(
  supabase: SupabaseClient,
  input: { organizationId: string; platform: Platform; externalChannelId: string; userId: string },
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; errorKind?: string }> {
  // Verify channel belongs to org
  const { data: channel, error } = await supabase
    .from("connected_channels")
    .select("id, organization_id, platform, external_channel_id")
    .eq("organization_id", input.organizationId)
    .eq("platform", input.platform)
    .eq("external_channel_id", input.externalChannelId)
    .maybeSingle();
  if (error || !channel) return { ok: false, errorKind: "not_found" };

  // Verify user is member (defense in depth — caller should have already checked)
  const { data: membership } = await supabase.from("organization_members").select("id").eq("organization_id", input.organizationId).eq("user_id", input.userId).maybeSingle();
  if (!membership) return { ok: false, errorKind: "unauthorized" };

  // Provider/type check via adapter capabilities — resolve org credentials with env fallback
  type CreateAdapter = { create: (i: { organizationId: string; platform: Platform; externalChannelId: string; eventType: string }) => Promise<{ status: string; errorKind?: string }> };
  let adapter: CreateAdapter | null = null;
  let eventTypes: readonly string[] = [];
  if (input.platform === "twitch") {
    const { resolveTwitchCredentials: rtc } = await import("@/server/credentials/resolver");
    const creds = await rtc(supabase, input.organizationId);
    let c: ReturnType<typeof createTwitchClient> = null;
    if (creds) {
      const { TwitchClient: TC } = await import("@/server/integrations/twitch/client");
      c = new TC({ clientId: creds.clientId, clientSecret: creds.clientSecret }, fetchFn);
    } else {
      c = createTwitchClient(fetchFn);
    }
    if (!c) return { ok: false, errorKind: "not_configured" };
    adapter = new TwitchSubscriptionAdapter(c) as unknown as CreateAdapter;
    eventTypes = ["stream.online", "stream.offline", "channel.update"];
  } else if (input.platform === "kick") {
    const { resolveKickCredentials: rkc } = await import("@/server/credentials/resolver");
    const creds = await rkc(supabase, input.organizationId);
    let c: ReturnType<typeof createKickClient> = null;
    if (creds) {
      const { KickClient: KC } = await import("@/server/integrations/kick/client");
      c = new KC({ clientId: creds.clientId, clientSecret: creds.clientSecret }, fetchFn);
    } else {
      c = createKickClient(fetchFn);
    }
    if (!c) return { ok: false, errorKind: "not_configured" };
    adapter = new KickSubscriptionAdapter(c) as unknown as CreateAdapter;
    eventTypes = ["livestream.metadata.updated", "livestream.status.updated"];
  } else if (input.platform === "youtube") {
    adapter = new YouTubeSubscriptionAdapter(fetchFn) as unknown as CreateAdapter;
    eventTypes = ["video_published"];
  }

  if (!adapter) return { ok: false, errorKind: "unsupported" };

  for (const et of eventTypes) {
    const res = await adapter.create({ organizationId: input.organizationId, platform: input.platform, externalChannelId: input.externalChannelId, eventType: et });
    if (res.status === "failed" || res.status === "unsupported") return { ok: false, errorKind: res.errorKind ?? "server" };
  }
  return { ok: true };
}
