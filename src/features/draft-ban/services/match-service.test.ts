import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  abandonMatch,
  applyMatchAction,
  assertTransition,
  canTransition,
  createMatch,
  deleteMatch,
  duplicateMatch,
  finalizeMatch,
  getMatch,
  undoMatchAction,
} from "./match-service";
import * as matchRepo from "@/server/repositories/draft-matches";

vi.mock("@/server/repositories/draft-matches");
vi.mock("@/server/repositories/draft-templates");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";

const row = (overrides: Partial<matchRepo.DraftMatchRow> = {}): matchRepo.DraftMatchRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: ORG,
  created_by: USER,
  ref_code: "DB-2026-00042",
  match_name: null,
  event_name: null,
  format_label: null,
  notes: null,
  team_a: "TAG",
  team_b: "Rivals",
  template_id: null,
  sequence: [
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
    { team: "A", type: "pick" },
    { team: "B", type: "pick" },
  ],
  pool: ["Map A", "Map B", "Map C", "Map D", "Map E", "Map F", "Map G"],
  actions: [],
  status: "in_progress",
  share_token: "token-1",
  cloned_from: null,
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const validInput = {
  teamA: "TAG",
  teamB: "Rivals",
  pool: ["Map A", "Map B", "Map C", "Map D", "Map E", "Map F", "Map G"],
  sequence: [
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
    { team: "A", type: "pick" },
    { team: "B", type: "pick" },
  ] as Array<{ team: "A" | "B"; type: "ban" | "pick" }>,
  templateId: null,
  matchName: null,
  eventName: null,
  formatLabel: null,
  notes: null,
};

describe("match lifecycle transitions", () => {
  it("in_progress → completed allowed; completed is terminal", () => {
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("in_progress", "abandoned")).toBe(true);
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("completed", "completed")).toBe(true);
    expect(() => assertTransition("completed", "in_progress")).toThrow();
  });
});

describe("match-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a match with valid input", async () => {
    vi.mocked(matchRepo.createDraftMatch).mockResolvedValue(row());
    const created = await createMatch(supabase, ORG, USER, validInput);
    expect(created.team_a).toBe("TAG");
    expect(matchRepo.createDraftMatch).toHaveBeenCalledOnce();
  });

  it("rejects duplicate team names", async () => {
    await expect(createMatch(supabase, ORG, USER, { ...validInput, teamB: "tag" })).rejects.toThrow();
  });

  it("rejects cross-organization access", async () => {
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(row({ organization_id: "other" }));
    await expect(getMatch(supabase, ORG, "11111111-1111-4111-8111-111111111111")).rejects.toThrow(/Cross-organization/);
  });

  it("applies a valid action and detects stale cursor as conflict", async () => {
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(row());
    vi.mocked(matchRepo.appendDraftAction).mockImplementation(async (_s, _id, actions) => row({ actions: actions as matchRepo.DraftMatchRow["actions"] }));
    const updated = await applyMatchAction(supabase, ORG, { matchId: "11111111-1111-4111-8111-111111111111", team: "A", item: "Map A", expectedActionCount: 0 });
    expect(updated.actions).toHaveLength(1);
    await expect(applyMatchAction(supabase, ORG, { matchId: "11111111-1111-4111-8111-111111111111", team: "B", item: "Map B", expectedActionCount: 5 })).rejects.toThrow(/another tab/);
  });

  it("rejects wrong-turn actions", async () => {
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(row());
    await expect(applyMatchAction(supabase, ORG, { matchId: "11111111-1111-4111-8111-111111111111", team: "B", item: "Map A", expectedActionCount: 0 })).rejects.toThrow();
  });

  it("rejects actions on completed matches", async () => {
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(row({ status: "completed" }));
    await expect(applyMatchAction(supabase, ORG, { matchId: "11111111-1111-4111-8111-111111111111", team: "A", item: "Map A", expectedActionCount: 6 })).rejects.toThrow(/in-progress/);
    await expect(undoMatchAction(supabase, ORG, "11111111-1111-4111-8111-111111111111", 6)).rejects.toThrow(/Duplicate/);
  });

  it("finalizes only complete drafts", async () => {
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(row({ actions: [] }));
    await expect(finalizeMatch(supabase, ORG, "11111111-1111-4111-8111-111111111111")).rejects.toThrow(/not complete/);
    const full = row({
      actions: [
        { stepIndex: 0, team: "A", type: "ban", item: "Map A", at: new Date().toISOString() },
        { stepIndex: 1, team: "B", type: "ban", item: "Map B", at: new Date().toISOString() },
        { stepIndex: 2, team: "A", type: "ban", item: "Map C", at: new Date().toISOString() },
        { stepIndex: 3, team: "B", type: "ban", item: "Map D", at: new Date().toISOString() },
        { stepIndex: 4, team: "A", type: "pick", item: "Map E", at: new Date().toISOString() },
        { stepIndex: 5, team: "B", type: "pick", item: "Map F", at: new Date().toISOString() },
      ],
    });
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(full);
    vi.mocked(matchRepo.finalizeDraftMatch).mockResolvedValue({ ...full, status: "completed" });
    const done = await finalizeMatch(supabase, ORG, "11111111-1111-4111-8111-111111111111");
    expect(done.status).toBe("completed");
  });

  it("finalize is idempotent on already-completed matches", async () => {
    const completed = row({ status: "completed", completed_at: new Date().toISOString() });
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(completed);
    const result = await finalizeMatch(supabase, ORG, "11111111-1111-4111-8111-111111111111");
    expect(result.status).toBe("completed");
    expect(matchRepo.finalizeDraftMatch).not.toHaveBeenCalled();
  });

  it("duplicates without mutating the original", async () => {
    const original = row({ status: "completed" });
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(original);
    vi.mocked(matchRepo.createDraftMatch).mockResolvedValue(row({ id: "22222222-2222-4222-8222-222222222222", cloned_from: "11111111-1111-4111-8111-111111111111", status: "in_progress", actions: [] }));
    const copy = await duplicateMatch(supabase, ORG, USER, "11111111-1111-4111-8111-111111111111");
    expect(copy.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(copy.status).toBe("in_progress");
    expect(vi.mocked(matchRepo.createDraftMatch).mock.calls[0]?.[1]?.cloned_from).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("abandons in-progress and deletes", async () => {
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(row());
    vi.mocked(matchRepo.abandonDraftMatch).mockResolvedValue(row({ status: "abandoned" }));
    expect((await abandonMatch(supabase, ORG, "11111111-1111-4111-8111-111111111111")).status).toBe("abandoned");
    vi.mocked(matchRepo.deleteDraftMatch).mockResolvedValue(undefined);
    await deleteMatch(supabase, ORG, "11111111-1111-4111-8111-111111111111");
    expect(matchRepo.deleteDraftMatch).toHaveBeenCalledOnce();
  });
});


