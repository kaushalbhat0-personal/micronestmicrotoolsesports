import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeScan } from "./scan-orchestrator";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { getMockProvider, resetMocks } from "@/server/integrations/mock/provider";

function setupMocks(opts: {
  orgId: string;
  campaignId: string;
  deliverables: Array<{ id: string; rule: unknown }>;
  channels: Array<{ platform: "twitch" | "youtube" | "kick"; external_channel_id: string }>;
}) {
  vi.spyOn(campaignRepo, "findSponsorCampaignById").mockResolvedValue({
    id: opts.campaignId,
    organization_id: opts.orgId,
    name: "Camp",
    description: null,
    status: "active",
    starts_at: "2026-03-01T00:00:00Z",
    ends_at: "2026-03-31T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue(
    opts.deliverables.map((d) => ({
      id: d.id,
      organization_id: opts.orgId,
      campaign_id: opts.campaignId,
      name: "Del",
      description: null,
      rule: d.rule,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as never,
  );
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue(
    opts.channels.map((c, i) => ({
      id: `ch-${i}`,
      organization_id: opts.orgId,
      platform: c.platform,
      external_channel_id: c.external_channel_id,
      external_handle: `handle-${i}`,
      display_name: null,
      canonical_url: `https://${c.platform}.com/handle-${i}`,
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as never,
  );
  const scans: Record<string, unknown>[] = [];
  vi.spyOn(scanRepo, "createScan").mockImplementation(async (_s, input) => {
    const scan = { id: `scan-${scans.length + 1}`, ...input, created_at: new Date().toISOString(), started_at: new Date().toISOString() } as never;
    scans.push(scan as Record<string, unknown>);
    return scan;
  });
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) Object.assign(found, patch);
    return { id, ...patch, organization_id: opts.orgId, campaign_id: opts.campaignId, platform: (found as Record<string, unknown>)?.["platform"] ?? "twitch", scanner_version: "v1" } as never;
  });
  vi.spyOn(scanRepo, "updateScanPlatform").mockImplementation(async (_s, id, platform) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) (found as Record<string, unknown>)["platform"] = platform;
    return { id, platform, organization_id: opts.orgId, campaign_id: opts.campaignId, status: "running", scanner_version: "v1" } as never;
  });
  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => {
    return { id: `ev-${Math.random()}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() } as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    return { id: `eval-${Math.random()}`, ...input, created_at: new Date().toISOString() } as never;
  });
  return { getScans: () => scans };
}

describe("scan platform authoritative — RCCF-SPONSOR-PROOF-11", () => {
  beforeEach(() => {
    resetMocks();
    vi.restoreAllMocks();
  });

  it("1. Twitch scan with youtube as first channel → scan corrected to twitch", async () => {
    const supabase = {} as never;
    const { getScans } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "SPONSOR-TEST" } }],
      channels: [
        { platform: "youtube", external_channel_id: "UC1" },
        { platform: "twitch", external_channel_id: "twitch-123" },
      ],
    });
    // Make youtube have no matching video, twitch will PASS with default mock title containing sponsor?
    // Default mock for youtube may also produce video; but we need twitch evidence to be the one counted.
    // Our orchestrator loops over both channels; evidence will be created for both.
    // With distinct platforms, evidencePlatforms = {youtube, twitch} size 2 → no correction (remains youtube)
    // For single-twitch-evidence case, we simulate org with only twitch channel as second? Let's test the reported bug: org has youtube first, but twitch proof exists.
    // To get single platform evidence set, we mock youtube provider to fail so only twitch succeeds.
    getMockProvider("youtube").setConfig({ shouldFail: true, failMessage: "youtube down" });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    // Evidence only from twitch (youtube failed), so evidencePlatforms = {twitch} size 1 → should correct
    const scans = getScans();
    expect(scans[0]!["platform"]).toBe("twitch");
    expect(res.scan.platform).toBe("twitch");
    // History would show twitch, not youtube
  });

  it("2. YouTube scan remains youtube (regression)", async () => {
    const supabase = {} as never;
    const { getScans } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [{ platform: "youtube", external_channel_id: "UC1" }],
    });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(getScans()[0]!["platform"]).toBe("youtube");
    expect(res.scan.platform).toBe("youtube");
  });

  it("3. Twitch single channel → scan twitch", async () => {
    const supabase = {} as never;
    const { getScans } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(getScans()[0]!["platform"]).toBe("twitch");
  });

  it("4. No proof-derived workaround — platform correct even if evidence empty (no correction)", async () => {
    const supabase = {} as never;
    getMockProvider("twitch").setConfig({ shouldFail: true, failMessage: "down" });
    const { getScans } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    // No evidence, so platform stays as initial (twitch)
    expect(getScans()[0]!["platform"]).toBe("twitch");
  });

  it("5. platformFilter respected — no correction", async () => {
    const supabase = {} as never;
    const { getScans } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [
        { platform: "youtube", external_channel_id: "UC1" },
        { platform: "twitch", external_channel_id: "twitch-123" },
      ],
    });
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a", platformFilter: "youtube" } });
    // Filtered to youtube only, so scan platform should be youtube even though twitch channel exists but filtered out
    expect(getScans()[0]!["platform"]).toBe("youtube");
  });
});
