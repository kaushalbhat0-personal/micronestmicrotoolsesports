import { describe, expect, it, vi } from "vitest";
import { getPlanContext } from "./plan-context";

function mockSupabase(plans: Array<{ slug: string; currency: string; is_active: boolean; name: string; amount_minor: number; billing_period: string }>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: plans, error: null })),
        })),
      })),
    })),
  } as never;
}

describe("plan context — server-validated purchase intent", () => {
  it("resolves an active INR plan by slug", async () => {
    const supabase = mockSupabase([
      { slug: "draft-ban-monthly", currency: "INR", is_active: true, name: "Draft & Ban - Monthly", amount_minor: 79900, billing_period: "monthly" },
    ]);
    const ctx = await getPlanContext(supabase, "draft-ban-monthly");
    expect(ctx?.name).toBe("Draft & Ban - Monthly");
    expect(ctx?.amountMinor).toBe(79900);
  });

  it("returns null for unknown, inactive, or non-INR plans", async () => {
    const supabase = mockSupabase([
      { slug: "draft-ban-monthly", currency: "INR", is_active: false, name: "x", amount_minor: 1, billing_period: "monthly" },
    ]);
    expect(await getPlanContext(supabase, "draft-ban-monthly")).toBeNull();
    expect(await getPlanContext(supabase, "no-such-plan")).toBeNull();
    expect(await getPlanContext(supabase, null)).toBeNull();
    expect(await getPlanContext(supabase, undefined)).toBeNull();
  });

  it("returns null when the catalog is unreachable (normal signup continues)", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => {
              throw new Error("db down");
            }),
          })),
        })),
      })),
    } as never;
    expect(await getPlanContext(supabase, "draft-ban-monthly")).toBeNull();
  });
});
