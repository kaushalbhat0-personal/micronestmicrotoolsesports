import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCompletedTieBreakerShare, parseTieBreakerShareToken } from "./share";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    record_number: "TB-2026-00007",
    competition_name: "Monsoon Cup — Group A",
    description: null,
    locked_at: "2026-10-07T10:00:00.000Z",
    rule_order: ["points", "h2h", "map_diff"],
    scoring: { win: 3, draw: 1, loss: 0, draws_enabled: false, round_label: "rounds" },
    snapshot: {
      standings: [
        {
          teamId: "11111111-1111-4111-8111-111111111111",
          position: 1,
          points: 6,
          wins: 2,
          draws: 0,
          losses: 0,
          mapDiff: 3,
          roundDiff: 0,
          tied: false,
          tiedWith: [],
        },
        {
          teamId: "22222222-2222-4222-8222-222222222222",
          position: 2,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 2,
          mapDiff: -3,
          roundDiff: 0,
          tied: false,
          tiedWith: [],
        },
      ],
      explanations: [
        {
          scope: "separation",
          teamIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
          decisiveRule: "points",
          summary: "Falcons finished above Sentinels on points (6 vs 0).",
        },
      ],
      teamNames: {
        "11111111-1111-4111-8111-111111111111": "Falcons",
        "22222222-2222-4222-8222-222222222222": "Sentinels",
      },
    },
    organization_name: "Acme Esports",
    organization_logo_url: null,
    ...overrides,
  };
}

function adminReturning(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  } as unknown as SupabaseClient;
}

describe("tie-breaker public share boundary", () => {
  it("accepts valid UUID tokens and rejects malformed links", () => {
    expect(parseTieBreakerShareToken("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(() => parseTieBreakerShareToken("not-a-token")).toThrow("Invalid share link");
  });

  it("returns the allowlisted record for a locked share token", async () => {
    const record = await fetchCompletedTieBreakerShare(adminReturning(payload()), "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(record?.record_number).toBe("TB-2026-00007");
    expect(record?.organization_name).toBe("Acme Esports");
  });

  it("returns null when the RPC errors (draft, missing, or revoked)", async () => {
    expect(await fetchCompletedTieBreakerShare(adminReturning(null, new Error("not found")), "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBeNull();
    expect(await fetchCompletedTieBreakerShare(adminReturning(null, null), "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBeNull();
  });

  it("rejects payloads smuggling private notes or internal IDs", async () => {
    const leaked = payload({ notes: "Private note", organization_id: "org-1", created_by: "user-1" });
    expect(await fetchCompletedTieBreakerShare(adminReturning(leaked), "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBeNull();
  });

  it("rejects malformed record numbers and non-https logos", async () => {
    expect(await fetchCompletedTieBreakerShare(adminReturning(payload({ record_number: "123" })), "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBeNull();
    expect(
      await fetchCompletedTieBreakerShare(
        adminReturning(payload({ organization_logo_url: "http://example.com/l.png" })),
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ),
    ).toBeNull();
  });

  it("queries the locked-only RPC with the token", async () => {
    const admin = adminReturning(payload());
    await fetchCompletedTieBreakerShare(admin, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(vi.mocked(admin.rpc).mock.calls[0]?.[0]).toBe("get_completed_tie_breaker_share");
  });

  it("accepts a real lock-service snapshot wrapped as the RPC returns it (regression: teamNames)", async () => {
    const { buildLockSnapshot } = await import("./tie-breaker-foundation");
    const snapshot = buildLockSnapshot({
      competitionName: "Monsoon Cup — Group A",
      description: null,
      recordNumber: "TB-2026-00007",
      lockedAt: "2026-10-07T10:00:00.000Z",
      ruleOrder: ["points", "h2h", "map_diff"],
      scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" },
      standings: {
        entries: [
          { teamId: "11111111-1111-4111-8111-111111111111", position: 1, points: 6, wins: 2, draws: 0, losses: 0, mapDiff: 3, roundDiff: 0, decisiveRule: "points", tied: false, tiedWith: [] },
          { teamId: "22222222-2222-4222-8222-222222222222", position: 2, points: 0, wins: 0, draws: 0, losses: 2, mapDiff: -3, roundDiff: 0, tied: false, tiedWith: [] },
        ],
        tieGroups: [],
        evaluations: [],
        explanations: [
          { scope: "separation", teamIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"], checkedRules: [], decisiveRule: "points", summary: "Falcons finished above Sentinels on points (6 vs 0)." },
        ],
        rulesApplied: ["points", "h2h", "map_diff"],
        engineVersion: "tie-breaker-engine/1",
      },
      teamNames: {
        "11111111-1111-4111-8111-111111111111": "Falcons",
        "22222222-2222-4222-8222-222222222222": "Sentinels",
      },
      organizationName: "Acme Esports",
      organizationLogoUrl: null,
    });
    // RPC projects the full locked_snapshot as `snapshot` alongside header fields.
    const rpcShape = {
      record_number: "TB-2026-00007",
      competition_name: "Monsoon Cup — Group A",
      description: null,
      locked_at: "2026-10-07T10:00:00.000Z",
      rule_order: ["points", "h2h", "map_diff"],
      scoring: { win: 3, draw: 1, loss: 0, draws_enabled: false, round_label: "rounds" },
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>,
      organization_name: "Acme Esports",
      organization_logo_url: null,
    };
    const admin = adminReturning(rpcShape);
    const record = await fetchCompletedTieBreakerShare(admin, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(record?.snapshot.teamNames["11111111-1111-4111-8111-111111111111"]).toBe("Falcons");
  });
});
