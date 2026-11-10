import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addTeam, listTeams, removeTeam, updateTeam } from "./teams";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";

vi.mock("@/server/repositories/tie-breaker-competitions");
vi.mock("@/server/repositories/tie-breaker-teams");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const COMP = "comp-1";

function comp(status: compRepo.TieBreakerStatus = "draft"): compRepo.TieBreakerCompetitionRow {
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
    rule_order: ["points", "h2h"],
    preset_ref: null,
    share_token: "token-1",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function team(id: string, name: string): teamRepo.TieBreakerTeamRow {
  return {
    id,
    competition_id: COMP,
    organization_id: ORG,
    name,
    short_name: null,
    logo_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp());
  vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue([team("t1", "Falcons")]);
});

describe("team service", () => {
  it("adds a team to an owned unlocked competition", async () => {
    vi.mocked(teamRepo.createTieBreakerTeam).mockResolvedValue(team("t2", "Sentinels"));
    const created = await addTeam(supabase, ORG, COMP, { name: "Sentinels", shortName: null, logoUrl: null });
    expect(created.id).toBe("t2");
  });

  it("rejects duplicate names case-insensitively without writing", async () => {
    await expect(addTeam(supabase, ORG, COMP, { name: "falcons", shortName: null, logoUrl: null })).rejects.toThrow(
      "already used",
    );
    expect(teamRepo.createTieBreakerTeam).not.toHaveBeenCalled();
  });

  it("enforces the 32-team maximum", async () => {
    vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue(
      Array.from({ length: 32 }, (_, i) => team(`t${i}`, `Team ${i}`)),
    );
    await expect(addTeam(supabase, ORG, COMP, { name: "Extra", shortName: null, logoUrl: null })).rejects.toThrow("32 teams");
  });

  it("rejects non-https logos", async () => {
    await expect(
      addTeam(supabase, ORG, COMP, { name: "Wolves", shortName: null, logoUrl: "http://example.com/l.png" }),
    ).rejects.toThrow();
  });

  it("updates and removes teams, guarding wrong-competition references", async () => {
    vi.mocked(teamRepo.findTieBreakerTeamById).mockResolvedValue(team("t1", "Falcons"));
    vi.mocked(teamRepo.updateTieBreakerTeam).mockResolvedValue(team("t1", "Falcons Pro"));
    await expect(
      updateTeam(supabase, ORG, COMP, "t1", { name: "Falcons Pro", shortName: null, logoUrl: null }),
    ).resolves.toMatchObject({ name: "Falcons Pro" });
    vi.mocked(teamRepo.findTieBreakerTeamById).mockResolvedValue({ ...team("t9", "Other"), competition_id: "other-comp" });
    await expect(
      updateTeam(supabase, ORG, COMP, "t9", { name: "X", shortName: null, logoUrl: null }),
    ).rejects.toThrow("does not belong");
    await expect(removeTeam(supabase, "other-org", COMP, "t1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies every mutation on locked competitions", async () => {
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp("locked"));
    await expect(addTeam(supabase, ORG, COMP, { name: "X", shortName: null, logoUrl: null })).rejects.toThrow(
      "locked official result",
    );
    await expect(removeTeam(supabase, ORG, COMP, "t1")).rejects.toThrow("locked official result");
    expect(teamRepo.createTieBreakerTeam).not.toHaveBeenCalled();
  });

  it("lists teams only for the owning organization", async () => {
    await expect(listTeams(supabase, ORG, COMP)).resolves.toHaveLength(1);
    await expect(listTeams(supabase, "other-org", COMP)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
