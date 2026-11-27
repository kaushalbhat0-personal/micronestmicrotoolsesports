import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251019000001_primary_workspace.sql"),
  "utf8"
);

describe("primary workspace foundation — RCCF-MULTI-SCOPE-IMPLEMENT-01", () => {
  it("adds a nullable primary_organization_id FK with ON DELETE SET NULL", () => {
    expect(sql).toMatch(/add column if not exists primary_organization_id uuid/i);
    expect(sql).toMatch(/references public\.organizations\(id\) on delete set null/i);
    // Nullable: no NOT NULL on the added column.
    const columnBlock = /add column if not exists primary_organization_id[\s\S]*?;/i.exec(sql)?.[0] ?? "";
    expect(columnBlock).not.toMatch(/not null/i);
  });

  it("creates a lookup index without a uniqueness constraint", () => {
    expect(sql).toMatch(/create index if not exists profiles_primary_org_idx/i);
    expect(sql).not.toMatch(/unique index[\s\S]*primary_organization_id/i);
    expect(sql).not.toMatch(/add constraint[\s\S]*primary_organization_id[\s\S]*unique/i);
  });

  it("backfills deterministically without overwriting existing values", () => {
    // Owned-first, then any membership; oldest-first ordering; NULL-preserving.
    expect(sql).toMatch(/where o\.owner_id = m\.user_id/);
    expect(sql).toMatch(/order by m\.user_id, o\.created_at asc, o\.id asc/);
    const updates = sql.match(/and p\.primary_organization_id is null/g) ?? [];
    expect(updates.length).toBeGreaterThanOrEqual(2);
  });

  it("does not weaken RLS or touch authorization", () => {
    expect(sql).not.toMatch(/drop policy/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/has_tool_access/i);
    expect(sql).not.toMatch(/tool_entitlements/i);
    expect(sql).not.toMatch(/is_org_member/i);
  });

  it("introduces no Creator, Agency, Account, or is_primary concepts", () => {
    // Strip -- comments: assert on statements, not explanatory prose.
    const code = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/creator_id/i);
    expect(code).not.toMatch(/agency_id/i);
    expect(code).not.toMatch(/account_id/i);
    expect(code).not.toMatch(/is_primary/i);
    expect(code).not.toMatch(/create table/i);
  });
});
