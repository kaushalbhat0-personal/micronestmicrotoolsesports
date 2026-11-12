import { describe, it, expect, vi, beforeEach } from "vitest";
import { validationError, forbiddenError, notFoundError } from "@/lib/errors";

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async (slug: string) => ({
    organization: { id: "org-a", slug, name: "Test Org" },
    membership: { role: "owner", id: "mem-1" },
    user: { id: "user-1" },
  })),
}));
vi.mock("@/lib/auth/require-entitlement", () => ({
  requireEntitlement: vi.fn(async () => ({ hasAccess: true })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const e = new Error(`NEXT_REDIRECT ${url}`);
    (e as unknown as Record<string, unknown>).digest = "NEXT_REDIRECT";
    throw e;
  }),
}));

vi.mock("../services/campaign-service", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, updateCampaign: vi.fn() };
});
vi.mock("../services/campaign-lifecycle", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, transitionCampaign: vi.fn() };
});

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { updateCampaign } from "../services/campaign-service";
import { transitionCampaign } from "../services/campaign-lifecycle";
import { updateCampaignAction, archiveCampaignAction } from "./campaign-actions";

function editForm(orgSlug: string, campaignId: string, name = "Edited Name"): FormData {
  const fd = new FormData();
  fd.set("orgSlug", orgSlug);
  fd.set("campaignId", campaignId);
  fd.set("name", name);
  fd.set("description", "");
  fd.set("starts_at", "2026-10-01T21:25");
  fd.set("ends_at", "2026-10-30T21:25");
  return fd;
}

function idForm(orgSlug: string, campaignId: string): FormData {
  const fd = new FormData();
  fd.set("orgSlug", orgSlug);
  fd.set("campaignId", campaignId);
  return fd;
}

describe("updateCampaignAction — RCCF-SPONSOR-FINAL-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valid draft update succeeds and redirects to detail", async () => {
    vi.mocked(updateCampaign).mockResolvedValueOnce({ id: "camp-1", organization_id: "org-a", status: "draft" } as never);
    await expect(updateCampaignAction(editForm("tag-esports", "camp-1"))).rejects.toThrow(/NEXT_REDIRECT.*camp-1/);
    expect(vi.mocked(updateCampaign)).toHaveBeenCalledWith(
      expect.anything(),
      "org-a",
      "camp-1",
      expect.objectContaining({ name: "Edited Name" })
    );
  });

  it("invalid update returns validation error with field errors", async () => {
    const err = validationError("Validation failed", { fieldErrors: { name: ["Too short"] } });
    vi.mocked(updateCampaign).mockRejectedValueOnce(err);
    const result = await updateCampaignAction(editForm("tag-esports", "camp-1", "x"));
    expect(result?.error).toBeDefined();
    expect((result as { fieldErrors?: Record<string, string[]> }).fieldErrors?.name).toEqual(["Too short"]);
  });

  it("non-draft edit rejected server-side — no silent save", async () => {
    vi.mocked(updateCampaign).mockRejectedValueOnce(validationError("Only draft campaigns can be edited (current: active)"));
    const result = await updateCampaignAction(editForm("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/Only draft campaigns can be edited/);
  });

  it("cross-org edit uses context org, forbidden surfaced safely", async () => {
    vi.mocked(updateCampaign).mockRejectedValueOnce(forbiddenError("Cross-organization access denied"));
    const fd = editForm("tag-esports", "camp-1");
    fd.set("organization_id", "org-b");
    const result = await updateCampaignAction(fd);
    expect(vi.mocked(updateCampaign)).toHaveBeenCalledWith(expect.anything(), "org-a", "camp-1", expect.anything());
    expect(result?.error).toMatch(/Cross-organization/);
    expect(vi.mocked(requireOrganizationContext)).toHaveBeenCalledWith("tag-esports");
  });
});

describe("archiveCampaignAction — RCCF-SPONSOR-FINAL-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permitted archive succeeds and redirects to campaigns list", async () => {
    vi.mocked(transitionCampaign).mockResolvedValueOnce({ id: "camp-1", status: "archived" } as never);
    await expect(archiveCampaignAction(idForm("tag-esports", "camp-1"))).rejects.toThrow(/NEXT_REDIRECT.*campaigns$/);
    expect(vi.mocked(transitionCampaign)).toHaveBeenCalledWith(expect.anything(), "org-a", "camp-1", "archived");
  });

  it("invalid lifecycle transition rejected safely", async () => {
    vi.mocked(transitionCampaign).mockRejectedValueOnce(validationError("Invalid status transition archived → archived"));
    const result = await archiveCampaignAction(idForm("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/Invalid status transition/);
  });

  it("cross-org archive rejected", async () => {
    vi.mocked(transitionCampaign).mockRejectedValueOnce(forbiddenError("Cross-organization access denied"));
    const result = await archiveCampaignAction(idForm("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/Cross-organization/);
    expect(vi.mocked(transitionCampaign)).toHaveBeenCalledWith(expect.anything(), "org-a", "camp-1", "archived");
  });

  it("missing campaign returns not found safely", async () => {
    vi.mocked(transitionCampaign).mockRejectedValueOnce(notFoundError("Campaign not found"));
    const result = await archiveCampaignAction(idForm("tag-esports", "missing"));
    expect(result?.error).toMatch(/Campaign not found/);
  });
});
