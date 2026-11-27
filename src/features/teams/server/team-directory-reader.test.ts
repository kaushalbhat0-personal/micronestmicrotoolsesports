// P1 team-directory reader tests (no network, no Supabase project).
// A minimal fake client implements only the `rpc` surface the reader uses.
// Covers: frozen 9-key mapping, strict field shapes, extra-key rejection,
// unknown-game fail-closed pass-through, vocabulary rejection for known
// games, generic (never raw) errors, 404-equivalence for detail, and the
// absence of owner/org/applicant internals in every mapped card.

import { describe, expect, it } from "vitest";
import {
  TeamDirectoryOperationError,
  TeamDirectoryValidationError,
} from "@/features/teams/domain/team-directory";
import { getTeamBySlug, searchTeams } from "./team-directory-reader";

interface FakeRpc {
  data: unknown;
  error: { message: string } | null;
  calls: Array<{ fn: string; args: Record<string, unknown> }>;
}

function fakeClient(data: unknown, error: { message: string } | null = null) {
  const state: FakeRpc = { data, error, calls: [] };
  return {
    state,
    // The reader types this as SupabaseClient; the fake implements the only
    // method the reader calls.
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        state.calls.push({ fn, args });
        return { data: state.data, error: state.error };
      },
    },
  };
}

const SEARCH_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "nova-esports",
  name: "Nova Esports",
  game_key: "bgmi",
  region_code: "india",
  current_level: "competitive",
  target_level: "semi-pro",
  recruiting: true,
  member_count: 5,
};

const DETAIL_ROW = { ...SEARCH_ROW, description: "A competitive BGMI squad." };

describe("searchTeams — input validation", () => {
  it("rejects malformed input with a validation error (no RPC call)", async () => {
    const { client, state } = fakeClient([]);
    await expect(searchTeams(client as never, { limit: 999 })).rejects.toBeInstanceOf(
      TeamDirectoryValidationError,
    );
    expect(state.calls).toHaveLength(0);
  });

  it("rejects an unknown-region filter for a known game before any RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(
      searchTeams(client as never, { game: "bgmi", region: "atlantis", limit: 24, offset: 0 }),
    ).rejects.toBeInstanceOf(TeamDirectoryValidationError);
    expect(state.calls).toHaveLength(0);
  });

  it("passes unknown games through to the RPC (fail closed to zero rows)", async () => {
    const { client, state } = fakeClient([]);
    const rows = await searchTeams(client as never, {
      game: "valorant",
      region: "india",
      limit: 24,
      offset: 0,
    });
    expect(rows).toEqual([]);
    expect(state.calls[0]?.fn).toBe("search_teams");
    expect(state.calls[0]?.args).toMatchObject({ p_game: "valorant", p_region: "india" });
  });
});

describe("searchTeams — strict mapping", () => {
  it("maps exactly the 9 public columns and forwards null filters", async () => {
    const { client, state } = fakeClient([SEARCH_ROW]);
    const rows = await searchTeams(client as never, { limit: 25, offset: 0 });
    expect(rows).toEqual([{ ...SEARCH_ROW }]);
    expect(state.calls[0]?.args).toMatchObject({
      p_game: null,
      p_region: null,
      p_query: null,
      p_limit: 25,
      p_offset: 0,
    });
  });

  it("rejects rows with extra keys (owner/org internals never pass through)", async () => {
    const tainted = { ...SEARCH_ROW, owner_user_id: "22222222-2222-4222-8222-222222222222" };
    const { client } = fakeClient([tainted]);
    await expect(searchTeams(client as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TeamDirectoryOperationError,
    );
  });

  it("rejects rows with missing keys or malformed fields", async () => {
    const { id: _dropped, ...missing } = SEARCH_ROW;
    const { client: c1 } = fakeClient([missing]);
    await expect(searchTeams(c1 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TeamDirectoryOperationError,
    );
    const { client: c2 } = fakeClient([{ ...SEARCH_ROW, recruiting: "yes" }]);
    await expect(searchTeams(c2 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TeamDirectoryOperationError,
    );
  });

  it("normalizes decimal-string member counts and rejects hostile shapes", async () => {
    const { client: c1 } = fakeClient([{ ...SEARCH_ROW, member_count: "7" }]);
    const rows = await searchTeams(c1 as never, { limit: 25, offset: 0 });
    expect(rows[0]?.member_count).toBe(7);
    const { client: c2 } = fakeClient([{ ...SEARCH_ROW, member_count: "-1" }]);
    await expect(searchTeams(c2 as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(
      TeamDirectoryOperationError,
    );
  });

  it("maps transport failures to a generic operation error (no raw detail)", async () => {
    const { client } = fakeClient(null, { message: "function search_teams does not exist" });
    const failure = await searchTeams(client as never, { limit: 25, offset: 0 }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(TeamDirectoryOperationError);
    expect(String((failure as Error).message)).not.toContain("does not exist");
  });
});

describe("getTeamBySlug — detail contract", () => {
  it("returns null for zero rows (404-equivalence, no existence signal)", async () => {
    const { client, state } = fakeClient([]);
    await expect(getTeamBySlug(client as never, "nova-esports")).resolves.toBeNull();
    expect(state.calls[0]?.args).toEqual({ p_slug: "nova-esports" });
  });

  it("maps the detail row including description", async () => {
    const { client } = fakeClient([DETAIL_ROW]);
    await expect(getTeamBySlug(client as never, "nova-esports")).resolves.toEqual(DETAIL_ROW);
  });

  it("rejects invalid slug syntax without calling the RPC", async () => {
    const { client, state } = fakeClient([]);
    await expect(getTeamBySlug(client as never, "BAD SLUG!")).rejects.toBeInstanceOf(
      TeamDirectoryValidationError,
    );
    expect(state.calls).toHaveLength(0);
  });

  it("fails closed on multi-row anomalies and transport errors", async () => {
    const { client: c1 } = fakeClient([DETAIL_ROW, DETAIL_ROW]);
    await expect(getTeamBySlug(c1 as never, "nova-esports")).rejects.toBeInstanceOf(
      TeamDirectoryOperationError,
    );
    const { client: c2 } = fakeClient(null, { message: "boom" });
    await expect(getTeamBySlug(c2 as never, "nova-esports")).rejects.toBeInstanceOf(
      TeamDirectoryOperationError,
    );
  });
});
