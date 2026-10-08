import type { SupabaseClient } from "@supabase/supabase-js";
import type { SponsorCampaign } from "@/types/database";
import { executeScan } from "@/server/scanner/scan-orchestrator";
import { AppError } from "@/lib/errors";

export interface EligibleCampaign {
  readonly campaign: SponsorCampaign;
  readonly organizationId: string;
}

export async function loadEligibleCampaigns(
  supabase: SupabaseClient,
): Promise<EligibleCampaign[]> {
  // One authoritative query: active campaigns only.
  // Uses service_role client so RLS bypassed, but we still scope to trusted records.
  const { data, error } = await supabase
    .from("sponsor_campaigns")
    .select("id, organization_id, name, status, starts_at, ends_at")
    .eq("status", "active");

  if (error) throw error;
  const campaigns = (data ?? []) as SponsorCampaign[];

  // Filter to those with at least one deliverable and one connected channel and entitled org.
  // We keep it readable and avoid N+1 explosions by batching checks where possible.
  const eligible: EligibleCampaign[] = [];

  for (const c of campaigns) {
    // Entitlement check: has_tool_access for sponsor-sentinel if RPC exists, otherwise check tool_entitlements.
    // For Cron we use service_role so we query entitlements directly.
    const hasEntitlement = await hasSponsorSentinelEntitlement(supabase, c.organization_id);
    if (!hasEntitlement) continue;

    const { count: deliverableCount } = await supabase
      .from("deliverables")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id);

    if (!deliverableCount || deliverableCount === 0) continue;

    const { count: channelCount } = await supabase
      .from("connected_channels")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", c.organization_id);

    if (!channelCount || channelCount === 0) continue;

    eligible.push({ campaign: c, organizationId: c.organization_id });
  }

  return eligible;
}

async function hasSponsorSentinelEntitlement(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  // Phase 3: shared org-coverage check — legacy org grant OR owner user grant.
  // No browser session is assumed here; data stays org-scoped under RLS.
  const { hasSponsorshipAccessForOrg } = await import("@/server/services/sponsorship-access");
  return hasSponsorshipAccessForOrg(supabase, organizationId);
}

export interface CronCampaignResult {
  readonly campaignId: string;
  readonly organizationId: string;
  readonly scanId?: string | undefined;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly errorKind?: string | undefined;
  readonly error?: string | undefined;
}

function classifyError(e: unknown): string {
  if (e instanceof AppError) {
    if (e.code === "FORBIDDEN" || e.code === "AUTHENTICATION_REQUIRED") return "auth";
    if (e.code === "NOT_FOUND") return "not_found";
    if (e.code === "RATE_LIMITED") return "rate_limited";
    if (e.code === "VALIDATION_ERROR") return "invalid_request";
    if (e.code === "INTEGRATION_ERROR") return "server";
    return "unknown";
  }
  // Provider errors carry kind property
  const maybe = e as { kind?: string; code?: string };
  if (typeof maybe.kind === "string") {
    if (["auth", "not_found", "rate_limited", "invalid_request", "server", "malformed", "network", "unsupported", "quota_exceeded", "rate_limited"].includes(maybe.kind)) return maybe.kind;
  }
  if (typeof maybe.code === "string" && maybe.code === "BUDGET_EXCEEDED") return "rate_limited";
  return "unknown";
}

function sanitizeErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // Remove any potential secret fragments, bound length
  const withoutSecret = raw.replace(/Bearer\s+[^\s]+/gi, "Bearer ***").replace(/key=[^&\s]+/gi, "key=***").replace(/secret[^"\s]*["']?/gi, "secret=***");
  return withoutSecret.slice(0, 200);
}

export async function runCampaignScans(
  supabase: SupabaseClient,
  campaigns: readonly EligibleCampaign[],
  opts?: { cronRunId?: string },
): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  results: CronCampaignResult[];
}> {
  const cronRunId = opts?.cronRunId;
  let succeeded = 0;
  let failed = 0;
  const results: CronCampaignResult[] = [];

  // Sequential execution to respect ProviderBudget and avoid unbounded concurrency.
  // Timeout analysis: each campaign does ~2-3 provider calls (Twitch/YouTube/Kick) + DB ops;
  // with MVP <20 active campaigns, sequential ~20*500ms=10s well within Vercel 60s. See comments below.
  for (const item of campaigns) {
    const campaignId = item.campaign.id;
    const organizationId = item.organizationId;
    const campaignStart = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    try {
      console.warn(
        JSON.stringify({
          event: "sentinel_campaign_started",
          cronRunId,
          campaignId,
          organizationId,
        }),
      );
      // executeScan already handles tenant isolation via campaign.organization_id check and RLS
      const res = await executeScan({ supabase, input: { organizationId, campaignId } });
      const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - campaignStart);
      const scanId = (res.scan as { id?: string })?.id;
      succeeded++;
      results.push({ campaignId, organizationId, scanId, ok: true, durationMs });
      console.warn(
        JSON.stringify({
          event: "sentinel_campaign_completed",
          cronRunId,
          campaignId,
          organizationId,
          scanId,
          durationMs,
          outcome: "success",
        }),
      );
    } catch (e) {
      const maybe = e as { code?: string };
      if (maybe?.code === "CONFLICT" || String((e as Error).message ?? "").includes("already running")) {
        const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - campaignStart);
        // Already running is not a failure — skip, allow B to run
        console.warn(JSON.stringify({ event: "sentinel_campaign_skipped_already_running", cronRunId, campaignId, organizationId, durationMs }));
        succeeded++;
        results.push({ campaignId, organizationId, ok: true, durationMs, errorKind: "already_running", error: "already running" });
        continue;
      }
      const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - campaignStart);
      const errorKind = classifyError(e);
      const msg = sanitizeErrorMessage(e);
      failed++;
      results.push({ campaignId, organizationId, ok: false, durationMs, errorKind, error: msg });
      console.warn(
        JSON.stringify({
          event: "sentinel_campaign_failed",
          cronRunId,
          campaignId,
          organizationId,
          durationMs,
          errorKind,
          error: msg,
        }),
      );
      // continue to next campaign — failure isolation
    }
  }

  return { attempted: campaigns.length, succeeded, failed, results };
}

// Analysis notes for 06B hardening (in-code documentation, no new DB table):
// - Overlapping runs: two Cron invocations for same campaign may both execute FETCH before PERSIST.
//   evidence_idempotency_unique (organization_id, deliverable_id, platform, source, source_id, observed_at)
//   prevents duplicate evidence rows. Scan records are append-only, so overlapping runs create two scans
//   (second is not suppressed). Upstream provider API calls CAN be duplicated (not prevented by DB).
//   No distributed lock is introduced in 06B as no safe persistent lock exists without new infrastructure (Redis/advisory lock).
//   This limitation is documented rather than inventing infrastructure.
// - Timeout: Vercel Node runtime default maxDuration ~60s (Pro 300s). Sequential 20 campaigns * ~3 Helix calls * ~200ms = ~12s DB+API, well within limit for MVP dataset (<20 active campaigns).
//   Potential risk if orgs scale to 100+ active campaigns: 100*3*200ms=60s could approach timeout. Recommendation: if eligible >50, future task should add cursor pagination/batching (e.g., process first 20 and re-invoke via rescheduled Cron).
// - Campaign limit: No LIMIT applied; MVP dataset small. Never silently truncate; if timeout risk measured, next task should batch.

