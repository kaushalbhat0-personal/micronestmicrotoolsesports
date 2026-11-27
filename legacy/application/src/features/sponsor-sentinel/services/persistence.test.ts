import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock repositories for service-level tests
vi.mock("@/server/repositories/connected-channels", () => ({
  createConnectedChannel: vi.fn(async (_c: unknown, input: unknown) => ({ id: "ch1", ...(input as object) })),
  findConnectedChannelById: vi.fn(),
  listConnectedChannelsByOrg: vi.fn(),
}));
vi.mock("@/server/repositories/sponsor-campaigns", () => ({
  createSponsorCampaign: vi.fn(async (_c: unknown, input: unknown) => ({ id: "camp1", ...(input as object) })),
  findSponsorCampaignById: vi.fn(),
  listSponsorCampaignsByOrg: vi.fn(),
  updateSponsorCampaign: vi.fn(async (_c: unknown, id: string, patch: unknown) => ({
    id,
    organization_id: "org-a",
    ...(patch as object),
  })),
}));
vi.mock("@/server/repositories/deliverables", () => ({
  createDeliverable: vi.fn(async (_c: unknown, input: unknown) => ({ id: "del1", ...(input as object) })),
  findDeliverableById: vi.fn(),
  updateDeliverable: vi.fn(async (_c: unknown, id: string, patch: unknown) => ({
    id,
    organization_id: "org-a",
    ...(patch as object),
  })),
}));

import * as ccRepo from "@/server/repositories/connected-channels";
import * as campRepo from "@/server/repositories/sponsor-campaigns";
import * as delRepo from "@/server/repositories/deliverables";
import { createConnectedChannel, getConnectedChannel } from "./connected-channel-service";
import { createCampaign, updateCampaign } from "./campaign-service";
import { createDeliverable, updateDeliverable } from "./deliverable-service";

const fakeSupabase = {} as never;
const orgA = "org-a";
const orgB = "org-b";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CRUD - connected channels", () => {
  it("creates channel with valid input", async () => {
    const ch = await createConnectedChannel(fakeSupabase, orgA, {
      platform: "twitch",
      external_channel_id: "123",
      external_handle: "player1",
      canonical_url: "https://twitch.tv/player1",
    });
    expect(ch.id).toBe("ch1");
    expect(ccRepo.createConnectedChannel).toHaveBeenCalled();
  });

  it("rejects invalid platform", async () => {
    await expect(
      createConnectedChannel(fakeSupabase, orgA, {
        platform: "facebook",
        external_channel_id: "1",
        external_handle: "h",
        canonical_url: "https://example.com/h",
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate via repository error passthrough", async () => {
    vi.mocked(ccRepo.createConnectedChannel).mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "connected_channels_org_platform_ext_unique"'));
    await expect(
      createConnectedChannel(fakeSupabase, orgA, {
        platform: "twitch",
        external_channel_id: "123",
        external_handle: "player1",
        canonical_url: "https://twitch.tv/player1",
      }),
    ).rejects.toThrow(/duplicate/);
  });

  it("IDOR: getConnectedChannel denies cross-org", async () => {
    vi.mocked(ccRepo.findConnectedChannelById).mockResolvedValueOnce({
      id: "ch1",
      organization_id: orgB,
      platform: "twitch",
      external_channel_id: "123",
      external_handle: "player1",
      display_name: null,
      canonical_url: "https://twitch.tv/player1",
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    await expect(getConnectedChannel(fakeSupabase, orgA, "ch1")).rejects.toThrow(/Cross-organization/);
  });
});

describe("CRUD - campaigns", () => {
  it("creates campaign with valid window", async () => {
    const camp = await createCampaign(fakeSupabase, orgA, {
      name: "Sponsor X",
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-01-31T00:00:00Z",
    });
    expect(camp.id).toBe("camp1");
  });

  it("rejects invalid window", async () => {
    await expect(
      createCampaign(fakeSupabase, orgA, {
        name: "Bad",
        starts_at: "2026-01-31T00:00:00Z",
        ends_at: "2026-01-01T00:00:00Z",
      }),
    ).rejects.toThrow(/Validation failed/);
  });

  it("IDOR: updateCampaign denies cross-org", async () => {
    vi.mocked(campRepo.findSponsorCampaignById).mockResolvedValueOnce({
      id: "camp1",
      organization_id: orgB,
      name: "Other org camp",
      status: "draft",
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-01-31T00:00:00Z",
    } as never);
    await expect(updateCampaign(fakeSupabase, orgA, "camp1", { name: "Hacked" })).rejects.toThrow(
      /Cross-organization/,
    );
  });
});

describe("deliverable rules", () => {
  beforeEach(() => {
    vi.mocked(campRepo.findSponsorCampaignById).mockResolvedValue({
      id: "camp1",
      organization_id: orgA,
      name: "Camp",
      status: "active",
    } as never);
  });

  it("persists valid twitch rule", async () => {
    const del = await createDeliverable(fakeSupabase, orgA, {
      campaign_id: "11111111-1111-4111-a111-111111111111",
      name: "Hashtag check",
      rule: { type: "required_twitch_tag", tag_id: "English" },
      platformHint: "twitch",
    });
    expect(del.id).toBe("del1");
  });

  it("rejects invalid Zod rule (empty value)", async () => {
    await expect(
      createDeliverable(fakeSupabase, orgA, {
        campaign_id: "11111111-1111-4111-a111-111111111111",
        name: "Bad",
        rule: { type: "required_title_contains", value: "" },
      }),
    ).rejects.toThrow();
  });

  it("rejects wrong-platform rule (twitch tag on youtube)", async () => {
    await expect(
      createDeliverable(fakeSupabase, orgA, {
        campaign_id: "11111111-1111-4111-a111-111111111111",
        name: "Bad combo",
        rule: { type: "required_twitch_tag", tag_id: "English" },
        platformHint: "youtube",
      }),
    ).rejects.toThrow(/NOT_SUPPORTED|only supported on twitch/);
  });

  it("rejects unsupported Kick rule minimum_duration", async () => {
    await expect(
      createDeliverable(fakeSupabase, orgA, {
        campaign_id: "11111111-1111-4111-a111-111111111111",
        name: "Duration on Kick",
        rule: { type: "minimum_duration", minutes: 60 },
        platformHint: "kick",
      }),
    ).rejects.toThrow(/NOT_SUPPORTED|minimum_duration/);
  });

  it("rejects cross-org campaign attachment", async () => {
    vi.mocked(campRepo.findSponsorCampaignById).mockResolvedValueOnce({
      id: "11111111-1111-4111-a111-111111111111",
      organization_id: orgB,
      name: "Other org",
      status: "active",
    } as never);
    await expect(
      createDeliverable(fakeSupabase, orgA, {
        campaign_id: "11111111-1111-4111-a111-111111111111",
        name: "Attach",
        rule: { type: "required_title_contains", value: "hi" },
      }),
    ).rejects.toThrow(/Cross-organization campaign/);
  });

  it("IDOR: updateDeliverable denies cross-org", async () => {
    vi.mocked(delRepo.findDeliverableById).mockResolvedValueOnce({
      id: "del1",
      organization_id: orgB,
      campaign_id: "camp1",
      name: "Other",
    } as never);
    await expect(updateDeliverable(fakeSupabase, orgA, "del1", { name: "Hacked" })).rejects.toThrow(
      /Cross-organization/,
    );
  });
});

describe("immutability", () => {
  it("evidence repository has no update/delete export", async () => {
    const mod = await import("@/server/repositories/evidence");
    expect((mod as Record<string, unknown>).updateEvidence).toBeUndefined();
    expect((mod as Record<string, unknown>).deleteEvidence).toBeUndefined();
  });
  it("evaluations repository has no update/delete export", async () => {
    const mod = await import("@/server/repositories/evaluations");
    expect((mod as Record<string, unknown>).updateEvaluation).toBeUndefined();
    expect((mod as Record<string, unknown>).deleteEvaluation).toBeUndefined();
  });
});

describe("entitlement (existence check)", () => {
  it("requireEntitlement module exists and is importable", async () => {
    const mod = await import("@/lib/auth/require-entitlement");
    expect(typeof mod.requireEntitlement).toBe("function");
  });
});
