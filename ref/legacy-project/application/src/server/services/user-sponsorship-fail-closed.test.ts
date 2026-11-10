import { describe, expect, it, vi } from "vitest";
import { hasUserSponsorshipAccess, getUserSponsorshipGrant } from "./user-sponsorship-service";

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000).toISOString();

function clientFor(opts: { toolsData?: unknown; grant?: unknown; grantError?: unknown }) {
  return {
    from: vi.fn((table: string) => {
      if (table === "tools") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: opts.toolsData ?? { id: TOOL_ID }, error: null }) }) }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (opts.grantError) throw opts.grantError;
                return { data: opts.grant ?? null, error: null };
              },
            }),
          }),
        }),
      };
    }),
  };
}

describe("user sponsorship grant — missing Phase-2 table fails closed", () => {
  it("missing user_tool_entitlements table (42P01) → deny without raw DB error", async () => {
    const pgErr = { code: "42P01", message: 'relation "public.user_tool_entitlements" does not exist' };
    const c = clientFor({ grantError: pgErr });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(false);
    await expect(getUserSponsorshipGrant(c as never, "u1")).resolves.toBeNull();
  });

  it("PostgREST schema-cache miss (PGRST205) → deny without raw DB error", async () => {
    const pgErr = { code: "PGRST205", message: "Could not find the table 'public.user_tool_entitlements' in the schema cache" };
    const c = clientFor({ grantError: pgErr });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(false);
  });

  it("valid grant still allows access (no regression)", async () => {
    const c = clientFor({ grant: { id: "g1", expires_at: FUTURE } });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(true);
  });

  it("unrelated database failure is NOT swallowed — rethrows", async () => {
    const c = clientFor({ grantError: new Error("connection refused") });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).rejects.toThrow("connection refused");
    await expect(getUserSponsorshipGrant(c as never, "u1")).rejects.toThrow("connection refused");
  });

  it("missing-table error on a DIFFERENT table is not treated as fail-closed", async () => {
    const c = clientFor({ grantError: { code: "42P01", message: 'relation "public.campaigns" does not exist' } });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).rejects.toThrow();
  });
});
