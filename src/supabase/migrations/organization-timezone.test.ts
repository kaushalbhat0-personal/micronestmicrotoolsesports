import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251026000001_organization_timezone.sql"),
  "utf8",
);

describe("organization timezone prerequisite — RCCF-FREEMIUM-PLATFORM-IMPLEMENT-06", () => {
  it("adds organizations.timezone TEXT NOT NULL DEFAULT Asia/Kolkata", () => {
    expect(sql).toMatch(/alter table public\.organizations[\s\S]*?add column if not exists timezone text not null default 'Asia\/Kolkata'/i);
  });

  it("backfills existing organizations without overwriting valid values", () => {
    expect(sql).toMatch(/update public\.organizations/i);
    expect(sql).toMatch(/set timezone = 'Asia\/Kolkata'/i);
    expect(sql).toMatch(/where timezone is null/i);
  });

  it("enforces valid IANA identifiers via the authoritative Postgres catalog", () => {
    expect(sql).toMatch(/pg_timezone_names/i);
    expect(sql).toMatch(/organizations_timezone_valid_iana/i);
    expect(sql).toMatch(/check \(public\.is_valid_iana_timezone\(timezone\)\)/i);
  });

  it("does not invent a static timezone list", () => {
    expect(sql).not.toMatch(/America\/New_York/);
    expect(sql).not.toMatch(/Europe\/London/);
  });

  it("creates no index merely because the column exists", () => {
    expect(sql).not.toMatch(/create index/i);
  });

  it("leaves organization identity, memberships, and entitlements untouched", () => {
    const code = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/delete from/i);
    expect(code).not.toMatch(/drop column/i);
    expect(code).not.toMatch(/organization_members/i);
    expect(code).not.toMatch(/tool_entitlements/i);
    expect(code).not.toMatch(/user_tool_entitlements/i);
    expect(code).not.toMatch(/sponsor/i);
    expect(code).not.toMatch(/tie_breaker/i);
    expect(code).not.toMatch(/draft_/i);
    expect(code).not.toMatch(/prize/i);
    expect(code).not.toMatch(/plans/i);
    expect(code).not.toMatch(/orders/i);
    expect(code).not.toMatch(/payments/i);
  });

  it("does not weaken RLS or add client write policies", () => {
    expect(sql).not.toMatch(/drop policy/i);
    expect(sql).not.toMatch(/create policy/i);
  });

  it("does not touch Sponsorship UTC quota behavior", () => {
    // Strip -- comments: assert on statements, not explanatory prose
    // (the header documents that Sponsorship stays UTC-based).
    const code = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/consume_free_check/i);
    expect(code).not.toMatch(/sponsor_free_check/i);
    expect(code).not.toMatch(/create index[\s\S]*scans/i);
    expect(code).not.toMatch(/alter table public\.scans/i);
  });
});
