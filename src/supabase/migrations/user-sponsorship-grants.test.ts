import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251020000001_user_sponsorship_grants.sql"),
  "utf8"
);

// Statements only (strip -- comments) so prose cannot satisfy assertions.
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("user sponsorship grants — RCCF-MULTI-SCOPE-IMPLEMENT-02", () => {
  it("creates an explicit user-grant table keyed by user, not a mixed-scope table", () => {
    expect(code).toMatch(/create table if not exists public\.user_tool_entitlements/i);
    expect(code).toMatch(/user_id uuid not null references public\.profiles\(id\) on delete cascade/i);
    expect(code).toMatch(/tool_id uuid not null references public\.tools\(id\) on delete cascade/i);
    expect(code).not.toMatch(/organization_id/);
    expect(code).not.toMatch(/is_all_access/);
    expect(code).not.toMatch(/scope/);
  });

  it("enforces one grant row per user per tool with lookup indexes", () => {
    expect(code).toMatch(/unique\s*\(\s*user_id\s*,\s*tool_id\s*\)/i);
    expect(code).toMatch(/user_tool_entitlements_user_idx/i);
    expect(code).toMatch(/user_tool_entitlements_tool_idx/i);
  });

  it("preserves existing expiry/source conventions", () => {
    expect(code).toMatch(/expires_at timestamptz,/i);
    expect(code).toMatch(/source text not null default 'subscription' check/i);
  });

  it("grants users read-only access to their own rows and no client writes", () => {
    expect(code).toMatch(/enable row level security/i);
    expect(code).toMatch(/for select/i);
    expect(code).toMatch(/user_id = auth\.uid\(\)/i);
    expect(code).not.toMatch(/for insert/i);
    expect(code).not.toMatch(/for update/i);
    expect(code).not.toMatch(/for delete/i);
  });

  it("does not touch sponsorship data tables, org grants, or authorization", () => {
    for (const table of ["sponsor_campaigns", "deliverables", "evidence", "evaluations", "scans", "connected_channels"]) {
      expect(code).not.toContain(table);
    }
    expect(code).not.toMatch(/(?<!user_)tool_entitlements/);
    expect(code).not.toMatch(/has_tool_access/);
    expect(code).not.toMatch(/is_org_member/);
    expect(code).not.toMatch(/handle_new_organization/);
  });

  it("performs no backfill, conversion, or seeding", () => {
    expect(code).not.toMatch(/insert into/i);
    expect(code).not.toMatch(/update public/i);
  });

  it("introduces no Creator, Agency, Account, or generic scope concepts", () => {
    expect(code).not.toMatch(/creator_id/i);
    expect(code).not.toMatch(/agency_id/i);
    expect(code).not.toMatch(/account_id/i);
  });
});
