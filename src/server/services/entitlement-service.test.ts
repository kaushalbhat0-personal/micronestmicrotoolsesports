import { describe, it, expect } from "vitest";
import { resolveEntitlements } from "./entitlement-service";

// Minimal mock Supabase client for unit tests
function mockSupabase(overrides: Record<string, unknown>) {
  return overrides as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("resolveEntitlements", () => {
  it("returns all tools when has all-access", async () => {
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ is_all_access: true, tool_id: null, expires_at: null, tool: null }], error: null }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: "1", slug: "sponsor-sentinel" }, { id: "2", slug: "prize-splitter" }], error: null }) }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
    });

    const result = await resolveEntitlements(supabase, "org-1");
    expect(result.hasAllAccess).toBe(true);
    expect(result.entitledToolSlugs).toContain("sponsor-sentinel");
  });

  it("returns per-tool slugs when no all-access", async () => {
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { is_all_access: false, tool_id: "1", expires_at: null, tool: { slug: "sponsor-sentinel" } },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [{ id: "1", slug: "sponsor-sentinel" }, { id: "2", slug: "prize-splitter" }], error: null }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
    });

    const result = await resolveEntitlements(supabase, "org-2");
    expect(result.hasAllAccess).toBe(false);
    expect(result.entitledToolSlugs).toEqual(["sponsor-sentinel"]);
  });

  it("excludes expired entitlements", async () => {
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ is_all_access: false, tool_id: "1", expires_at: "2000-01-01T00:00:00Z", tool: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: "1", slug: "sponsor-sentinel" }], error: null }) }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
    });

    const result = await resolveEntitlements(supabase, "org-3");
    expect(result.entitledToolSlugs).toEqual([]);
  });

  it("all-access precedence overrides per-tool (expired per-tool ignored)", async () => {
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { is_all_access: true, tool_id: null, expires_at: null, tool: null },
                  { is_all_access: false, tool_id: "1", expires_at: "2000-01-01T00:00:00Z", tool: null },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: "1", slug: "sponsor-sentinel" }, { id: "2", slug: "prize-splitter" }], error: null }) }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
    });

    const result = await resolveEntitlements(supabase, "org-4");
    expect(result.hasAllAccess).toBe(true);
    expect(result.entitledToolSlugs).toHaveLength(2);
  });

  it("ignores inactive tool entitlements via tools filter", async () => {
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ is_all_access: false, tool_id: "inactive-id", expires_at: null, tool: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: [{ id: "1", slug: "sponsor-sentinel" }], error: null }) }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
    });

    const result = await resolveEntitlements(supabase, "org-5");
    expect(result.entitledToolSlugs).toEqual([]);
  });
});
