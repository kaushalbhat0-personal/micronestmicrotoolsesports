import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistory } from "./history";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";

vi.mock("@/server/repositories/tie-breaker-competitions");

const supabase = {} as SupabaseClient;
const ORG = "org-1";

describe("history queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(compRepo.searchTieBreakerCompetitions).mockResolvedValue([]);
    vi.mocked(compRepo.listLockedTieBreakerCompetitionsSince).mockResolvedValue([]);
  });

  it("passes search, status, and limit through to the repository", async () => {
    await getHistory(supabase, ORG, { search: "TB-2026", status: "locked", limit: 20 });
    expect(compRepo.searchTieBreakerCompetitions).toHaveBeenCalledWith(
      supabase,
      ORG,
      expect.objectContaining({ search: "TB-2026", status: "locked", limit: 20 }),
    );
  });

  it("returns competitions with a total and defaults safely", async () => {
    const rows = [{ id: "c1" }, { id: "c2" }] as compRepo.TieBreakerCompetitionRow[];
    vi.mocked(compRepo.searchTieBreakerCompetitions).mockResolvedValue(rows);
    await expect(getHistory(supabase, ORG, {})).resolves.toEqual({ competitions: rows, total: 2 });
  });

  it("rejects invalid status filters before querying", async () => {
    await expect(getHistory(supabase, ORG, { status: "published" })).rejects.toThrow();
    expect(compRepo.searchTieBreakerCompetitions).not.toHaveBeenCalled();
  });
});

describe("free history window (latest 3 locked, drafts unlimited)", () => {
  const row = (id: string, status: "draft" | "active" | "locked", locked_at: string | null = null) =>
    ({ id, status, name: `Cup ${id}`, record_number: status === "locked" ? `TB-${id}` : null, locked_at }) as compRepo.TieBreakerCompetitionRow;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("free sees every draft/active plus the latest 3 locked by locked_at", async () => {
    vi.mocked(compRepo.searchTieBreakerCompetitions).mockResolvedValue([
      row("d1", "draft"),
      row("a1", "active"),
      row("l1", "locked"),
      row("l2", "locked"),
      row("l3", "locked"),
      row("l4", "locked"),
      row("l5", "locked"),
    ]);
    // locked_at DESC: l5 newest … l1 oldest.
    vi.mocked(compRepo.listLockedTieBreakerCompetitionsSince).mockResolvedValue([
      row("l5", "locked", "2026-11-05T00:00:00Z"),
      row("l4", "locked", "2026-10-05T00:00:00Z"),
      row("l3", "locked", "2026-09-05T00:00:00Z"),
      row("l2", "locked", "2026-08-05T00:00:00Z"),
      row("l1", "locked", "2026-07-05T00:00:00Z"),
    ]);
    const history = await getHistory(supabase, ORG, {}, "free");
    const ids = history.competitions.map((c) => c.id);
    expect(ids).toContain("d1");
    expect(ids).toContain("a1");
    expect(ids).toEqual(expect.arrayContaining(["l5", "l4", "l3"]));
    expect(ids).not.toContain("l2");
    expect(ids).not.toContain("l1");
    expect(history.total).toBe(5);
  });

  it("free never deletes retained rows: paid still sees everything", async () => {
    const rows = [row("d1", "draft"), row("l1", "locked"), row("l9", "locked")];
    vi.mocked(compRepo.searchTieBreakerCompetitions).mockResolvedValue(rows);
    const history = await getHistory(supabase, ORG, {}, "paid");
    expect(history.competitions).toEqual(rows);
    expect(compRepo.listLockedTieBreakerCompetitionsSince).not.toHaveBeenCalled();
  });

  it("free with a locked status filter shows only the window", async () => {
    vi.mocked(compRepo.searchTieBreakerCompetitions).mockResolvedValue([row("d1", "draft"), row("l1", "locked")]);
    vi.mocked(compRepo.listLockedTieBreakerCompetitionsSince).mockResolvedValue([
      row("l2", "locked", "2026-11-05T00:00:00Z"),
      row("l1", "locked", "2026-10-05T00:00:00Z"),
    ]);
    const history = await getHistory(supabase, ORG, { status: "locked" }, "free");
    expect(history.competitions.map((c) => c.id).sort()).toEqual(["l1"]);
  });
});
