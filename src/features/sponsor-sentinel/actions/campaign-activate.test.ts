import { describe, it, expect, vi, beforeEach } from "vitest";
import { validationError, forbiddenError, notFoundError } from "@/lib/errors";

// Mock dependencies for campaign-actions
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

// Mock campaign-lifecycle
vi.mock("../services/campaign-lifecycle", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    activateCampaign: vi.fn(),
  };
});

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { activateCampaign } from "../services/campaign-lifecycle";
import { activateCampaignAction } from "./campaign-actions";

function formData(orgSlug: string, campaignId: string): FormData {
  const fd = new FormData();
  fd.set("orgSlug", orgSlug);
  fd.set("campaignId", campaignId);
  return fd;
}

describe("activateCampaignAction error handling — RCCF-SENTINEL-13C", () => {
  beforeEach(() => vi.clearAllMocks());

  it("A. No connected channel → returns validation error, not 500, no status change", async () => {
    vi.mocked(activateCampaign).mockRejectedValueOnce(validationError("At least one connected channel required"));
    const result = await activateCampaignAction(formData("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/At least one connected channel required/);
    // Should not have thrown NEXT_REDIRECT
    expect(vi.mocked(activateCampaign)).toHaveBeenCalled();
  });

  it("B. Connected channel exists → succeeds and redirects (throws NEXT_REDIRECT)", async () => {
    vi.mocked(activateCampaign).mockResolvedValueOnce({ id: "camp-1", organization_id: "org-a", status: "active" } as never);
    await expect(activateCampaignAction(formData("tag-esports", "camp-1"))).rejects.toThrow(/NEXT_REDIRECT/);
    expect(vi.mocked(activateCampaign)).toHaveBeenCalledWith(expect.anything(), "org-a", "camp-1");
  });

  it("C. No deliverable → returns validation error, remains draft", async () => {
    vi.mocked(activateCampaign).mockRejectedValueOnce(validationError("At least one deliverable required"));
    const result = await activateCampaignAction(formData("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/At least one deliverable required/);
  });

  it("D. Invalid campaign state → returns validation error", async () => {
    vi.mocked(activateCampaign).mockRejectedValueOnce(validationError("Only draft campaigns can be activated (current: active)"));
    const result = await activateCampaignAction(formData("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/Only draft campaigns can be activated/);
  });

  it("E. Cross-organization campaign ID → returns forbidden, not 500", async () => {
    vi.mocked(activateCampaign).mockRejectedValueOnce(forbiddenError("Cross-organization access denied"));
    const result = await activateCampaignAction(formData("tag-esports", "camp-other-org"));
    expect(result?.error).toMatch(/Cross-organization/);
  });

  it("F. Entitlement failure → returns entitlement error, not 500", async () => {
    vi.mocked(requireEntitlement).mockRejectedValueOnce(forbiddenError("Organization does not have access to sponsor-sentinel"));
    const result = await activateCampaignAction(formData("tag-esports", "camp-1"));
    expect(result?.error).toMatch(/does not have access/);
    // Reset mock for other tests
    vi.mocked(requireEntitlement).mockResolvedValue({ hasAccess: true } as never);
  });

  it("G. Campaign not found → returns not found error", async () => {
    vi.mocked(activateCampaign).mockRejectedValueOnce(notFoundError("Campaign not found"));
    const result = await activateCampaignAction(formData("tag-esports", "missing"));
    expect(result?.error).toMatch(/Campaign not found/);
  });

  it("H. Preserves tenant isolation: orgSlug from form resolves to org-a, not client-supplied organization_id", async () => {
    // Even if FormData contained organization_id=org-b (tampering), action uses ctx.organization.id
    const fd = formData("tag-esports", "camp-1");
    fd.set("organization_id", "org-b");
    fd.set("tenant_id", "org-b");
    vi.mocked(activateCampaign).mockResolvedValueOnce({ id: "camp-1", organization_id: "org-a", status: "active" } as never);
    await expect(activateCampaignAction(fd)).rejects.toThrow(/NEXT_REDIRECT/);
    // Verify activateCampaign was called with org-a (from context), not org-b from form
    expect(vi.mocked(activateCampaign)).toHaveBeenCalledWith(expect.anything(), "org-a", "camp-1");
    expect(vi.mocked(requireOrganizationContext)).toHaveBeenCalledWith("tag-esports");
  });
});
