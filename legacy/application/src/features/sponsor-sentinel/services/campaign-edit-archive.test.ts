import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateCampaign } from "./campaign-service";
import { transitionCampaign, canTransition } from "./campaign-lifecycle";
import { getRequirementCounts } from "./deliverable-service";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import { AppError } from "@/lib/errors";

vi.mock("@/server/repositories/sponsor-campaigns");

function mockSupabase() {
  return {} as SupabaseClient;
}

const draftCampaign = {
  id: "camp-1",
  organization_id: "org-a",
  name: "Spring Sponsor 2026",
  description: null,
  status: "draft",
  starts_at: "2026-10-01T21:25:00.000Z",
  ends_at: "2026-10-30T21:25:00.000Z",
};

describe("draft campaign edit — RCCF-SPONSOR-FINAL-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valid draft update succeeds and preserves edited values", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(draftCampaign as never);
    vi.mocked(campaignRepo.updateSponsorCampaign).mockResolvedValue({ ...draftCampaign, name: "Spring Sponsor 2027" } as never);

    const result = await updateCampaign(mockSupabase(), "org-a", "camp-1", {
      name: "Spring Sponsor 2027",
      description: null,
      starts_at: "2026-10-01T21:25",
      ends_at: "2026-10-30T21:25",
    });

    expect(result.name).toBe("Spring Sponsor 2027");
    expect(campaignRepo.updateSponsorCampaign).toHaveBeenCalledWith(
      expect.anything(),
      "camp-1",
      expect.objectContaining({ name: "Spring Sponsor 2027" })
    );
  });

  it("invalid update is rejected (short name, bad window)", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(draftCampaign as never);

    await expect(updateCampaign(mockSupabase(), "org-a", "camp-1", { name: "x" })).rejects.toThrow();
    await expect(
      updateCampaign(mockSupabase(), "org-a", "camp-1", { starts_at: "2026-10-30T21:25", ends_at: "2026-10-01T21:25" })
    ).rejects.toThrow(/after starts_at/);
    expect(campaignRepo.updateSponsorCampaign).not.toHaveBeenCalled();
  });

  it.each(["active", "completed", "archived"] as const)("non-draft campaign (%s) cannot be edited", async (status) => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ ...draftCampaign, status } as never);

    await expect(updateCampaign(mockSupabase(), "org-a", "camp-1", { name: "Changed" })).rejects.toThrow(/Only draft campaigns can be edited/);
    expect(campaignRepo.updateSponsorCampaign).not.toHaveBeenCalled();
  });

  it("cross-organization edit is rejected", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(draftCampaign as never);

    const err = await updateCampaign(mockSupabase(), "org-evil", "camp-1", { name: "Hijacked" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("FORBIDDEN");
    expect(campaignRepo.updateSponsorCampaign).not.toHaveBeenCalled();
  });

  it("unknown campaign returns not found", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(null);

    const err = await updateCampaign(mockSupabase(), "org-a", "missing", { name: "Valid Name" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("NOT_FOUND");
  });
});

describe("campaign archive — RCCF-SPONSOR-FINAL-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["draft", "active", "completed"] as const)("permitted archive from %s succeeds", async (status) => {
    expect(canTransition(status, "archived")).toBe(true);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ ...draftCampaign, status } as never);
    vi.mocked(campaignRepo.updateSponsorCampaign).mockResolvedValue({ ...draftCampaign, status: "archived" } as never);

    const result = await transitionCampaign(mockSupabase(), "org-a", "camp-1", "archived");
    expect(result.status).toBe("archived");
    expect(campaignRepo.updateSponsorCampaign).toHaveBeenCalledWith(expect.anything(), "camp-1", { status: "archived" });
  });

  it("invalid lifecycle transition is rejected (completed → active)", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({ ...draftCampaign, status: "completed" } as never);

    await expect(transitionCampaign(mockSupabase(), "org-a", "camp-1", "active")).rejects.toThrow(/Invalid status transition/);
    expect(campaignRepo.updateSponsorCampaign).not.toHaveBeenCalled();
  });

  it("cross-organization archive is rejected", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue(draftCampaign as never);

    const err = await transitionCampaign(mockSupabase(), "org-evil", "camp-1", "archived").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("FORBIDDEN");
    expect(campaignRepo.updateSponsorCampaign).not.toHaveBeenCalled();
  });
});

describe("requirement counts — RCCF-SPONSOR-FINAL-03", () => {
  function mockSupabaseDeliverables(data: Array<{ campaign_id: string }> | null, error: { message: string } | null) {
    return {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data, error }),
        }),
      }),
    } as unknown as SupabaseClient;
  }

  it("actual zero remains zero (no failure)", async () => {
    const res = await getRequirementCounts(mockSupabaseDeliverables([], null), "org-a");
    expect(res.failed).toBe(false);
    expect(res.counts.size).toBe(0);
  });

  it("counts aggregate per campaign", async () => {
    const res = await getRequirementCounts(
      mockSupabaseDeliverables([{ campaign_id: "c1" }, { campaign_id: "c1" }, { campaign_id: "c2" }], null),
      "org-a"
    );
    expect(res.failed).toBe(false);
    expect(res.counts.get("c1")).toBe(2);
    expect(res.counts.get("c2")).toBe(1);
  });

  it("query error does not become zero — failed flag set", async () => {
    const res = await getRequirementCounts(mockSupabaseDeliverables(null, { message: "boom" }), "org-a");
    expect(res.failed).toBe(true);
    expect(res.counts.size).toBe(0);
  });

  it("thrown exception does not become zero — failed flag set", async () => {
    const supabase = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;
    const res = await getRequirementCounts(supabase, "org-a");
    expect(res.failed).toBe(true);
  });
});
