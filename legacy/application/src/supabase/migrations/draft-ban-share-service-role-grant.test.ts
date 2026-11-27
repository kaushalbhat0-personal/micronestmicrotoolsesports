import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const grantMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20251101000001_draft_ban_share_service_role_grant.sql"),
  "utf8",
);

/** Statements only (strip -- comments): assert on code, not prose. */
const grantCode = grantMigration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const authoritative = readFileSync(
  join(process.cwd(), "supabase/migrations/20251030000001_draft_ban_share_branding.sql"),
  "utf8",
);

const authoritativeCode = authoritative
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("draft-ban share service_role grant migration", () => {
  it("grants EXECUTE on the exact share RPC signature to service_role", () => {
    expect(grantCode).toMatch(/grant execute on function public\.get_completed_draft_share\(uuid\) to service_role/i);
  });

  it("preserves the existing anon/authenticated grant and public revoke in the authoritative migration", () => {
    expect(authoritativeCode).toMatch(/revoke all on function public\.get_completed_draft_share\(uuid\) from public/i);
    expect(authoritativeCode).toMatch(/grant execute on function public\.get_completed_draft_share\(uuid\) to anon, authenticated/i);
  });

  it("is grant-only: no function rewrite, no RLS, no public grant, no unrelated grants", () => {
    expect(grantCode).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(grantCode).not.toMatch(/alter function|drop function/i);
    expect(grantCode).not.toMatch(/create policy|drop policy|alter policy/i);
    expect(grantCode).not.toMatch(/revoke execute on function public\.get_completed_draft_share/i);
    expect(grantCode).not.toMatch(/grant execute on function public\.get_completed_draft_share\(uuid\) to public/i);
    expect(grantCode).not.toMatch(/consume_draft_ban|get_completed_tie_breaker_share/i);
  });
});
