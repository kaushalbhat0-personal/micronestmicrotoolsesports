import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lockCompetition } from "./lock";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";
import { findOrganizationById } from "@/server/repositories/organizations";

vi.mock("@/server/repositories/tie-breaker-competitions");
vi.mock("@/server/repositories/tie-breaker-teams");
vi.mock("@/server/repositories/tie-breaker-results");
vi.mock("@/server/repositories/organizations", () => ({ findOrganizationById: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ rpc: vi.fn() })) }));
vi.mock("@/server/services/tie-breaker-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/tie-breaker-policy")>();
  return { ...actual, resolveTieBreakerAccessLevel: vi.fn(async () => "paid") };
});
import { resolveTieBreakerAccessLevel } from "@/server/services/tie-breaker-policy";

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";
const COMP = "comp-1";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function comp(status: compRepo.TieBreakerStatus = "active"): compRepo.TieBreakerCompetitionRow {
  return {
    id: COMP,
    organization_id: ORG,
    created_by: "user-1",
    name: "Monsoon Cup",
    description: null,
    status,
    scoring_win: 3,
    scoring_draw: 1,
    scoring_loss: 0,
    draws_enabled: false,
    round_label: "rounds",
    rule_order: ["points", "h2h", "map_diff"],
    preset_ref: "round_robin",
    share_token: "token-1",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function teams() {
  return [
    { id: A, competition_id: COMP, organization_id: ORG, name: "Falcons", short_name: null, logo_url: null, created_at: "", updated_at: "" },
    { id: B, competition_id: COMP, organization_id: ORG, name: "Sentinels", short_name: null, logo_url: null, created_at: "", updated_at: "" },
  ];
}

function winResult(): resultRepo.TieBreakerResultRow {
  return {
    id: "res-1",
    competition_id: COMP,
    organization_id: ORG,
    team_a_id: A,
    team_b_id: B,
    winner: "team_a",
    maps_a: 2,
    maps_b: 0,
    rounds_a: null,
    rounds_b: null,
    played_at: null,
    notes: "Private — never shared",
    is_complete: true,
    created_by: "user-1",
    created_at: "",
    updated_at: "",
  };
}

const lockedRow = (recordNumber: string): compRepo.TieBreakerCompetitionRow => ({
  ...comp("locked"),
  record_number: recordNumber,
  locked_at: new Date().toISOString(),
  locked_snapshot: { standings: [], explanations: [] },
});

function lock() {
  return lockCompetition(supabase, ORG, COMP, { allowIncomplete: true, allowUnresolved: true }, USER);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveTieBreakerAccessLevel).mockResolvedValue("paid");
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp());
  vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue(teams());
  vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([winResult()]);
  vi.mocked(findOrganizationById).mockResolvedValue({ id: ORG, name: "Acme", logo_url: "https://cdn.example/logo.png" } as never);
  vi.mocked(compRepo.finalizeTieBreakerLockViaQuota).mockImplementation(async (_s, fnInput) => ({
    ...lockedRow("TB-2026-00001"),
    locked_snapshot: fnInput.snapshot,
  }));
});

describe("lock service", () => {
  it("blocks lock with too few teams or no completed results", async () => {
    vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue(teams().slice(0, 1));
    await expect(lock()).rejects.toThrow("at least 2 teams");
    vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue(teams());
    vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([]);
    await expect(lock()).rejects.toThrow("completed result");
    expect(compRepo.finalizeTieBreakerLockViaQuota).not.toHaveBeenCalled();
  });

  it("rejects draft → locked transitions and cross-org locks", async () => {
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp("draft"));
    vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([]);
    await expect(lock()).rejects.toThrow();
    await expect(
      lockCompetition(supabase, "other-org", COMP, { allowIncomplete: true, allowUnresolved: true }, USER),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(compRepo.finalizeTieBreakerLockViaQuota).not.toHaveBeenCalled();
  });

  it("requires acknowledgment for incomplete results and unresolved ties", async () => {
    vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([
      winResult(),
      { ...winResult(), id: "res-2", winner: null, is_complete: false },
    ]);
    await expect(
      lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: true }, USER),
    ).rejects.toThrow("incomplete");
    // Unresolved: split legs (A 2–0, B 2–0) tie on points, H2H, maps, and wins.
    vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([
      { ...winResult(), id: "r1", winner: "team_a" },
      { ...winResult(), id: "r2", team_a_id: B, team_b_id: A, winner: "team_a" },
    ]);
    await expect(
      lockCompetition(supabase, ORG, COMP, { allowIncomplete: true, allowUnresolved: false }, USER),
    ).rejects.toThrow("remain tied");
    await expect(
      lockCompetition(supabase, ORG, COMP, { allowIncomplete: true, allowUnresolved: true }, USER),
    ).resolves.toMatchObject({ status: "locked" });
  });

  it("finalizes through the quota RPC with server-derived identity", async () => {
    const locked = await lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: false }, USER);
    expect(locked.status).toBe("locked");
    expect(locked.record_number).toBe("TB-2026-00001");
    const finalizeArg = vi.mocked(compRepo.finalizeTieBreakerLockViaQuota).mock.calls[0]?.[1];
    expect(finalizeArg).toMatchObject({ organizationId: ORG, competitionId: COMP, userId: USER });
    expect(finalizeArg?.lockedAt).toEqual(expect.any(String));
    expect(finalizeArg?.snapshot).toBeDefined();
    const snapshot = locked.locked_snapshot as unknown as Record<string, unknown>;
    expect(snapshot).toMatchObject({ competitionName: "Monsoon Cup", organizationName: "Acme" });
    expect(JSON.stringify(snapshot)).not.toContain("Private");
  });

  it("keeps paid branding in the snapshot, strips it for Free", async () => {
    await lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: false }, USER);
    const paidSnapshot = vi.mocked(compRepo.finalizeTieBreakerLockViaQuota).mock.calls[0]?.[1]
      ?.snapshot as unknown as Record<string, unknown>;
    expect(paidSnapshot).toMatchObject({ organizationLogoUrl: "https://cdn.example/logo.png" });

    vi.mocked(resolveTieBreakerAccessLevel).mockResolvedValue("free");
    await lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: false }, USER);
    const freeSnapshot = vi.mocked(compRepo.finalizeTieBreakerLockViaQuota).mock.calls[1]?.[1]
      ?.snapshot as unknown as Record<string, unknown>;
    expect(freeSnapshot?.organizationLogoUrl).toBeUndefined();
  });

  it("maps quota rejection to the customer-safe upgrade message", async () => {
    vi.mocked(compRepo.finalizeTieBreakerLockViaQuota).mockRejectedValue({ code: "TBF01", message: "quota_exceeded" });
    await expect(
      lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: false }, USER),
    ).rejects.toThrow("You've used all 3 free Tie-Breaker records for this month");
  });

  it("is idempotent: repeats return the record without finalizing again", async () => {
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(lockedRow("TB-2026-00001"));
    const locked = await lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: false }, USER);
    expect(locked.record_number).toBe("TB-2026-00001");
    expect(compRepo.finalizeTieBreakerLockViaQuota).not.toHaveBeenCalled();
  });

  it("returns the RPC-resolved record when a concurrent race is lost", async () => {
    vi.mocked(compRepo.finalizeTieBreakerLockViaQuota).mockResolvedValue(lockedRow("TB-2026-00009"));
    const locked = await lockCompetition(supabase, ORG, COMP, { allowIncomplete: false, allowUnresolved: false }, USER);
    expect(locked.record_number).toBe("TB-2026-00009");
    expect(compRepo.finalizeTieBreakerLockViaQuota).toHaveBeenCalledTimes(1);
  });
});
