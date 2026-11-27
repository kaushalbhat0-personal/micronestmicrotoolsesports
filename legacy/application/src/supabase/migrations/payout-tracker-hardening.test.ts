import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20251104000001_payout_tracker_hardening.sql"), "utf8");
const core = readFileSync(join(process.cwd(), "supabase/migrations/20251103000001_payout_tracker_core.sql"), "utf8");

describe("payout-tracker hardening — migration (F1/F2/F3/F4)", () => {
  it("leaves the historical core + launch migrations untouched", () => {
    expect(core).not.toContain("payout_tracker_require_draft_insert");
    expect(core).not.toContain("payout_recipient_require_authorized_status");
    expect(core).not.toContain("create_payout_recipient");
    expect(core).not.toContain("::date");
  });

  it("F1: guards tracker inserts to draft-only via a BEFORE INSERT trigger", () => {
    expect(migration).toContain("create or replace function public.payout_tracker_require_draft_insert()");
    expect(migration).toContain("before insert on public.payout_trackers");
    expect(migration).toContain("payout_trackers_draft_insert");
    expect(migration).toContain("NEW.status <> 'draft'");
    expect(migration).toContain("NEW.published_at is not null or NEW.completed_at is not null");
    expect(migration).toContain("PTPK01");
    // Normal draft creation (no status supplied, no timestamps) passes the guard.
    expect(migration).toContain("return NEW;");
  });

  it("F2: rejects direct recipient status/paid_at writes without the RPC marker", () => {
    expect(migration).toContain("create or replace function public.payout_recipient_require_authorized_status()");
    expect(migration).toContain("before update of status, paid_at on public.payout_recipients");
    expect(migration).toContain("payout_recipients_status_guard");
    expect(migration).toContain("payout_tracker.authorized_recipient_status");
    expect(migration).toContain("PTPK01");
    // Recipient rows always enter pending (insert path, no marker needed).
    expect(migration).toContain("before insert on public.payout_recipients");
    expect(migration).toContain("payout_recipients_pending_insert");
  });

  it("F2: the atomic status RPC sets the marker and keeps the derivation", () => {
    expect(migration).toContain("perform set_config('payout_tracker.authorized_recipient_status', 'on', true);");
    const applyFn = migration.slice(migration.indexOf("create or replace function public.apply_payout_recipient_status("));
    expect(applyFn).toContain("for update");
    expect(applyFn).toContain("set status = 'completed'");
    expect(applyFn).toContain("set status = 'published'");
    expect(applyFn).toContain("grant execute on function public.apply_payout_recipient_status(uuid, uuid, uuid, text, uuid) to service_role");
  });

  it("F3: creates recipients atomically behind a tracker-scoped advisory lock", () => {
    expect(migration).toContain("create or replace function public.create_payout_recipient(");
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('payout_tracker_recipients:'");
    expect(migration).toContain("v_max := 200");
    expect(migration).toContain("v_max := 20");
    expect(migration).toContain("recipient_limit");
    expect(migration).toContain("PTPD01");
    // Same paid/free discriminator as the publish RPC (paid sources + free grant).
    expect(migration).toContain("te.source in ('subscription', 'manual', 'promo')");
    expect(migration).toContain("te.source = 'free'");
    // Membership + ownership + tool-active checks stay inside the RPC.
    expect(migration).toContain("user is not a member of organization");
    expect(migration).toContain("tracker not found in this workspace");
    // Service-role only: no direct REST invocation.
    expect(migration).toContain("grant execute on function public.create_payout_recipient(uuid, uuid, uuid, text, bigint, text, text) to service_role");
    expect(migration).toContain("revoke all on function public.create_payout_recipient(uuid, uuid, uuid, text, bigint, text, text) from public, anon, authenticated");
    // Live trackers refresh published/completed in the same transaction.
    const createFn = migration.slice(migration.indexOf("create or replace function public.create_payout_recipient("));
    expect(createFn).toContain("authorized_transition");
  });

  it("F4: public share exposes day-granular dates, never timestamptz precision", () => {
    const shareFn = migration.slice(migration.indexOf("create or replace function public.get_published_payout_tracker(p_token uuid)"));
    expect(shareFn).toContain("(t.deadline::date)");
    expect(shareFn).toContain("(t.published_at::date)");
    expect(shareFn).toContain("(t.completed_at::date)");
    expect(shareFn).toContain("(t.updated_at::date)");
    expect(shareFn).toContain("(r.paid_at::date)");
    // No raw timestamp columns leak through the allowlist.
    expect(shareFn).not.toMatch(/'deadline', t\.deadline,/);
    expect(shareFn).not.toMatch(/'paid_at', r\.paid_at,/);
    expect(shareFn).not.toContain("row_to_json");
    // Same public grant as before (anon + authenticated + service_role).
    expect(shareFn).toContain("to anon, authenticated, service_role");
  });
});
