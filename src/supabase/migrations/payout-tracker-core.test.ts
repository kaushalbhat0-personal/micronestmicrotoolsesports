import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20251103000001_payout_tracker_core.sql"), "utf8");

describe("payout-tracker core — migration", () => {
  it("creates exactly the two V1 domain tables with RLS enabled", () => {
    expect(migration).toContain("create table if not exists public.payout_trackers");
    expect(migration).toContain("create table if not exists public.payout_recipients");
    expect(migration).toContain("alter table public.payout_trackers enable row level security");
    expect(migration).toContain("alter table public.payout_recipients enable row level security");
    expect(migration).not.toMatch(/dispute_status|verification_status|payment_method|bank_account|player_id|team_id|notification/i);
  });

  it("stores only the last-4 reference, never a full UTR column", () => {
    expect(migration).toContain("reference_last4");
    expect(migration).toContain("^[A-Za-z0-9]{4}$");
    // No column definition for a full reference (comments may discuss UTR policy).
    expect(migration).not.toMatch(/reference_full|full_reference|reference\s+text|\butr\s+text/i);
  });

  it("stores money as integer minor units with currency allowlist", () => {
    expect(migration).toContain("amount_minor bigint");
    expect(migration).toContain("currency in ('INR', 'USD', 'EUR', 'GBP')");
    expect(migration).not.toMatch(/numeric\(|double precision| real[ ,)]/i);
  });

  it("constrains proof URLs to https at the database boundary", () => {
    expect(migration).toContain("proof_url like 'https://%'");
  });

  it("scopes tenant policies through is_org_member, recipients via parent tracker", () => {
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).toContain("payout_recipients_select_member");
    expect(migration).toContain("payout_recipients_insert_member");
    expect(migration).toContain("payout_recipients_update_member");
    expect(migration).toContain("payout_recipients_delete_member");
    expect(migration).toMatch(/from public\.payout_trackers t/);
  });

  it("guards status and share_token transitions behind RPC markers", () => {
    expect(migration).toContain("payout_tracker.authorized_transition");
    expect(migration).toContain("payout_tracker.authorized_rotation");
    expect(migration).toContain("PTPK01");
  });

  it("publishes atomically with a permanent monthly ledger quota", () => {
    expect(migration).toContain("consume_payout_tracker_publish");
    expect(migration).toContain("payout_tracker_monthly_publishes_pkey");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("PTPQ01");
    expect(migration).toContain("grant execute on function public.consume_payout_tracker_publish(uuid, uuid, uuid) to service_role");
  });

  it("derives completion atomically with the recipient-status mutation", () => {
    expect(migration).toContain("apply_payout_recipient_status");
    expect(migration).toContain("refresh_payout_tracker_status");
    expect(migration).toContain("rotate_payout_tracker_token");
  });

  it("exposes a narrow allowlisted public share function, never raw rows", () => {
    expect(migration).toContain("get_published_payout_tracker");
    expect(migration).toContain("jsonb_build_object");
    expect(migration).not.toMatch(/row_to_json/i);
    expect(migration).not.toMatch(/select \* from public\.payout/i);
    expect(migration).toContain("grant execute on function public.get_published_payout_tracker(uuid) to anon, authenticated, service_role");
    // Allowlist must never expose internal identifiers or membership/billing
    // data as JSON keys (the join condition itself is not exposed).
    const shareFn = migration.slice(migration.indexOf("get_published_payout_tracker(p_token uuid)"));
    expect(shareFn).not.toContain("'organization_id'");
    expect(shareFn).not.toContain("'created_by'");
    expect(shareFn).not.toContain("'tracker_id'");
    expect(shareFn).not.toContain("row_to_json");
  });
});
