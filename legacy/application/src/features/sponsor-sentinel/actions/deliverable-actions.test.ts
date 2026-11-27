import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async () => ({
    organization: { id: "org-a", slug: "tag-esports", name: "TAG" },
    membership: { role: "owner" },
    user: { id: "user-1" },
  })),
}));
vi.mock("@/lib/auth/require-entitlement", () => ({
  requireEntitlement: vi.fn(async () => {}),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const e = new Error(`NEXT_REDIRECT ${url}`);
    (e as unknown as Record<string, unknown>).digest = "NEXT_REDIRECT";
    throw e;
  }),
}));
vi.mock("@/server/repositories/deliverables", () => ({
  findDeliverableById: vi.fn(),
  listDeliverablesByCampaign: vi.fn(),
  deleteDeliverable: vi.fn(async () => {}),
  createDeliverable: vi.fn(),
}));
vi.mock("@/server/repositories/sponsor-campaigns", () => ({
  findSponsorCampaignById: vi.fn(),
}));
vi.mock("@/server/repositories/evidence", () => ({
  listEvidenceByDeliverable: vi.fn(),
}));
vi.mock("../services/deliverable-service", () => ({
  createDeliverable: vi.fn(),
}));

import * as deliverableRepo from "@/server/repositories/deliverables";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as evidenceRepo from "@/server/repositories/evidence";
import { deleteDeliverableAction } from "./deliverable-actions";

function fd(orgSlug: string, campaignId: string, deliverableId: string) {
  const f = new FormData();
  f.set("orgSlug", orgSlug);
  f.set("campaignId", campaignId);
  f.set("deliverableId", deliverableId);
  return f;
}

describe("deleteDeliverableAction — lifecycle safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(evidenceRepo.listEvidenceByDeliverable).mockResolvedValue([]);
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({
      id: "camp-1",
      organization_id: "org-a",
      status: "active",
      name: "Test",
    } as never);
  });

  it("draft + 0/1: safe delete allowed", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValueOnce({
      id: "camp-1",
      organization_id: "org-a",
      status: "draft",
    } as never);
    vi.mocked(deliverableRepo.findDeliverableById).mockResolvedValueOnce({
      id: "del-1",
      organization_id: "org-a",
      campaign_id: "camp-1",
      status: "active",
    } as never);
    vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockResolvedValueOnce([
      { id: "del-1", status: "active" } as never,
    ]);
    // Should throw NEXT_REDIRECT on success (not error)
    await expect(deleteDeliverableAction(fd("tag-esports", "camp-1", "del-1"))).rejects.toThrow(/NEXT_REDIRECT/);
    expect(deliverableRepo.deleteDeliverable).toHaveBeenCalledWith(expect.anything(), "del-1");
  });

  it("tracking + 1 active: cannot delete final active", async () => {
    vi.mocked(deliverableRepo.findDeliverableById).mockResolvedValueOnce({
      id: "del-1",
      organization_id: "org-a",
      campaign_id: "camp-1",
      status: "active",
    } as never);
    vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockResolvedValueOnce([
      { id: "del-1", status: "active" } as never,
    ]);
    await expect(deleteDeliverableAction(fd("tag-esports", "camp-1", "del-1"))).rejects.toThrow(/last requirement while tracking/);
    expect(deliverableRepo.deleteDeliverable).not.toHaveBeenCalled();
  });

  it("tracking + 2 active: deleting one with no evidence succeeds", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockReset();
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValue({
      id: "camp-1",
      organization_id: "org-a",
      status: "active",
    } as never);
    vi.mocked(deliverableRepo.findDeliverableById).mockReset();
    vi.mocked(deliverableRepo.findDeliverableById).mockResolvedValue({
      id: "del-1",
      organization_id: "org-a",
      campaign_id: "camp-1",
      status: "active",
    } as never);
    vi.mocked(evidenceRepo.listEvidenceByDeliverable).mockReset();
    vi.mocked(evidenceRepo.listEvidenceByDeliverable).mockResolvedValue([]);
    vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockReset();
    const listMock = vi.mocked(deliverableRepo.listDeliverablesByCampaign).mockResolvedValue([
      { id: "del-1", status: "active" } as never,
      { id: "del-2", status: "active" } as never,
    ]);
    await expect(deleteDeliverableAction(fd("tag-esports", "camp-1", "del-1"))).rejects.toThrow(/NEXT_REDIRECT/);
    expect(listMock).toHaveBeenCalled();
    expect(deliverableRepo.deleteDeliverable).toHaveBeenCalled();
  });

  it("requirement with historical proof cannot hard-delete", async () => {
    vi.mocked(deliverableRepo.findDeliverableById).mockResolvedValueOnce({
      id: "del-1",
      organization_id: "org-a",
      campaign_id: "camp-1",
      status: "active",
    } as never);
    // Even in draft, proof prevents delete
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValueOnce({
      id: "camp-1",
      organization_id: "org-a",
      status: "draft",
    } as never);
    vi.mocked(evidenceRepo.listEvidenceByDeliverable).mockResolvedValueOnce([{ id: "ev-1" } as never]);
    await expect(deleteDeliverableAction(fd("tag-esports", "camp-1", "del-1"))).rejects.toThrow(/existing proof/);
    expect(deliverableRepo.deleteDeliverable).not.toHaveBeenCalled();
  });

  it("IDOR: other org deliverable rejected", async () => {
    vi.mocked(deliverableRepo.findDeliverableById).mockResolvedValueOnce({
      id: "del-1",
      organization_id: "org-b",
      campaign_id: "camp-1",
      status: "active",
    } as never);
    await expect(deleteDeliverableAction(fd("tag-esports", "camp-1", "del-1"))).rejects.toThrow(/Not found/);
    expect(deliverableRepo.deleteDeliverable).not.toHaveBeenCalled();
  });

  it("completed campaign: Add not relevant but delete still respects proof rule", async () => {
    vi.mocked(campaignRepo.findSponsorCampaignById).mockResolvedValueOnce({
      id: "camp-1",
      organization_id: "org-a",
      status: "completed",
    } as never);
    vi.mocked(deliverableRepo.findDeliverableById).mockResolvedValueOnce({
      id: "del-1",
      organization_id: "org-a",
      campaign_id: "camp-1",
      status: "active",
    } as never);
    vi.mocked(evidenceRepo.listEvidenceByDeliverable).mockResolvedValueOnce([{ id: "ev-1" } as never]);
    await expect(deleteDeliverableAction(fd("tag-esports", "camp-1", "del-1"))).rejects.toThrow(/existing proof/);
  });
});
