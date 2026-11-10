import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCampaign, normalizeDateTimeInput } from "./campaign-service";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/server/repositories/sponsor-campaigns");

function mockSupabase() {
  return {} as SupabaseClient;
}

describe("campaign creation validation — RCCF-SENTINEL-13A", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizeDateTimeInput converts datetime-local to ISO", () => {
    const local = "2026-10-01T21:25";
    const iso = normalizeDateTimeInput(local) as string;
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Should be parseable and not NaN
    expect(new Date(iso).getTime()).not.toBeNaN();
  });

  it("normalizeDateTimeInput preserves ISO with Z", () => {
    const isoIn = "2026-10-01T21:25:00.000Z";
    const out = normalizeDateTimeInput(isoIn) as string;
    expect(out).toBe(isoIn);
  });

  it("valid draft with datetime-local creates draft", async () => {
    const supabase = mockSupabase();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const startsLocal = future.toISOString().slice(0, 16); // datetime-local
    const endsLocal = new Date(future.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const mockCampaign = { id: "camp-1", organization_id: "org-a", name: "Spring Sponsor 2026", status: "draft" } as never;
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue(mockCampaign);

    const result = await createCampaign(supabase, "org-a", {
      name: "Spring Sponsor 2026",
      description: null,
      starts_at: startsLocal,
      ends_at: endsLocal,
    });

    expect(campaignRepo.createSponsorCampaign).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        organization_id: "org-a",
        name: "Spring Sponsor 2026",
        status: "draft",
      }),
    );
    // Verify dates were normalized to ISO
    const calls = vi.mocked(campaignRepo.createSponsorCampaign).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[0]![1] as { starts_at: string; ends_at: string };
    expect(call.starts_at).toMatch(/Z$/);
    expect(call.ends_at).toMatch(/Z$/);
    expect(new Date(call.ends_at).getTime()).toBeGreaterThan(new Date(call.starts_at).getTime());
    expect(result.id).toBe("camp-1");
  });

  it("valid draft with production UI values (01/10/2026 21:25) creates draft", async () => {
    const supabase = mockSupabase();
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue({ id: "camp-2", organization_id: "org-a" } as never);
    // Production reported: Starts 01/10/2026 21:25 (Oct 1) ends 30/10/2026 21:25
    // Browser submits as 2026-10-01T21:25 and 2026-10-30T21:25
    const result = await createCampaign(supabase, "org-a", {
      name: "Spring Sponsor 2026",
      starts_at: "2026-10-01T21:25",
      ends_at: "2026-10-30T21:25",
    });
    expect(campaignRepo.createSponsorCampaign).toHaveBeenCalled();
    expect(result.id).toBe("camp-2");
  });

  it("invalid date throws validation error, no DB insert", async () => {
    const supabase = mockSupabase();
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue({ id: "should-not" } as never);
    await expect(
      createCampaign(supabase, "org-a", {
        name: "Spring Sponsor 2026",
        starts_at: "invalid-date",
        ends_at: "2026-10-30T21:25",
      }),
    ).rejects.toThrow(/Validation failed/);
    expect(campaignRepo.createSponsorCampaign).not.toHaveBeenCalled();
  });

  it("ends before starts throws validation error with ends_at field", async () => {
    const supabase = mockSupabase();
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue({ id: "should-not" } as never);
    try {
      await createCampaign(supabase, "org-a", {
        name: "Spring Sponsor 2026",
        starts_at: "2026-10-30T21:25",
        ends_at: "2026-10-01T21:25",
      });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as { code?: string; details?: { fieldErrors?: Record<string, string[]> } };
      expect(err.code).toBe("VALIDATION_ERROR");
      // Should contain ends_at field error about after starts_at
      const fieldErrors = err.details?.fieldErrors as Record<string, string[]> | undefined;
      const msg = fieldErrors?.ends_at ? fieldErrors.ends_at.join(" ") : JSON.stringify(err);
      expect(msg).toMatch(/after starts_at/i);
    }
    expect(campaignRepo.createSponsorCampaign).not.toHaveBeenCalled();
  });

  it("organization tampering: rawInput organization_id does not change target", async () => {
    const supabase = mockSupabase();
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue({ id: "camp-3", organization_id: "org-a" } as never);
    const starts = new Date(Date.now() + 86400000).toISOString();
    const ends = new Date(Date.now() + 2 * 86400000).toISOString();
    const result = await createCampaign(supabase, "org-a", {
      name: "Test",
      starts_at: starts,
      ends_at: ends,
      organization_id: "org-b",
    } as never);
    expect(campaignRepo.createSponsorCampaign).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ organization_id: "org-a" }),
    );
    expect(result.organization_id).toBe("org-a");
  });

  it("entitlement: service does not bypass entitlement (checked in action)", async () => {
    // Service itself does not check entitlement; action does via requireEntitlement.
    // This test documents that service trusts organizationId from context, not input.
    const supabase = mockSupabase();
    vi.mocked(campaignRepo.createSponsorCampaign).mockResolvedValue({ id: "camp-4", organization_id: "org-a" } as never);
    const starts = new Date(Date.now() + 86400000).toISOString();
    const ends = new Date(Date.now() + 2 * 86400000).toISOString();
    // Even if rawInput contains different org, service uses param
    await createCampaign(supabase, "org-a", { name: "Test", starts_at: starts, ends_at: ends, organization_id: "evil" } as never);
    expect(campaignRepo.createSponsorCampaign).toHaveBeenCalledWith(supabase, expect.objectContaining({ organization_id: "org-a" }));
  });

  it("empty name throws validation error", async () => {
    const supabase = mockSupabase();
    await expect(
      createCampaign(supabase, "org-a", { name: "", starts_at: "2026-10-01T21:25:00.000Z", ends_at: "2026-10-02T21:25:00.000Z" }),
    ).rejects.toThrow(/Validation failed/);
    expect(campaignRepo.createSponsorCampaign).not.toHaveBeenCalled();
  });
});
