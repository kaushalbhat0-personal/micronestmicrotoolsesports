// P8 organization-reader tests (no network, no Supabase project).
// Fake client implements only the `rpc` surface the reader uses.
// Covers: proposed RPC names/args, frozen 7-key mapping, strict shapes,
// extra-key rejection, unknown-game fail-closed pass-through, bgmi region
// rejection pre-RPC, https URL fail-closed, generic errors, 404-equivalence,
// and absence of owner/representative/evidence internals in every card.

import { describe, expect, it } from "vitest";
import {
  OrganizationDirectoryOperationError,
  OrganizationDirectoryValidationError,
} from "@/features/organizations/domain/organization";
import { getOrganizationBySlug, searchOrganizations } from "./organization-reader";

function fakeClient(data: unknown, error: { message: string } | null = null) {
  const state: { data: unknown; error: { message: string } | null; calls: Array<{ fn: string; args: Record<string, unknown> }> } = {
    data,
    error,
    calls: [],
  };
  return {
    state,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        state.calls.push({ fn, args });
        return { data: state.data, error: state.error };
      },
    },
  };
}

const SEARCH_ROW = {
  slug: "nova-org",
  name: "Nova Organization",
  region_code: "india",
  org_type: "professional",
  game_keys: ["bgmi"],
  trust_state: "submitted",
  team_count: 3,
};

const DETAIL_ROW = {
  ...SEARCH_ROW,
  description: "A competitive organization.",
  website_url: "https://nova.example.com",
  social_links: [{ label: "X", url: "https://x.com/nova" }],
};

describe("searchOrganizations — validation", () => {
  it("rejects malformed input without an RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(searchOrganizations(client as never, { limit: 999 })).rejects.toBeInstanceOf(
      OrganizationDirectoryValidationError,
    );
    expect(state.calls).toHaveLength(0);
  });

  it("rejects unknown-region for bgmi before any RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(
      searchOrganizations(client as never, { game: "bgmi", region: "atlantis", limit: 24, offset: 0 }),
    ).rejects.toBeInstanceOf(OrganizationDirectoryValidationError);
    expect(state.calls).toHaveLength(0);
  });

  it("passes unknown games through (fail closed to zero rows)", async () => {
    const { client, state } = fakeClient([]);
    const rows = await searchOrganizations(client as never, {
      game: "valorant",
      limit: 24,
      offset: 0,
    });
    expect(rows).toEqual([]);
    expect(state.calls[0]?.fn).toBe("search_organizations");
  });
});

describe("searchOrganizations — mapping", () => {
  it("maps the frozen 7 keys and calls the proposed RPC with clamped args", async () => {
    const { client, state } = fakeClient([SEARCH_ROW]);
    const rows = await searchOrganizations(client as never, { limit: 25, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: "nova-org", org_type: "professional", team_count: 3 });
    expect(state.calls[0]?.fn).toBe("search_organizations");
    expect(state.calls[0]?.args).toMatchObject({ p_limit: 25, p_offset: 0 });
    expect(Object.keys(rows[0] as object)).toHaveLength(7);
  });

  it("rejects extra keys (strict key-set)", async () => {
    const { client } = fakeClient([{ ...SEARCH_ROW, owner_user_id: "x" }]);
    await expect(searchOrganizations(client as never, { limit: 24, offset: 0 })).rejects.toBeInstanceOf(
      OrganizationDirectoryOperationError,
    );
  });

  it("fails closed on http website rows in detail", async () => {
    const { client } = fakeClient([{ ...DETAIL_ROW, website_url: "http://evil.example.com" }]);
    await expect(getOrganizationBySlug(client as never, "nova-org")).rejects.toBeInstanceOf(
      OrganizationDirectoryOperationError,
    );
  });

  it("maps transport errors to generic operation errors", async () => {
    const { client } = fakeClient(null, { message: "function does not exist" });
    await expect(searchOrganizations(client as never, { limit: 24, offset: 0 })).rejects.toBeInstanceOf(
      OrganizationDirectoryOperationError,
    );
  });
});

describe("getOrganizationBySlug", () => {
  it("returns null for zero rows (404-equivalence)", async () => {
    const { client } = fakeClient([]);
    await expect(getOrganizationBySlug(client as never, "missing-org")).resolves.toBeNull();
  });

  it("rejects malformed slugs without an RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(getOrganizationBySlug(client as never, "BAD SLUG")).rejects.toBeInstanceOf(
      OrganizationDirectoryValidationError,
    );
    expect(state.calls).toHaveLength(0);
  });

  it("never forwards owner/representative internals", async () => {
    const { client } = fakeClient([DETAIL_ROW]);
    const card = await getOrganizationBySlug(client as never, "nova-org");
    expect(card).not.toBeNull();
    expect(card as unknown as Record<string, unknown>).not.toHaveProperty("owner_user_id");
    expect(card as unknown as Record<string, unknown>).not.toHaveProperty("evidence");
  });
});
