// P3 tournament reader tests (no network, no Supabase project).
// A minimal fake client implements only the `rpc` surface the reader uses,
// targeting the PROPOSED contract (no migration exists). Covers: frozen
// column mapping, strict field shapes, extra-key rejection, bad-URL rows
// failing closed, unknown-game pass-through, vocabulary rejection for known
// games, derived status, generic errors, and 404-equivalence for detail.

import { describe, expect, it } from "vitest";
import {
  TournamentDirectoryOperationError,
  TournamentDirectoryValidationError,
} from "@/features/tournaments/domain/public-card";
import { getTournamentBySlug, searchTournaments } from "./tournament-reader";

function fakeClient(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data, error };
      },
    },
  };
}

const SEARCH_ROW = {
  slug: "monsoon-showdown-cup",
  title: "Monsoon Showdown Cup",
  game_key: "bgmi",
  region_code: "india",
  format: "team",
  starts_at: "2099-12-01T10:00:00.000Z",
  ends_at: "2099-12-03T18:00:00.000Z",
  timezone: "Asia/Kolkata",
  entry_fee: { amountMinor: 0, currency: "INR" },
  prize_pool: { amountMinor: 10000000, currency: "INR" },
  organizer: { kind: "independent", name: "Nova Events", slug: null, verified: false },
  lifecycle: "published",
  registration_url: "https://events.example.com/register",
  registration_closes_at: null,
};

const DETAIL_ROW = {
  ...SEARCH_ROW,
  description: "A weekend BGMI open.",
  contact_instructions: null,
  eligibility: {
    min_team_size: 4,
    max_team_size: 4,
    region_codes: ["india"],
    min_age: null,
    note: null,
  },
};

describe("searchTournaments — input validation", () => {
  it("rejects malformed input with a validation error (no RPC call)", async () => {
    const { client, calls } = fakeClient([]);
    await expect(searchTournaments(client as never, { limit: 999 })).rejects.toBeInstanceOf(
      TournamentDirectoryValidationError,
    );
    expect(calls).toHaveLength(0);
  });

  it("rejects an unknown-region filter for a known game before any RPC call", async () => {
    const { client, calls } = fakeClient([]);
    await expect(
      searchTournaments(client as never, { game: "bgmi", region: "atlantis", limit: 24, offset: 0 }),
    ).rejects.toBeInstanceOf(TournamentDirectoryValidationError);
    expect(calls).toHaveLength(0);
  });

  it("passes unknown games through to the RPC (fail closed to zero rows)", async () => {
    const { client, calls } = fakeClient([]);
    const rows = await searchTournaments(client as never, {
      game: "valorant",
      limit: 24,
      offset: 0,
    });
    expect(rows).toEqual([]);
    expect(calls[0]?.fn).toBe("search_tournaments");
    expect(calls[0]?.args).toMatchObject({ p_game: "valorant" });
  });
});

describe("searchTournaments — strict mapping", () => {
  it("maps exactly the proposed columns and derives upcoming status", async () => {
    const { client, calls } = fakeClient([SEARCH_ROW]);
    const rows = await searchTournaments(client as never, { limit: 25, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe("monsoon-showdown-cup");
    expect(rows[0]?.status).toBe("upcoming");
    expect(calls[0]?.args).toMatchObject({
      p_game: null,
      p_region: null,
      p_status: null,
      p_query: null,
      p_limit: 25,
      p_offset: 0,
    });
  });

  it("rejects rows with extra keys (owner/moderation internals never pass)", async () => {
    const tainted = { ...SEARCH_ROW, owner_user_id: "22222222-2222-4222-8222-222222222222" };
    const { client } = fakeClient([tainted]);
    await expect(searchTournaments(client as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
  });

  it("fails closed on hostile registration URLs and bad money", async () => {
    const { client: c1 } = fakeClient([
      { ...SEARCH_ROW, registration_url: "javascript:alert(1)" },
    ]);
    await expect(searchTournaments(c1 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
    const { client: c2 } = fakeClient([
      { ...SEARCH_ROW, prize_pool: { amountMinor: -5, currency: "INR" } },
    ]);
    await expect(searchTournaments(c2 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
  });

  it("fails closed on inverted dates and verified organizer flags", async () => {
    const { client: c1 } = fakeClient([
      { ...SEARCH_ROW, starts_at: "2099-12-03T18:00:00.000Z", ends_at: "2099-12-01T10:00:00.000Z" },
    ]);
    await expect(searchTournaments(c1 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
    const { client: c2 } = fakeClient([
      { ...SEARCH_ROW, organizer: { kind: "independent", name: "Nova", slug: null, verified: true } },
    ]);
    await expect(searchTournaments(c2 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
  });

  it("maps transport failures to a generic operation error (no raw detail)", async () => {
    const { client } = fakeClient(null, { message: "function search_tournaments does not exist" });
    const failure = await searchTournaments(client as never, { limit: 25, offset: 0 }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(TournamentDirectoryOperationError);
    expect(String((failure as Error).message)).not.toContain("does not exist");
  });
});

describe("getTournamentBySlug — detail contract", () => {
  it("returns null for zero rows (404-equivalence, no existence signal)", async () => {
    const { client, calls } = fakeClient([]);
    await expect(getTournamentBySlug(client as never, "monsoon-showdown-cup")).resolves.toBeNull();
    expect(calls[0]?.args).toEqual({ p_slug: "monsoon-showdown-cup" });
  });

  it("maps the detail row including eligibility", async () => {
    const { client } = fakeClient([DETAIL_ROW]);
    const card = await getTournamentBySlug(client as never, "monsoon-showdown-cup");
    expect(card?.description).toBe("A weekend BGMI open.");
    expect(card?.eligibility?.max_team_size).toBe(4);
    expect(card?.status).toBe("upcoming");
  });

  it("rejects invalid slug syntax without calling the RPC", async () => {
    const { client, calls } = fakeClient([]);
    await expect(getTournamentBySlug(client as never, "BAD SLUG!")).rejects.toBeInstanceOf(
      TournamentDirectoryValidationError,
    );
    expect(calls).toHaveLength(0);
  });

  it("fails closed on multi-row anomalies and overlong contact text", async () => {
    const { client: c1 } = fakeClient([DETAIL_ROW, DETAIL_ROW]);
    await expect(getTournamentBySlug(c1 as never, "monsoon-showdown-cup")).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
    const { client: c2 } = fakeClient([
      { ...DETAIL_ROW, contact_instructions: "x".repeat(501) },
    ]);
    await expect(getTournamentBySlug(c2 as never, "monsoon-showdown-cup")).rejects.toBeInstanceOf(
      TournamentDirectoryOperationError,
    );
  });
});
