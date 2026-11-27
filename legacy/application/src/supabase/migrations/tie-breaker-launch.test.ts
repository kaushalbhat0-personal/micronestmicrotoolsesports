import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20251018000001_tie_breaker_launch.sql"), "utf8");

describe("tie-breaker launch catalog — migration", () => {
  it("registers the tie-breaker tool row as active", () => {
    expect(migration).toContain("'tie-breaker'");
    expect(migration).toContain("is_active");
  });

  it("adds monthly ₹799 and yearly ₹7,990 plans with deterministic UUIDs", () => {
    expect(migration).toContain("'tie-breaker-monthly'");
    expect(migration).toContain("79900");
    expect(migration).toContain("'tie-breaker-yearly'");
    expect(migration).toContain("799000");
    expect(migration).toContain("a1b2c3d4-1234-1234-1234-000000000009");
    expect(migration).toContain("a1b2c3d4-1234-1234-1234-000000000010");
    expect(migration).toContain("select id from public.tools where slug = 'tie-breaker'");
    expect(migration).toContain("on conflict (slug) do nothing");
  });

  it("fails loudly on conflicting commercial values without touching billing machinery", () => {
    expect(migration).toContain("Conflicting values for plan tie-breaker-monthly");
    expect(migration).toContain("raise exception");
    expect(migration).not.toMatch(/complete_billing_payment|webhook|razorpay/i);
  });
});
