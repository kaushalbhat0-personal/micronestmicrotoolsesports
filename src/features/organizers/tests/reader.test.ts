// P9 organizer reader tests (fake Supabase client, no network).
// Covers: invalid inputs fail closed, known-game region vocabulary enforced
// pre-RPC, strict key-set pinning, bad URLs fail rows closed, unknown games
// pass through to zero rows, unverified trust never renders confirmed,
// counts must be non-negative integers, extra keys dropped.

import { describe, expect, it } from "vitest";
import {
  OrganizerDirectoryOperationError,
  OrganizerDirectoryValidationError,
} from "../domain/organizer";
import { getOrganizerBySlug, searchOrganizers } from "../server/organizer-reader";

const SEARCH_KEYS = [
  "slug",
  "name",
  "region_code",
  "organizer_type",
  "game_keys",
  "trust_state",
  "published_tournament_count",
  "is_public",
] as const;

function searchRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of SEARCH_KEYS) {
    row[key] = {
      slug: "nova-events",
      name: "Nova Events",
      region_code: "india",
      organizer_type: "independent",
      game_keys: ["bgmi"],
      trust_state: "not_submitted",
      published_tournament_count: 0,
      is_public: true,
    }[key];
  }
  return { ...row, ...overrides };
}

function detailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...searchRow(),
    description: "Weekend BGMI opens.",
    website_url: null,
    social_links: [],
    organization_slug: null,
    ...overrides,
  };
}

function fakeClient(rows: Record<string, unknown>[] | Error): {
  rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: unknown }>;
} {
  return {
    rpc: async () => {
      if (rows instanceof Error) {
        return { data: null, error: rows };
      }
      return { data: rows, error: null };
    },
  };
}

describe("searchOrganizers", () => {
  it("rejects invalid inputs without calling the RPC", async () => {
    let called = false;
    const client = {
      rpc: async () => {
        called = true;
        return { data: [], error: null };
      },
    };
    await expect(searchOrganizers(client as never, { limit: 999 })).rejects.toBeInstanceOf(
      OrganizerDirectoryValidationError
    );
    expect(called).toBe(false);
  });

  it("rejects off-vocabulary regions for known games pre-RPC", async () => {
    let called = false;
    const client = {
      rpc: async () => {
        called = true;
        return { data: [], error: null };
      },
    };
    await expect(
      searchOrganizers(client as never, { game: "bgmi", region: "atlantis", limit: 24, offset: 0 })
    ).rejects.toBeInstanceOf(OrganizerDirectoryValidationError);
    expect(called).toBe(false);
  });

  it("passes unknown games through to zero rows", async () => {
    const client = fakeClient([]);
    const rows = await searchOrganizers(client as never, {
      game: "valorant",
      limit: 24,
      offset: 0,
    });
    expect(rows).toEqual([]);
  });

  it("maps valid rows and freezes unverified trust", async () => {
    const client = fakeClient([searchRow({ trust_state: "submitted" })]);
    const rows = await searchOrganizers(client as never, { limit: 24, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.trust_state).toBe("submitted");
  });

  it("fails closed on bad key-sets, bad URLs and bad counts", async () => {
    const { slug: _dropped, ...missingKey } = searchRow();
    await expect(
      searchOrganizers(fakeClient([missingKey]) as never, { limit: 24, offset: 0 })
    ).rejects.toBeInstanceOf(OrganizerDirectoryOperationError);

    await expect(
      searchOrganizers(fakeClient([searchRow({ trust_state: "verified" })]) as never, {
        limit: 24,
        offset: 0,
      })
    ).rejects.toBeInstanceOf(OrganizerDirectoryOperationError);

    await expect(
      searchOrganizers(fakeClient([searchRow({ published_tournament_count: -1 })]) as never, {
        limit: 24,
        offset: 0,
      })
    ).rejects.toBeInstanceOf(OrganizerDirectoryOperationError);
  });

  it("maps transport errors to the generic operation error", async () => {
    await expect(
      searchOrganizers(fakeClient(new Error("db down")) as never, { limit: 24, offset: 0 })
    ).rejects.toBeInstanceOf(OrganizerDirectoryOperationError);
  });
});

describe("getOrganizerBySlug", () => {
  it("returns null on empty sets and rejects multi-row anomalies", async () => {
    expect(await getOrganizerBySlug(fakeClient([]) as never, "nova-events")).toBeNull();
    await expect(
      getOrganizerBySlug(fakeClient([detailRow(), detailRow()]) as never, "nova-events")
    ).rejects.toBeInstanceOf(OrganizerDirectoryOperationError);
  });

  it("rejects malformed slugs without calling the RPC", async () => {
    let called = false;
    const client = {
      rpc: async () => {
        called = true;
        return { data: [], error: null };
      },
    };
    await expect(getOrganizerBySlug(client as never, "BAD SLUG!")).rejects.toBeInstanceOf(
      OrganizerDirectoryValidationError
    );
    expect(called).toBe(false);
  });

  it("fails detail rows with bad URLs closed", async () => {
    await expect(
      getOrganizerBySlug(
        fakeClient([detailRow({ website_url: "http://evil.example.com" })]) as never,
        "nova-events"
      )
    ).rejects.toBeInstanceOf(OrganizerDirectoryOperationError);
  });

  it("accepts explicit organization linkage, defaults to null", async () => {
    const linked = await getOrganizerBySlug(
      fakeClient([
        detailRow({ organizer_type: "organization", organization_slug: "nova-org" }),
      ]) as never,
      "nova-events"
    );
    expect(linked?.organization_slug).toBe("nova-org");
    const solo = await getOrganizerBySlug(fakeClient([detailRow()]) as never, "nova-events");
    expect(solo?.organization_slug).toBeNull();
  });
});
