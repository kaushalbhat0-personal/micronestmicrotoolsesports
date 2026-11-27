import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20251105000001_payout_tracker_sqlstate.sql"), "utf8");

// Only the live definitions (function bodies); the header documents the
// old→new mapping for reviewers, so old-code absence is scoped here.
const liveDefinitions = migration.slice(migration.indexOf("create or replace function"));

const EXPECTED_FUNCTIONS = [
  "public.payout_tracker_require_authorized_transition()",
  "public.payout_tracker_require_draft_insert()",
  "public.payout_recipient_require_authorized_status()",
  "public.payout_recipient_require_pending_insert()",
  "public.consume_payout_tracker_publish(",
  "public.apply_payout_recipient_status(",
  "public.refresh_payout_tracker_status(",
  "public.rotate_payout_tracker_token(",
  "public.create_payout_recipient(",
];

describe("payout-tracker SQLSTATE compatibility — migration (F7)", () => {
  it("re-issues every live payout function that raises", () => {
    for (const fn of EXPECTED_FUNCTIONS) {
      expect(migration).toContain(`create or replace function ${fn}`);
    }
    // Privilege grants travel with the re-issued RPCs.
    expect(migration).toContain(
      "grant execute on function public.consume_payout_tracker_publish(uuid, uuid, uuid) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.create_payout_recipient(uuid, uuid, uuid, text, bigint, text, text) to service_role",
    );
  });

  it("uses exactly five-character replacement codes at every raise site", () => {
    for (const code of ["PTPQ1", "PTPN1", "PTPD1", "PTPK1"] as const) {
      expect(code).toHaveLength(5);
      expect(liveDefinitions).toContain(`errcode = '${code}'`);
    }
    // Every errcode literal in the live definitions is exactly five chars.
    const literals = [...liveDefinitions.matchAll(/errcode = '([^']+)'/g)].map((m) => m[1] as string);
    expect(literals.length).toBeGreaterThan(20);
    for (const literal of literals) {
      expect(literal).toHaveLength(5);
    }
  });

  it("leaves no six-character code in the live definitions", () => {
    for (const old of ["PTPQ01", "PTPN01", "PTPD01", "PTPK01"] as const) {
      expect(liveDefinitions).not.toContain(old);
    }
  });

  it("preserves each semantic at its expected site", () => {
    expect(migration).toContain("using errcode = 'PTPQ1'");
    expect(migration).toContain("quota_exceeded: monthly free payout-tracker budget exhausted");
    expect(migration).toContain("recipient_limit: tracker already holds the maximum recipients for this plan");
    expect(migration).toMatch(/recipient_limit: tracker already holds the maximum recipients for this plan' using errcode = 'PTPD1'/);
    expect(migration).toContain("must go through the official publish operation' using errcode = 'PTPK1'");
    expect(migration).toContain("must be created as drafts; publish through the official publish operation' using errcode = 'PTPK1'");
  });

  it("changes no logic: guards, locks, caps, and grants are intact", () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('payout_tracker_recipients:'");
    expect(migration).toContain("pg_advisory_xact_lock(");
    expect(migration).toContain("v_max := 200");
    expect(migration).toContain("v_max := 20");
    expect(migration).toContain("payout_tracker.authorized_transition");
    expect(migration).toContain("payout_tracker.authorized_recipient_status");
    expect(migration).toContain("payout_tracker.authorized_rotation");
    // No schema changes sneak in with the code fix.
    expect(migration).not.toMatch(/create table/i);
    expect(migration).not.toMatch(/alter table/i);
    expect(migration).not.toMatch(/create policy/i);
  });
});
