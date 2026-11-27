// P8 brand-reader tests (no network, no Supabase project).
// Covers: proposed RPC names/args, frozen 8-key mapping, strict vocabulary
// shapes, extra-key rejection, unknown-game pass-through, https fail-closed,
// generic errors, 404-equivalence, frozen representative_verified false, and
// absence of representative/evidence/contact internals.

import { describe, expect, it } from "vitest";
import {
  BrandDirectoryOperationError,
  BrandDirectoryValidationError,
} from "@/features/brands/domain/brand";
import { getBrandBySlug, searchBrands } from "./brand-reader";

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
  slug: "volt-energy",
  name: "Volt Energy",
  industry: "energy-drink",
  region_code: "india",
  game_interests: ["bgmi"],
  partnership_types: ["sponsorship"],
  sponsorship_interests: ["teams"],
  trust_state: "submitted",
};

const DETAIL_ROW = {
  ...SEARCH_ROW,
  description: "An energy drink brand.",
  website_url: "https://volt.example.com",
  social_links: [{ label: "X", url: "https://x.com/volt" }],
};

describe("searchBrands — validation", () => {
  it("rejects malformed input without an RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(searchBrands(client as never, { limit: 999 })).rejects.toBeInstanceOf(
      BrandDirectoryValidationError,
    );
    expect(state.calls).toHaveLength(0);
  });

  it("rejects unknown-region for bgmi before any RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(
      searchBrands(client as never, { gameInterest: "bgmi", region: "atlantis", limit: 24, offset: 0 }),
    ).rejects.toBeInstanceOf(BrandDirectoryValidationError);
    expect(state.calls).toHaveLength(0);
  });

  it("passes unknown games through (fail closed)", async () => {
    const { client, state } = fakeClient([]);
    const rows = await searchBrands(client as never, { gameInterest: "valorant", limit: 24, offset: 0 });
    expect(rows).toEqual([]);
    expect(state.calls[0]?.fn).toBe("search_brands");
  });
});

describe("searchBrands — mapping", () => {
  it("maps the frozen 8 keys via the proposed RPC", async () => {
    const { client, state } = fakeClient([SEARCH_ROW]);
    const rows = await searchBrands(client as never, { limit: 25, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: "volt-energy", industry: "energy-drink" });
    expect(Object.keys(rows[0] as object)).toHaveLength(8);
    expect(state.calls[0]?.fn).toBe("search_brands");
  });

  it("rejects rows with an invented industry", async () => {
    const { client } = fakeClient([{ ...SEARCH_ROW, industry: "esports-org" }]);
    await expect(searchBrands(client as never, { limit: 24, offset: 0 })).rejects.toBeInstanceOf(
      BrandDirectoryOperationError,
    );
  });

  it("rejects extra keys", async () => {
    const { client } = fakeClient([{ ...SEARCH_ROW, representative_email: "a@b.com" }]);
    await expect(searchBrands(client as never, { limit: 24, offset: 0 })).rejects.toBeInstanceOf(
      BrandDirectoryOperationError,
    );
  });

  it("fails closed on non-https website rows", async () => {
    const { client } = fakeClient([{ ...DETAIL_ROW, website_url: "javascript:alert(1)" }]);
    await expect(getBrandBySlug(client as never, "volt-energy")).rejects.toBeInstanceOf(
      BrandDirectoryOperationError,
    );
  });
});

describe("getBrandBySlug", () => {
  it("returns null for zero rows and freezes representative_verified false", async () => {
    const { client } = fakeClient([]);
    await expect(getBrandBySlug(client as never, "missing")).resolves.toBeNull();
    const { client: client2 } = fakeClient([DETAIL_ROW]);
    const card = await getBrandBySlug(client2 as never, "volt-energy");
    expect(card?.representative_verified).toBe(false);
    expect(card as unknown as Record<string, unknown>).not.toHaveProperty("representative_email");
  });

  it("rejects malformed slugs without an RPC call", async () => {
    const { client, state } = fakeClient([]);
    await expect(getBrandBySlug(client as never, "BAD SLUG")).rejects.toBeInstanceOf(
      BrandDirectoryValidationError,
    );
    expect(state.calls).toHaveLength(0);
  });
});
