import { describe, it, expect, vi, beforeEach } from "vitest";
import { entitlementError, forbiddenError, validationError } from "@/lib/errors";

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async () => ({
    organization: { id: "org-1", slug: "acme", name: "Acme" },
    membership: { role: "owner" },
    user: { id: "user-1" },
  })),
}));
vi.mock("@/lib/auth/require-entitlement", () => ({ requireEntitlement: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("../services/competition", () => ({
  createCompetition: vi.fn(),
  updateCompetition: vi.fn(),
  deleteCompetition: vi.fn(async () => {}),
}));
vi.mock("../services/lock", () => ({ lockCompetition: vi.fn() }));
vi.mock("../services/copy", () => ({ copyCompetitionForNext: vi.fn() }));
vi.mock("../services/history", () => ({ getHistory: vi.fn() }));
vi.mock("../services/standings", () => ({ getStandings: vi.fn(), getLockedRecord: vi.fn() }));
vi.mock("@/server/services/tool-claim", () => ({ claimFreeTool: vi.fn(async () => ({ ok: true })) }));

import { requireEntitlement } from "@/lib/auth/require-entitlement";
import {
  claimFreeTieBreakerAction,
  copyCompetitionAction,
  createCompetitionAction,
  getHistoryAction,
  lockCompetitionAction,
} from "./competition-actions";
import * as competitionService from "../services/competition";
import * as lockService from "../services/lock";

const config = {
  orgSlug: "acme",
  name: "Monsoon Cup",
  description: null,
  scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" as const },
  ruleOrder: ["points", "h2h"] as ("points" | "h2h")[],
  presetRef: "round_robin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("competition actions", () => {
  it("creates a competition for an entitled member", async () => {
    vi.mocked(competitionService.createCompetition).mockResolvedValue({ id: "comp-1" } as never);
    await expect(createCompetitionAction(config)).resolves.toEqual({ competitionId: "comp-1" });
    expect(requireEntitlement).toHaveBeenCalledWith("org-1", "tie-breaker");
  });

  it("converts validation failures to customer-safe field errors", async () => {
    vi.mocked(competitionService.createCompetition).mockRejectedValue(
      validationError("Validation failed", { fieldErrors: { name: ["Competition name is required"] } }),
    );
    const result = await createCompetitionAction({ ...config, name: "" });
    expect(result.error).toContain("Competition name is required");
    expect((result as { fieldErrors?: Record<string, string[]> }).fieldErrors?.name).toEqual([
      "Competition name is required",
    ]);
  });

  it("denies access without entitlement using the platform message", async () => {
    vi.mocked(requireEntitlement).mockRejectedValueOnce(entitlementError());
    const result = await createCompetitionAction(config);
    expect(result.error).toContain("isn't active for your workspace");
    expect(result.error).not.toMatch(/entitlement|RLS|UUID/i);
  });

  it("locks with acknowledgments and returns the record number", async () => {
    vi.mocked(lockService.lockCompetition).mockResolvedValue({ id: "comp-1", record_number: "TB-2026-00001" } as never);
    await expect(
      lockCompetitionAction({ orgSlug: "acme", competitionId: "comp-1", allowIncomplete: true, allowUnresolved: false }),
    ).resolves.toEqual({ competitionId: "comp-1", recordNumber: "TB-2026-00001" });
    expect(lockService.lockCompetition).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      "comp-1",
      expect.objectContaining({ allowIncomplete: true, allowUnresolved: false }),
      "user-1",
    );
  });

  it("maps quota rejection to the upgrade message with the quota flag", async () => {
    const { tieBreakerQuotaError } = await import("@/server/services/tie-breaker-policy");
    vi.mocked(lockService.lockCompetition).mockRejectedValue(tieBreakerQuotaError());
    const result = await lockCompetitionAction({
      orgSlug: "acme",
      competitionId: "comp-1",
      allowIncomplete: true,
      allowUnresolved: true,
    });
    expect(result).toMatchObject({ quotaLimited: true });
    expect(result.error).toMatch(/3 free Tie-Breaker records/);
  });

  it("claims Free through the generic dispatch with the canonical slug", async () => {
    const { claimFreeTool } = await import("@/server/services/tool-claim");
    await expect(claimFreeTieBreakerAction("acme")).resolves.toEqual({ ok: true });
    expect(claimFreeTool).toHaveBeenCalledWith("tie-breaker", "acme");
  });

  it("passes cross-org failures through without leaking ownership", async () => {
    vi.mocked(competitionService.createCompetition).mockRejectedValue(forbiddenError("Cross-organization access denied"));
    const result = await createCompetitionAction(config);
    expect(result.error).toBe("Cross-organization access denied");
  });

  it("copies and reads history through services", async () => {
    const { copyCompetitionForNext } = await import("../services/copy");
    const { getHistory } = await import("../services/history");
    vi.mocked(copyCompetitionForNext).mockResolvedValue({ competition: { id: "comp-2" }, teams: [] } as never);
    vi.mocked(getHistory).mockResolvedValue({ competitions: [], total: 0 });
    await expect(copyCompetitionAction({ orgSlug: "acme", competitionId: "comp-1" })).resolves.toEqual({
      competitionId: "comp-2",
    });
    await expect(getHistoryAction({ orgSlug: "acme", search: "Cup" })).resolves.toEqual({ competitions: [], total: 0 });
  });
});
