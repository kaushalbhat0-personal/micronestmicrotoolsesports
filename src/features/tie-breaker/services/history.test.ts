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
