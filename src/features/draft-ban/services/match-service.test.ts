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
  getHistory,
  getMatch,
  undoMatchAction,
} from "./match-service";
import * as matchRepo from "@/server/repositories/draft-matches";
import * as templateRepo from "@/server/repositories/draft-templates";

vi.mock("@/server/repositories/draft-matches");
vi.mock("@/server/repositories/draft-templates");
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";
const MATCH = "11111111-1111-4111-8111-111111111111";

function finalize() {
  return finalizeMatch(supabase, ORG, MATCH, USER);
}

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

  it("rejects a foreign-organization templateId (cannot bypass quota or borrow setups)", async () => {
    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      organization_id: "other-org",
      name: "Foreign",
      config: { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null },
      is_starter: false,
      created_by: "other-user",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await expect(
      createMatch(supabase, ORG, USER, { ...validInput, templateId: "22222222-2222-4222-8222-222222222222" }),
    ).rejects.toThrow(/Cross-organization/);
    expect(matchRepo.createDraftMatch).not.toHaveBeenCalled();
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
    await expect(finalize()).rejects.toThrow(/not complete/);
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
    vi.mocked(matchRepo.finalizeDraftMatchViaQuota).mockResolvedValue({ ...full, status: "completed" });
    const done = await finalize();
    expect(done.status).toBe("completed");
    expect(matchRepo.finalizeDraftMatchViaQuota).toHaveBeenCalledWith(
      expect.anything(),
      { organizationId: ORG, matchId: MATCH, userId: USER },
    );
  });

  it("finalize is idempotent on already-completed matches", async () => {
    const completed = row({ status: "completed", completed_at: new Date().toISOString() });
    vi.mocked(matchRepo.findDraftMatchById).mockResolvedValue(completed);
    const result = await finalize();
    expect(result.status).toBe("completed");
    expect(matchRepo.finalizeDraftMatchViaQuota).not.toHaveBeenCalled();
  });

  it("maps quota rejection to the customer-safe upgrade message", async () => {
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
    vi.mocked(matchRepo.finalizeDraftMatchViaQuota).mockRejectedValue({ code: "DBQ01", message: "quota_exceeded" });
    await expect(finalize()).rejects.toThrow(/free Draft & Ban completion for this month/);
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

describe("history window (Free latest 5 completed, drafts unlimited)", () => {
  const completedRow = (id: string, completedAt: string, name = `Cup ${id}`) =>
    row({ id, status: "completed", completed_at: completedAt, match_name: name }) as matchRepo.DraftMatchRow;

  function historyMocks(opts: {
    inProgress?: matchRepo.DraftMatchRow[];
    abandoned?: matchRepo.DraftMatchRow[];
    completed?: matchRepo.DraftMatchRow[];
    completedTotal?: number;
    total?: number;
  }) {
    // Mirror the repository contract: completed lists arrive newest-first
    // (completed_at DESC, id DESC), regardless of insertion order.
    const orderedCompleted = [...(opts.completed ?? [])].sort((a, b) => {
      const at = String(b.completed_at).localeCompare(String(a.completed_at));
      if (at !== 0) return at;
      return b.id.localeCompare(a.id);
    });
    vi.mocked(matchRepo.searchDraftMatches).mockImplementation(async (_s, _o, q) => {
      if (q?.status === "in_progress") return opts.inProgress ?? [];
      if (q?.status === "abandoned") return opts.abandoned ?? [];
      return [...(opts.inProgress ?? []), ...(opts.abandoned ?? []), ...orderedCompleted];
    });
    vi.mocked(matchRepo.listCompletedDraftMatchesByOrg).mockResolvedValue(orderedCompleted);
    vi.mocked(matchRepo.countCompletedDraftMatches).mockResolvedValue(opts.completedTotal ?? opts.completed?.length ?? 0);
    vi.mocked(matchRepo.countDraftMatchesByOrg).mockResolvedValue(
      opts.total ?? (opts.inProgress?.length ?? 0) + (opts.abandoned?.length ?? 0) + (opts.completed?.length ?? 0),
    );
  }

  const days = (n: number) => new Date(Date.UTC(2026, 9, n, 12, 0, 0)).toISOString();
  const six = () =>
    [1, 2, 3, 4, 5, 6].map((d) => completedRow(`c${d}`, days(d), d === 1 ? "Old but gold" : `Cup c${d}`));

  beforeEach(() => vi.clearAllMocks());

  it("free with 0 completed → empty", async () => {
    historyMocks({});
    const history = await getHistory(supabase, ORG, {}, "free");
    expect(history.matches).toEqual([]);
    expect(history.completedTotal).toBe(0);
  });

  it("free with 3 completed → all 3", async () => {
    const completed = [completedRow("c1", days(1)), completedRow("c2", days(2)), completedRow("c3", days(3))];
    historyMocks({ completed: [...completed].reverse(), completedTotal: 3 });
    const history = await getHistory(supabase, ORG, {}, "free");
    expect(history.matches.map((c) => c.id).sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("free with exactly 5 → all 5", async () => {
    const completed = [1, 2, 3, 4, 5].map((d) => completedRow(`c${d}`, days(d)));
    historyMocks({ completed, completedTotal: 5 });
    const history = await getHistory(supabase, ORG, {}, "free");
    expect(history.matches).toHaveLength(5);
  });

  it("free with 6 → latest 5 only, oldest hidden but counted", async () => {
    historyMocks({ completed: six(), completedTotal: 6 });
    const history = await getHistory(supabase, ORG, {}, "free");
    expect(history.matches.map((c) => c.id).sort()).toEqual(["c2", "c3", "c4", "c5", "c6"]);
    expect(history.completedTotal).toBe(6);
  });

  it("free with 10 → latest 5 only", async () => {
    const completed = Array.from({ length: 10 }, (_, i) => completedRow(`c${i + 1}`, days(i + 1)));
    historyMocks({ completed, completedTotal: 10 });
    const history = await getHistory(supabase, ORG, {}, "free");
    expect(history.matches.map((c) => c.id).sort()).toEqual(["c10", "c6", "c7", "c8", "c9"]);
    expect(history.completedTotal).toBe(10);
  });

  it("ordering uses completed_at DESC, not created_at", async () => {
    // c-old was created first but completed last → must be visible.
    const stale = { ...completedRow("c-old", days(9)), created_at: days(1) };
    const fresh = { ...completedRow("c-new", days(2)), created_at: days(8) };
    const rest = [3, 4, 5, 6].map((d) => completedRow(`c${d}`, days(d)));
    historyMocks({ completed: [stale, fresh, ...rest], completedTotal: 6 });
    const history = await getHistory(supabase, ORG, {}, "free");
    const ids = history.matches.map((c) => c.id);
    expect(ids).toContain("c-old");
    expect(ids).not.toContain("c-new");
  });

  it("deterministic tie-breaking on equal completed_at", async () => {
    const at = days(5);
    const completed = [completedRow("c1", at), completedRow("c2", at), completedRow("c3", at), completedRow("c4", at), completedRow("c5", at), completedRow("c6", at)];
    historyMocks({ completed, completedTotal: 6 });
    const first = await getHistory(supabase, ORG, {}, "free");
    const second = await getHistory(supabase, ORG, {}, "free");
    expect(first.matches.map((c) => c.id)).toEqual(second.matches.map((c) => c.id));
    expect(first.matches).toHaveLength(5);
  });

  it("search applies before the slice: older matching record is returned", async () => {
    // Service receives the already searched+ordered completed list; the slice
    // must apply to the search result, not the global latest five.
    const matching = [completedRow("cold", days(1), "Old but gold")];
    historyMocks({ completed: matching, completedTotal: 1 });
    const history = await getHistory(supabase, ORG, { search: "gold" }, "free");
    expect(history.matches.map((c) => c.id)).toEqual(["cold"]);
    expect(matchRepo.listCompletedDraftMatchesByOrg).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      expect.objectContaining({ search: "gold" }),
    );
  });

  it("in-progress drafts and abandoned records are never capped", async () => {
    const inProgress = Array.from({ length: 8 }, (_, i) => row({ id: `d${i}`, status: "in_progress" }));
    const abandoned = [row({ id: "a1", status: "abandoned" }), row({ id: "a2", status: "abandoned" })];
    const completed = [completedRow("c1", days(1))];
    historyMocks({ inProgress, abandoned, completed, completedTotal: 1 });
    const history = await getHistory(supabase, ORG, {}, "free");
    expect(history.matches.filter((c) => c.status === "in_progress")).toHaveLength(8);
    expect(history.matches.filter((c) => c.status === "abandoned")).toHaveLength(2);
  });

  it("status filter narrows before the window", async () => {
    const inProgress = [row({ id: "d1", status: "in_progress" })];
    historyMocks({ inProgress, completed: six(), completedTotal: 6 });
    const locked = await getHistory(supabase, ORG, { status: "completed" }, "free");
    expect(locked.matches.map((c) => c.id).sort()).toEqual(["c2", "c3", "c4", "c5", "c6"]);
    const drafts = await getHistory(supabase, ORG, { status: "in_progress" }, "free");
    expect(drafts.matches.map((c) => c.id)).toEqual(["d1"]);
  });

  it("paid sees the full completed history", async () => {
    const completed = Array.from({ length: 9 }, (_, i) => completedRow(`c${i + 1}`, days(i + 1)));
    vi.mocked(matchRepo.searchDraftMatches).mockResolvedValue(completed);
    vi.mocked(matchRepo.countDraftMatchesByOrg).mockResolvedValue(9);
    vi.mocked(matchRepo.countCompletedDraftMatches).mockResolvedValue(9);
    const history = await getHistory(supabase, ORG, {}, "paid");
    expect(history.matches).toHaveLength(9);
    expect(history.completedTotal).toBe(9);
    expect(matchRepo.listCompletedDraftMatchesByOrg).not.toHaveBeenCalled();
  });
});


