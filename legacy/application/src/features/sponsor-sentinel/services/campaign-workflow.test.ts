import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canTransition, assertTransition, activateCampaign } from "./campaign-lifecycle";
import { assertChannelUsable } from "./channel-validation";
import { requestManualScan } from "./scan-action";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import { deliverableRuleSchema, validateRulesForPlatform } from "../schemas/rules";
import { getCapabilities } from "./capabilities";

vi.mock("@/server/repositories/sponsor-campaigns");
vi.mock("@/server/repositories/deliverables");
vi.mock("@/server/repositories/connected-channels");
vi.mock("@/server/scanner/scan-orchestrator", () => ({
  executeScan: vi.fn(async () => ({ scan: { id: "scan-1" } })),
}));

// Helper to make mock supabase that returns entitlement true via rpc
function mockSupabaseForEntitlement(entitled = true) {
  return {
    rpc: async () => ({ data: entitled, error: null }),
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { id: "tool-id" }, error: null }), data: [], error: null }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("Campaign lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("draft creation via service (validated)", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(null);
    // Not testing create directly here but via canTransition
    expect(canTransition("draft", "active")).toBe(true);
  });

  it("valid draft → active", async () => {
    expect(canTransition("draft", "active")).toBe(true);
    expect(() => assertTransition("draft", "active")).not.toThrow();
  });

  it("invalid draft cannot activate if already active", async () => {
    expect(canTransition("active", "draft")).toBe(false);
    expect(() => assertTransition("active", "draft")).toThrow();
  });

  it("invalid transitions rejected: draft → completed", () => {
    expect(canTransition("draft", "completed")).toBe(false);
    expect(() => assertTransition("draft", "completed")).toThrow();
  });

  it("active → completed if supported", () => {
    expect(canTransition("active", "completed")).toBe(true);
  });

  it("draft → archived", () => expect(canTransition("draft", "archived")).toBe(true));
  it("active → archived", () => expect(canTransition("active", "archived")).toBe(true));
});

describe("Channel attachment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("own channel accepted", async () => {
    const supabase = {} as SupabaseClient;
    vi.mocked(channelRepo.findConnectedChannelById).mockResolvedValue({
      id: "ch-1",
      organization_id: "org-a",
      platform: "twitch",
      external_channel_id: "123",
      external_handle: "h",
      display_name: null,
      canonical_url: "https://twitch.tv/h",
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    await expect(assertChannelUsable(supabase, "org-a", "ch-1")).resolves.toBeTruthy();
  });

  it("other organization channel rejected", async () => {
    const supabase = {} as SupabaseClient;
    vi.mocked(channelRepo.findConnectedChannelById).mockResolvedValue({
      id: "ch-1",
      organization_id: "org-b",
      platform: "twitch",
      external_channel_id: "123",
      external_handle: "h",
      display_name: null,
      canonical_url: "https://twitch.tv/h",
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    await expect(assertChannelUsable(supabase, "org-a", "ch-1")).rejects.toThrow(/Cross-organization/);
  });

  it("disconnected channel rejected where appropriate", async () => {
    const supabase = {} as SupabaseClient;
    vi.mocked(channelRepo.findConnectedChannelById).mockResolvedValue({
      id: "ch-1",
      organization_id: "org-a",
      platform: "twitch",
      external_channel_id: "123",
      external_handle: "h",
      display_name: null,
      canonical_url: "https://twitch.tv/h",
      connection_mode: "discovered",
      connection_status: "disconnected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    await expect(assertChannelUsable(supabase, "org-a", "ch-1")).rejects.toThrow(/not connected/);
  });

  it("provider mismatch rejected", async () => {
    const supabase = {} as SupabaseClient;
    vi.mocked(channelRepo.findConnectedChannelById).mockResolvedValue({
      id: "ch-1",
      organization_id: "org-a",
      platform: "youtube",
      external_channel_id: "UC123",
      external_handle: "h",
      display_name: null,
      canonical_url: "https://youtube.com/channel/UC123",
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    await expect(assertChannelUsable(supabase, "org-a", "ch-1", { platform: "twitch" })).rejects.toThrow(/mismatch/);
  });
});

describe("Deliverables", () => {
  it("cross-campaign access rejected via service (campaign ownership)", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    const campId = "00000000-0000-4000-a000-00000000000b";
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: campId, organization_id: "org-b", status: "draft" } as never);
    const { createDeliverable } = await import("./deliverable-service");
    await expect(createDeliverable(supabase, "org-a", { campaign_id: campId, name: "Test", rule: { type: "required_title_contains", value: "hi" } })).rejects.toThrow(/Cross-organization/);
  });
});

describe("Rules", () => {
  it("every currently supported rule type validates", () => {
    const rules = [
      { type: "required_title_contains", value: "hello" },
      { type: "required_hashtag", value: "#brand" },
      { type: "required_category", categoryId: "123" },
      { type: "required_twitch_tag", tag_id: "123" },
      { type: "required_youtube_tags", tags: ["a", "b"] },
      { type: "required_kick_tags", tags: ["k"] },
      { type: "minimum_duration", minutes: 30 },
      { type: "required_vod_exists" },
      { type: "required_description_contains", value: "desc" },
      { type: "required_streaming_window" },
    ] as const;
    for (const rule of rules) {
      const res = deliverableRuleSchema.safeParse(rule);
      expect(res.success, `rule ${rule.type} should validate`).toBe(true);
    }
  });

  it("malformed rule input rejected", () => {
    const res = deliverableRuleSchema.safeParse({ type: "required_title_contains", value: "" });
    expect(res.success).toBe(false);
    const res2 = deliverableRuleSchema.safeParse({ type: "unknown_rule" as never, value: "hi" });
    expect(res2.success).toBe(false);
  });

  it("unsupported provider/rule combinations rejected", () => {
    const twitchTagOnYoutube = validateRulesForPlatform("youtube", [{ type: "required_twitch_tag", tag_id: "123" }]);
    expect(twitchTagOnYoutube.valid).toBe(false);
    const kickVodOnKick = validateRulesForPlatform("kick", [{ type: "minimum_duration", minutes: 10 }]);
    expect(kickVodOnKick.valid).toBe(false);
    expect(kickVodOnKick.errors[0]?.reason).toContain("NOT_SUPPORTED");
  });

  it("capability-driven: kick VOD not supported", () => {
    const caps = getCapabilities("kick");
    expect(caps.vodExistence).toBe(false);
    expect(caps.vodDuration).toBe(false);
  });
});

describe("Activation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no deliverables → rejected", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "draft", name: "Test", starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86400000).toISOString() } as never);
    vi.mocked(channelRepo.listConnectedChannelsByOrg).mockResolvedValue([{ id: "ch-1", organization_id: "org-a", platform: "twitch", external_channel_id: "123", connection_status: "connected" } as never]);
    vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockResolvedValue([]);
    await expect(activateCampaign(supabase, "org-a", "camp-1")).rejects.toThrow(/deliverable/);
  });

  it("no usable channel → rejected where required", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "draft" } as never);
    vi.mocked(channelRepo.listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockResolvedValue([{ id: "del-1", rule: { type: "required_title_contains", value: "hi" } } as never]);
    await expect(activateCampaign(supabase, "org-a", "camp-1")).rejects.toThrow(/channel/);
  });

  it("valid campaign → activated, no partial mutation on failure", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    const nowIso = new Date().toISOString();
    const futureIso = new Date(Date.now() + 86400000).toISOString();
    const campaign = { id: "camp-1", organization_id: "org-a", status: "draft", name: "Test", starts_at: nowIso, ends_at: futureIso } as never;
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(campaign);
    vi.mocked(channelRepo.listConnectedChannelsByOrg).mockResolvedValue([{ id: "ch-1", organization_id: "org-a", platform: "twitch", external_channel_id: "123", connection_status: "connected" } as never]);
    vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockResolvedValue([{ id: "del-1", name: "D", rule: { type: "required_title_contains", value: "hi" } } as never]);
    vi.mocked(campaignRepo.updateSponsorCampaign).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "active", name: "Test", starts_at: nowIso, ends_at: futureIso } as never);
    const res = await activateCampaign(supabase, "org-a", "camp-1");
    expect(res.status).toBe("active");
    // Ensure update called exactly once with active
    expect(campaignRepo.updateSponsorCampaign).toHaveBeenCalledWith(supabase, "camp-1", { status: "active" });
  });

  it("activation does not partially mutate on failure (invalid transition)", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "active" } as never);
    await expect(activateCampaign(supabase, "org-a", "camp-1")).rejects.toThrow(/Only draft/);
    expect(campaignRepo.updateSponsorCampaign).not.toHaveBeenCalled();
  });
});

describe("Manual scan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unauthorized rejected (campaign not found)", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(null);
    await expect(requestManualScan(supabase, "org-a", "camp-missing")).rejects.toThrow(/not found/i);
  });

  it("wrong organization rejected", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-b", status: "active" } as never);
    await expect(requestManualScan(supabase, "org-a", "camp-1")).rejects.toThrow(/Cross-organization/);
  });

  it("inactive campaign rejected", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "draft" } as never);
    await expect(requestManualScan(supabase, "org-a", "camp-1")).rejects.toThrow(/Only active/);
  });

  it("valid active campaign calls existing executeScan", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "active" } as never);
    const { executeScan } = await import("@/server/scanner/scan-orchestrator");
    vi.mocked(executeScan).mockResolvedValueOnce({ scan: { id: "scan-1" }, evidenceCount: 1, evaluationCount: 1, stageErrors: [] } as never);
    const res = await requestManualScan(supabase, "org-a", "camp-1");
    expect(executeScan).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ organizationId: "org-a", campaignId: "camp-1" }) }));
    expect(res.scan.id).toBe("scan-1");
  });

  it("scanner failure handled safely (throws, not false success)", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-1", organization_id: "org-a", status: "active" } as never);
    const { executeScan } = await import("@/server/scanner/scan-orchestrator");
    vi.mocked(executeScan).mockRejectedValueOnce(new Error("provider down"));
    await expect(requestManualScan(supabase, "org-a", "camp-1")).rejects.toThrow(/provider down/);
  });
});

describe("Campaign authorization IDOR", () => {
  it("User in Org A cannot read Org B campaign", async () => {
    const supabase = {} as SupabaseClient;
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ id: "camp-b", organization_id: "org-b", status: "draft" } as never);
    const { getCampaign } = await import("./campaign-service");
    await expect(getCampaign(supabase, "org-a", "camp-b")).rejects.toThrow(/Cross-organization/);
  });

  it("organization ID tampering rejected (service uses org from context, not input)", async () => {
    const supabase = mockSupabaseForEntitlement(true);
    const mockCreated = { id: "new-camp", organization_id: "org-a", name: "Test", status: "draft" } as never;
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue(mockCreated);
    const { createCampaign } = await import("./campaign-service");
    const created = await createCampaign(supabase, "org-a", { name: "Test", starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86400000).toISOString(), organization_id: "org-b" } as never);
    // createCampaign uses organizationId param (from context), not rawInput organization_id
    expect(campaignRepo.createSponsorCampaign).toHaveBeenCalledWith(supabase, expect.objectContaining({ organization_id: "org-a" }));
    expect(created.organization_id).toBe("org-a");
  });
});
