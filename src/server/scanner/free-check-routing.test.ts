import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";
import { MockProvider } from "@/server/integrations/mock/provider";

/**
 * FIX-06 H2: reservation routing + provider ordering (mocked clients).
 * Cross-instance atomicity itself is proven on real Postgres in
 * consume-free-check.integration.test.ts; these tests pin that every path
 * funnels through the reservation and that providers run only after success.
 */

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();

function chainClient(opts: {
  member?: boolean;
  orgGrant?: boolean;
  userGrant?: { source: string; expires_at: string | null } | null;
  rpcRow?: Record<string, unknown> | null;
  rpcError?: { code: string; message: string } | null;
}) {
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const rpc = vi.fn(async (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args });
    if (fn === "consume_free_check") {
      if (opts.rpcError) return { data: null, error: opts.rpcError };
      return { data: opts.rpcRow ?? { id: "scan-rpc" }, error: null };
    }
    if (fn === "has_tool_access") return { data: !!opts.orgGrant, error: null };
    return { data: null, error: { message: "unknown fn" } };
  });
  const from = vi.fn((table: string) => {
    const self: Record<string, unknown> = {};
    const terminal = async () => {
      if (table === "tools") return { data: { id: TOOL_ID, slug: "sponsor-sentinel", is_active: true }, error: null };
      if (table === "organization_members") return { data: opts.member === false ? null : { id: "m1" }, error: null };
      if (table === "user_tool_entitlements") return { data: opts.userGrant ?? null, error: null };
      if (table === "organizations") return { data: { id: "org-a", owner_id: "user-1" }, error: null };
      return { data: null, error: null };
    };
    self.select = () => self;
    self.eq = () => self;
    self.order = () => self;
    self.limit = () => self;
    self.or = () => self;
    self.in = () => self;
    self.gte = () => self;
    self.single = terminal;
    self.maybeSingle = terminal;
    self.then = (resolve: (v: unknown) => void) => {
      if (table === "tool_entitlements") {
        resolve({ data: opts.orgGrant ? [{ is_all_access: false, tool_id: TOOL_ID, expires_at: null }] : [], error: null });
      } else if (table === "organization_members") {
        // listMemberOrganizationIds (awaited list path — distinct from the
        // maybeSingle membership terminal above).
        resolve({ data: opts.member === false ? [] : [{ organization_id: "org-a" }], error: null });
      } else resolve({ data: [], error: null });
    };
    return self;
  });
  return { client: { from, rpc } as unknown as SupabaseClient, rpcCalls };
}

const CAMP = {
  id: "camp-1",
  organization_id: "org-a",
  name: "Camp",
  description: null,
  status: "active",
  starts_at: "2026-03-01T00:00:00Z",
  ends_at: "2026-12-31T00:00:00Z",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
} as never;

const CH = {
  id: "ch-1",
  organization_id: "org-a",
  platform: "twitch",
  external_channel_id: "ext-1",
  external_handle: "@h",
  display_name: null,
  canonical_url: "https://twitch.tv/h",
  connection_mode: "discovered",
  connection_status: "connected",
  authorized_at: null,
  metadata: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
} as never;

const DEL = {
  id: "del-1",
  organization_id: "org-a",
  campaign_id: "camp-1",
  name: "Del",
  description: null,
  rule: { type: "required_title_contains", value: "BrandX" },
  status: "active",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
} as never;

function countingProviders() {
  const twitch = new MockProvider("twitch");
  const live = vi.spyOn(twitch, "getLiveState");
  const videos = vi.spyOn(twitch, "listVideos");
  return {
    providers: {
      twitch,
      youtube: new MockProvider("youtube"),
      kick: new MockProvider("kick"),
    },
    live,
    videos,
  };
}

function setupRepos() {
  vi.spyOn(campaignRepo, "findSponsorCampaignById").mockResolvedValue(CAMP);
  vi.spyOn(campaignRepo, "listSponsorCampaignsByOrg").mockResolvedValue([CAMP]);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue([DEL]);
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue([CH]);
  vi.spyOn(evidenceRepo, "createEvidenceBatch").mockResolvedValue([]);
  vi.spyOn(evaluationRepo, "createEvaluationsBatch").mockResolvedValue([]);
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => ({ id, ...patch }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("orchestrator provider ordering (free path)", () => {
  it("RPC quota failure → zero provider calls, no silent scan", async () => {
    setupRepos();
    const { client } = chainClient({
      userGrant: { source: "free", expires_at: null },
      rpcError: { code: "SFQ01", message: "quota_exceeded:budget: x" },
    });
    const { providers, live, videos } = countingProviders();
    await expect(
      executeScan({ supabase: client, input: { organizationId: "org-a", campaignId: "camp-1", userId: "user-1" }, providers }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(live).not.toHaveBeenCalled();
    expect(videos).not.toHaveBeenCalled();
  });

  it("RPC success → exactly one provider fetch set, then persist", async () => {
    setupRepos();
    const { client } = chainClient({
      userGrant: { source: "free", expires_at: null },
      rpcRow: { id: "scan-rpc", organization_id: "org-a", campaign_id: "camp-1", platform: "twitch", status: "pending", started_at: new Date().toISOString() },
    });
    const { providers, live, videos } = countingProviders();
    const res = await executeScan({
      supabase: client,
      input: { organizationId: "org-a", campaignId: "camp-1", userId: "user-1" },
      providers,
    });
    expect(res.scan.id).toBe("scan-rpc");
    expect(live).toHaveBeenCalledTimes(1);
    expect(videos).toHaveBeenCalledTimes(1);
  });

  it("paid caller never touches the RPC (direct path preserved)", async () => {
    setupRepos();
    const trySpy = vi.spyOn(scanRepo, "tryCreateScanWithLock").mockResolvedValue({ id: "scan-paid" } as never);
    const { client, rpcCalls } = chainClient({ userGrant: { source: "subscription", expires_at: FUTURE } });
    const { providers } = countingProviders();
    const res = await executeScan({
      supabase: client,
      input: { organizationId: "org-a", campaignId: "camp-1", userId: "user-1" },
      providers,
    });
    expect(res.scan.id).toBe("scan-paid");
    expect(trySpy).toHaveBeenCalledTimes(1);
    expect(rpcCalls.some((c) => c.fn === "consume_free_check")).toBe(false);
  });
});
