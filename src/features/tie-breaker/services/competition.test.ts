import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertTransition,
  canTransition,
  createCompetition,
  deleteCompetition,
  getCompetition,
  updateCompetition,
} from "./competition";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";

vi.mock("@/server/repositories/tie-breaker-competitions");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";

function row(overrides: Partial<compRepo.TieBreakerCompetitionRow> = {}): compRepo.TieBreakerCompetitionRow {
  return {
    id: "comp-1",
    organization_id: ORG,
    created_by: USER,
    name: "Monsoon Cup",
    description: null,
    status: "draft",
    scoring_win: 3,
    scoring_draw: 1,
    scoring_loss: 0,
    draws_enabled: false,
    round_label: "rounds",
    rule_order: ["points", "h2h"],
    preset_ref: "round_robin",
    share_token: "token-1",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const validConfig = {
  name: "Monsoon Cup",
  description: null,
  scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" as const },
  ruleOrder: ["points", "h2h"] as ("points" | "h2h")[],
  presetRef: "round_robin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(row());
});

describe("competition lifecycle", () => {
  it("allows draft → active → locked, rejects draft → locked and any exit from locked", () => {
    expect(canTransition("draft", "active")).toBe(true);
    expect(canTransition("active", "locked")).toBe(true);
    expect(canTransition("draft", "locked")).toBe(false);
    expect(canTransition("locked", "active")).toBe(false);
    expect(() => assertTransition("draft", "locked")).toThrow("completed result");
    expect(() => assertTransition("locked", "draft")).toThrow("locked official result");
  });

  it("creates a competition from valid configuration", async () => {
    vi.mocked(compRepo.createTieBreakerCompetition).mockResolvedValue(row());
    const created = await createCompetition(supabase, ORG, USER, validConfig);
    expect(created.id).toBe("comp-1");
    expect(compRepo.createTieBreakerCompetition).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ organization_id: ORG, created_by: USER, name: "Monsoon Cup" }),
    );
  });

  it("rejects invalid configuration without touching the database", async () => {
    await expect(createCompetition(supabase, ORG, USER, { ...validConfig, ruleOrder: ["h2h"] })).rejects.toThrow();
    expect(compRepo.createTieBreakerCompetition).not.toHaveBeenCalled();
  });

  it("reads an owned competition and denies cross-org reads", async () => {
    await expect(getCompetition(supabase, ORG, "comp-1")).resolves.toMatchObject({ id: "comp-1" });
    await expect(getCompetition(supabase, "other-org", "comp-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(null);
    await expect(getCompetition(supabase, ORG, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updates configuration while unlocked and denies locked updates", async () => {
    vi.mocked(compRepo.updateTieBreakerCompetition).mockResolvedValue(row({ name: "Renamed" }));
    await expect(
      updateCompetition(supabase, ORG, "comp-1", { ...validConfig, name: "Renamed" }),
    ).resolves.toMatchObject({ name: "Renamed" });
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(row({ status: "locked" }));
    await expect(updateCompetition(supabase, ORG, "comp-1", validConfig)).rejects.toThrow("locked official result");
    expect(compRepo.updateTieBreakerCompetition).toHaveBeenCalledTimes(1);
  });

  it("deletes drafts but preserves locked official records", async () => {
    await expect(deleteCompetition(supabase, ORG, "comp-1")).resolves.toBeUndefined();
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(row({ status: "locked" }));
    await expect(deleteCompetition(supabase, ORG, "comp-1")).rejects.toThrow("kept for your records");
  });
});
