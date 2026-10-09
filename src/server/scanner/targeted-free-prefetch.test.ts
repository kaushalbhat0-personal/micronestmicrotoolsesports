import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as scanRepo from "@/server/repositories/scans";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as tokenService from "@/server/credentials/token-service";
import { YouTubeClient } from "@/server/integrations/youtube/client";
import { executeTargetedYouTubeScan } from "./scan-targeted-youtube";
import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";

/**
 * FIX-06 C5: covered campaign is resolved BEFORE provider videos.list.
 * Quota failure afterwards means zero scan processing (the single read spent
 * to determine timeframe eligibility is never followed by reservation).
 */

const mockResolvePrincipal = vi.fn(
  async (): Promise<{ level: "paid" | "free" | "none"; userId: string | null }> => ({ level: "free", userId: "owner-9" }),
);
const mockHasBudget = vi.fn(async () => true);
const mockCoveredCampaign = vi.fn(async (): Promise<string | null> => "camp-1");
const mockReserve = vi.fn(async () => ({ scan: { id: "scan-1" }, freePath: true }));

vi.mock("@/server/services/sponsorship-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/sponsorship-limits")>();
  return {
    ...actual,
    resolveOrgCheckPrincipal: (...a: unknown[]) => (mockResolvePrincipal as (...x: unknown[]) => unknown)(...a),
    hasFreeChecksRemaining: (...a: unknown[]) => (mockHasBudget as (...x: unknown[]) => unknown)(...a),
    getFreeCoveredCampaignId: (...a: unknown[]) => (mockCoveredCampaign as (...x: unknown[]) => unknown)(...a),
    reserveFreeCheckOrThrow: (...a: unknown[]) => (mockReserve as (...x: unknown[]) => unknown)(...a),
  };
});

const ORG = "org-a";
const CHAN = "UC123";
const VID = "vid123";

function event(): CanonicalWebhookEvent {
  return {
    provider: "youtube",
    externalEventId: VID,
    eventType: "video_published",
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    externalChannelId: CHAN,
    externalContentId: VID,
    payload: {},
  } as CanonicalWebhookEvent;
}

function client(): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === "connected_channels") {
        return { select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { organization_id: ORG }, error: null }) }) }) }) }) } as never;
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as never;
    },
    // Org-level coverage resolves paid here; the free-quota assertions run
    // through the mocked limits module + reserve mock above.
    rpc: async () => ({ data: true, error: null }),
  } as unknown as SupabaseClient;
}

function setupDomain() {
  vi.spyOn(campaignRepo, "listSponsorCampaignsByOrg").mockResolvedValue([
    { id: "camp-1", organization_id: ORG, name: "C", description: null, status: "active", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-12-31T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } as never,
  ]);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue([
    { id: "del-1", organization_id: ORG, campaign_id: "camp-1", name: "D", description: null, rule: { type: "required_title_contains", value: "BrandX" }, status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } as never,
  ]);
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue([
    { id: "ch-1", organization_id: ORG, platform: "youtube", external_channel_id: CHAN, external_handle: "@h", display_name: null, canonical_url: "x", connection_mode: "discovered", connection_status: "connected", authorized_at: null, metadata: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } as never,
  ]);
  vi.spyOn(tokenService, "getValidAccessToken").mockResolvedValue({ ok: true, accessToken: "tok", expiresAt: null, provider: "youtube" } as never);
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => ({ id, ...patch }) as never);
  vi.spyOn(evidenceRepo, "createEvidenceBatch").mockImplementation(async (_s, inputs) =>
    (inputs as unknown[]).map((inp, i) => ({ id: `ev-${i}`, ...(inp as Record<string, unknown>) })) as never,
  );
  vi.spyOn(evaluationRepo, "createEvaluationsBatch").mockImplementation(async (_s, inputs) =>
    (inputs as unknown[]).map((inp, i) => ({ id: `eval-${i}`, ...(inp as Record<string, unknown>) })) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mockResolvePrincipal.mockResolvedValue({ level: "free", userId: "owner-9" });
  mockHasBudget.mockResolvedValue(true);
  mockCoveredCampaign.mockResolvedValue("camp-1");
  mockReserve.mockResolvedValue({ scan: { id: "scan-1" }, freePath: true });
  setupDomain();
});

describe("targeted free coverage before provider fetch", () => {
  it("no covered campaign → videos.list never called, zero scans", async () => {
    mockCoveredCampaign.mockResolvedValue(null);
    const videosList = vi.spyOn(YouTubeClient.prototype, "videosList");
    const res = await executeTargetedYouTubeScan(client(), event());
    expect(res).toMatchObject({ attempted: 0, succeeded: 0, skipped: 0 });
    expect(videosList).not.toHaveBeenCalled();
    expect(mockReserve).not.toHaveBeenCalled();
  });

  it("covered campaign → fetch, then reserve, then process", async () => {
    const videosList = vi.spyOn(YouTubeClient.prototype, "videosList").mockResolvedValue({
      items: [{ id: VID, snippet: { title: "BrandX video", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-15T12:00:00Z", channelId: CHAN, liveBroadcastContent: "none" }, contentDetails: { duration: "PT30S" } }],
    } as never);
    const res = await executeTargetedYouTubeScan(client(), event());
    expect(videosList).toHaveBeenCalledTimes(1);
    expect(mockReserve).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "owner-9", organizationId: ORG, campaignId: "camp-1" }),
    );
    expect(res.succeeded).toBe(1);
  });

  it("reservation quota failure → skipped, no persist beyond the read", async () => {
    vi.spyOn(YouTubeClient.prototype, "videosList").mockResolvedValue({
      items: [{ id: VID, snippet: { title: "BrandX video", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-15T12:00:00Z", channelId: CHAN, liveBroadcastContent: "none" }, contentDetails: { duration: "PT30S" } }],
    } as never);
    const quotaErr = Object.assign(new Error("You've used all 10 free checks this month."), { code: "VALIDATION_ERROR" });
    (quotaErr as unknown as Record<string, unknown>).details = { freeQuota: "checks" };
    mockReserve.mockRejectedValueOnce(quotaErr);
    const res = await executeTargetedYouTubeScan(client(), event());
    expect(res.succeeded).toBe(0);
    expect(res.scanIds).toHaveLength(0);
  });
});
