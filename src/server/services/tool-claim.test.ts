import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";
import { claimFreeTool } from "./tool-claim";

/**
 * Generic claim dispatch tests (Phase 3). Modules at the trust boundary
 * are mocked; policy gating and error mapping are asserted for real.
 */

const mockRequireOrganizationContext = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockEnsureFree = vi.fn();
const mockEnsureFreeTieBreaker = vi.fn();
const mockEnsureFreeDraftBan = vi.fn();

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: (...args: unknown[]) =>
    (mockRequireOrganizationContext as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => (mockCreateAdminClient as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/server/services/sponsorship-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/sponsorship-policy")>();
  return {
    ...actual,
    ensureSponsorshipPolicyFreeGrant: (...args: unknown[]) =>
      (mockEnsureFree as (...a: unknown[]) => unknown)(...args),
  };
});

vi.mock("@/server/services/tie-breaker-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/tie-breaker-policy")>();
  return {
    ...actual,
    ensureFreeTieBreakerGrant: (...args: unknown[]) =>
      (mockEnsureFreeTieBreaker as (...a: unknown[]) => unknown)(...args),
  };
});

vi.mock("@/server/services/draft-ban-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/draft-ban-policy")>();
  return {
    ...actual,
    ensureFreeDraftBanGrant: (...args: unknown[]) =>
      (mockEnsureFreeDraftBan as (...a: unknown[]) => unknown)(...args),
  };
});

function adminClient(toolRow: unknown) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        single: async () => {
          if (table === "tools") return { data: toolRow, error: null };
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

const CTX = { user: { id: "u1" }, organization: { id: "org-a" } };
const ACTIVE_SPONSOR_TOOL = { id: "tool-sponsor-id", slug: "sponsor-sentinel", is_active: true };
const ACTIVE_TIE_TOOL = { id: "tool-tie-id", slug: "tie-breaker", is_active: true };
const ACTIVE_DRAFT_TOOL = { id: "tool-draft-id", slug: "draft-ban", is_active: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOrganizationContext.mockResolvedValue(CTX);
  mockCreateAdminClient.mockReturnValue(adminClient(ACTIVE_SPONSOR_TOOL));
  mockEnsureFree.mockResolvedValue({ id: "g1" });
  mockEnsureFreeTieBreaker.mockResolvedValue({ id: "gt1" });
  mockEnsureFreeDraftBan.mockResolvedValue({ id: "gd1" });
});

describe("claimFreeTool", () => {
  it("claims sponsor-sentinel for a member (happy path delegates issuance)", async () => {
    const res = await claimFreeTool("sponsor-sentinel", "acme");
    expect(res).toEqual({ ok: true });
    expect(mockRequireOrganizationContext).toHaveBeenCalledWith("acme");
    expect(mockEnsureFree).toHaveBeenCalledTimes(1);
  });

  it("missing organization fails without touching identity or issuance", async () => {
    const res = await claimFreeTool("sponsor-sentinel", "");
    expect(res).toEqual({ error: "Missing organization" });
    expect(mockRequireOrganizationContext).not.toHaveBeenCalled();
    expect(mockEnsureFree).not.toHaveBeenCalled();
  });

  it("unknown tool slug is denied without issuance", async () => {
    const res = await claimFreeTool("nope-not-a-tool", "acme");
    expect(res.error).toBeDefined();
    expect(mockEnsureFree).not.toHaveBeenCalled();
  });

  it("tie-breaker Free claim issues the org grant (happy path delegates issuance)", async () => {
    mockCreateAdminClient.mockReturnValue(adminClient(ACTIVE_TIE_TOOL));
    const res = await claimFreeTool("tie-breaker", "acme");
    expect(res).toEqual({ ok: true });
    expect(mockRequireOrganizationContext).toHaveBeenCalledWith("acme");
    expect(mockEnsureFreeTieBreaker).toHaveBeenCalledTimes(1);
    expect(mockEnsureFreeTieBreaker).toHaveBeenCalledWith(expect.anything(), "org-a");
    // Sponsorship issuance never runs for Tie-Breaker claims.
    expect(mockEnsureFree).not.toHaveBeenCalled();
  });

  it("draft-ban Free claim issues the org grant (happy path delegates issuance)", async () => {
    mockCreateAdminClient.mockReturnValue(adminClient(ACTIVE_DRAFT_TOOL));
    const res = await claimFreeTool("draft-ban", "acme");
    expect(res).toEqual({ ok: true });
    expect(mockRequireOrganizationContext).toHaveBeenCalledWith("acme");
    expect(mockEnsureFreeDraftBan).toHaveBeenCalledTimes(1);
    expect(mockEnsureFreeDraftBan).toHaveBeenCalledWith(expect.anything(), "org-a");
    // Sponsorship and Tie-Breaker issuance never run for Draft & Ban claims.
    expect(mockEnsureFree).not.toHaveBeenCalled();
    expect(mockEnsureFreeTieBreaker).not.toHaveBeenCalled();
  });

  it("disabled policy tool (prize-splitter) is denied without issuance", async () => {
    const res = await claimFreeTool("prize-splitter", "acme");
    expect(res.error).toBeDefined();
    expect(mockEnsureFree).not.toHaveBeenCalled();
    expect(mockEnsureFreeTieBreaker).not.toHaveBeenCalled();
    expect(mockEnsureFreeDraftBan).not.toHaveBeenCalled();
  });

  it("draft-ban claim against an inactive tool row is denied without issuance", async () => {
    mockCreateAdminClient.mockReturnValue(adminClient({ ...ACTIVE_DRAFT_TOOL, is_active: false }));
    const res = await claimFreeTool("draft-ban", "acme");
    expect(res.error).toBeDefined();
    expect(mockEnsureFreeDraftBan).not.toHaveBeenCalled();
  });

  it("tie-breaker claim against an inactive tool row is denied without issuance", async () => {
    mockCreateAdminClient.mockReturnValue(adminClient({ ...ACTIVE_TIE_TOOL, is_active: false }));
    const res = await claimFreeTool("tie-breaker", "acme");
    expect(res.error).toBeDefined();
    expect(mockEnsureFreeTieBreaker).not.toHaveBeenCalled();
  });

  it("all-access slug is denied without issuance", async () => {
    const res = await claimFreeTool("all-access", "acme");
    expect(res.error).toBeDefined();
    expect(mockEnsureFree).not.toHaveBeenCalled();
  });

  it("commercially inactive tool row is denied without issuance", async () => {
    mockCreateAdminClient.mockReturnValue(adminClient({ ...ACTIVE_SPONSOR_TOOL, is_active: false }));
    const res = await claimFreeTool("sponsor-sentinel", "acme");
    expect(res.error).toBeDefined();
    expect(mockEnsureFree).not.toHaveBeenCalled();
  });

  it("AppError from context maps to its customer-safe message", async () => {
    const err = new AppError({ code: "FORBIDDEN", status: 403, message: "Not a member" });
    mockRequireOrganizationContext.mockRejectedValueOnce(err);
    const res = await claimFreeTool("sponsor-sentinel", "acme");
    expect(res).toEqual({ error: err.safeMessage });
    expect(mockEnsureFree).not.toHaveBeenCalled();
  });

  it("unexpected failure maps to the generic message", async () => {
    mockRequireOrganizationContext.mockRejectedValueOnce(new Error("connection reset"));
    const res = await claimFreeTool("sponsor-sentinel", "acme");
    expect(res).toEqual({ error: "Something went wrong. Please try again." });
  });
});
