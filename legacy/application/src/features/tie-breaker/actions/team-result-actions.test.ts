import { describe, it, expect, vi, beforeEach } from "vitest";
import { entitlementError, validationError } from "@/lib/errors";

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async () => ({
    organization: { id: "org-1", slug: "acme", name: "Acme" },
    membership: { role: "owner" },
    user: { id: "user-1" },
  })),
}));
vi.mock("@/lib/auth/require-entitlement", () => ({ requireEntitlement: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("../services/teams", () => ({ addTeam: vi.fn(), updateTeam: vi.fn(), removeTeam: vi.fn(), listTeams: vi.fn() }));
vi.mock("../services/results", () => ({
  addResult: vi.fn(),
  updateResult: vi.fn(),
  deleteResult: vi.fn(async () => {}),
  listResults: vi.fn(),
}));

import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { addTeamAction, removeTeamAction } from "./team-actions";
import { addResultAction, listResultsAction } from "./result-actions";
import * as teamService from "../services/teams";
import * as resultService from "../services/results";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("team and result actions", () => {
  it("adds a team and surfaces duplicate names in customer language", async () => {
    vi.mocked(teamService.addTeam).mockResolvedValue({ id: "t1" } as never);
    await expect(
      addTeamAction({ orgSlug: "acme", competitionId: "comp-1", name: "Falcons", shortName: null, logoUrl: null }),
    ).resolves.toEqual({ teamId: "t1" });
    vi.mocked(teamService.addTeam).mockRejectedValue(validationError("That team name is already used in this competition"));
    const result = await addTeamAction({ orgSlug: "acme", competitionId: "comp-1", name: "Falcons", shortName: null, logoUrl: null });
    expect(result.error).toContain("already used");
  });

  it("denies team removal without entitlement", async () => {
    vi.mocked(requireEntitlement).mockRejectedValueOnce(entitlementError());
    const result = await removeTeamAction({ orgSlug: "acme", competitionId: "comp-1", teamId: "t1" });
    expect(result.error).toContain("isn't active for your workspace");
  });

  it("adds results with duplicate-pair visibility", async () => {
    vi.mocked(resultService.addResult).mockResolvedValue({ result: { id: "res-2" }, duplicatePair: true } as never);
    await expect(
      addResultAction({
        orgSlug: "acme",
        competitionId: "comp-1",
        teamAId: "a",
        teamBId: "b",
        winnerTeamId: "a",
        isDraw: false,
        mapsA: 2,
        mapsB: 1,
        roundsA: null,
        roundsB: null,
        playedAt: null,
        notes: null,
      }),
    ).resolves.toEqual({ resultId: "res-2", duplicatePair: true });
  });

  it("lists results and never leaks internals on unexpected failures", async () => {
    vi.mocked(resultService.listResults).mockRejectedValue(new Error("relation does not exist"));
    const result = await listResultsAction({ orgSlug: "acme", competitionId: "comp-1" });
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(result.error).not.toMatch(/relation|supabase|SQL/i);
  });
});
