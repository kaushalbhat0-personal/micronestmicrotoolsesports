import { describe, it, expect } from "vitest";
import { resolveEntitlements, canAccessTool } from "./entitlement-service";
import { hasEntitlement } from "@/server/repositories/entitlements";

function mockSupabase(overrides: Record<string, unknown>) {
  return overrides as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("entitlement provisioning regression — RCCF-SENTINEL-12B", () => {
  it("new organization provisioned with sponsor-sentinel resolves as entitled", async () => {
    // Simulates DB state after handle_new_organization trigger inserts per-tool entitlement
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ is_all_access: false, tool_id: "tool-sentinel-id", expires_at: null, tool: { slug: "sponsor-sentinel" } }],
                error: null,
              }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: "tool-sentinel-id", slug: "sponsor-sentinel" }], error: null }) }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
      rpc: (fn: string) => {
        if (fn === "has_tool_access") return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: null, error: { message: "unknown" } });
      },
    } as never);

    const result = await resolveEntitlements(supabase, "new-org-id");
    expect(result.entitledToolSlugs).toContain("sponsor-sentinel");
    expect(result.hasAllAccess).toBe(false);

    const has = await canAccessTool(supabase, "new-org-id", "sponsor-sentinel");
    expect(has).toBe(true);

    const hasViaRepo = await hasEntitlement(supabase, "new-org-id", "sponsor-sentinel");
    expect(hasViaRepo).toBe(true);
  });

  it("new organization without entitlement correctly denies sponsor-sentinel", async () => {
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: "tool-sentinel-id", slug: "sponsor-sentinel" }], error: null }) }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
      rpc: (fn: string) => {
        if (fn === "has_tool_access") return Promise.resolve({ data: false, error: null });
        return Promise.resolve({ data: null, error: { message: "unknown" } });
      },
    } as never);

    const result = await resolveEntitlements(supabase, "org-no-entitlement");
    expect(result.entitledToolSlugs).not.toContain("sponsor-sentinel");
    const has = await canAccessTool(supabase, "org-no-entitlement", "sponsor-sentinel");
    expect(has).toBe(false);
  });

  it("dashboard and server guard derive from same entitlement source", async () => {
    // Simulates consistency check: both getAccessibleToolSlugs and has_tool_access agree
    const supabase = mockSupabase({
      from: (table: string) => {
        if (table === "tool_entitlements") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ is_all_access: false, tool_id: "tool-sentinel-id", expires_at: null, tool: { slug: "sponsor-sentinel" } }],
                error: null,
              }),
            }),
          };
        }
        if (table === "tools") {
          return {
            select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: "tool-sentinel-id", slug: "sponsor-sentinel" }], error: null }) }) }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
      rpc: (fn: string) => {
        if (fn === "has_tool_access") return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: null, error: { message: "unknown" } });
      },
    } as never);

    const slugs = (await resolveEntitlements(supabase, "org-consistency")).entitledToolSlugs;
    const has = await hasEntitlement(supabase, "org-consistency", "sponsor-sentinel");
    // Dashboard uses slugs.includes, server guard uses has_tool_access — must agree
    expect(slugs.includes("sponsor-sentinel")).toBe(has);
    expect(has).toBe(true);
  });
});
