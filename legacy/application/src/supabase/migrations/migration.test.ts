import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20251001000001_sponsor_sentinel_core.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("sponsor sentinel migration", () => {
  it("creates all 7 entities", () => {
    expect(sql).toMatch(/create table if not exists public\.connected_channels/);
    expect(sql).toMatch(/create table if not exists public\.sponsor_campaigns/);
    expect(sql).toMatch(/create table if not exists public\.deliverables/);
    expect(sql).toMatch(/create table if not exists public\.evidence/);
    expect(sql).toMatch(/create table if not exists public\.evaluations/);
    expect(sql).toMatch(/create table if not exists public\.scans/);
    expect(sql).toMatch(/alter table public\.webhook_events/);
  });

  it("has correct unique constraints and foreign keys", () => {
    expect(sql).toMatch(/unique \(organization_id, platform, external_channel_id\)/);
    expect(sql).toMatch(/references public\.organizations\(id\) on delete cascade/);
    expect(sql).toMatch(/references public\.sponsor_campaigns\(id\) on delete restrict/);
    expect(sql).toMatch(/constraint deliverables_rule_is_object/);
    expect(sql).toMatch(/check \(result in \('PASS','FAIL','NOT_VERIFIABLE','PENDING','NOT_SUPPORTED'\)\)/);
  });

  it("has indexes for tenant queries", () => {
    expect(sql).toMatch(/connected_channels_org_idx/);
    expect(sql).toMatch(/sponsor_campaigns_org_idx/);
    expect(sql).toMatch(/evidence_org_idx/);
    expect(sql).toMatch(/evaluations_org_idx/);
    expect(sql).toMatch(/scans_org_idx/);
  });

  it("has deliverable org check trigger", () => {
    expect(sql).toMatch(/check_deliverable_org/);
    expect(sql).toMatch(/deliverable organization_id does not match campaign organization_id/);
  });

  it("uses ON DELETE RESTRICT for audit tables", () => {
    expect(sql).toMatch(/evidence[\s\S]*?references public\.deliverables\(id\) on delete restrict/);
    expect(sql).toMatch(/evaluations[\s\S]*?references public\.evidence\(id\) on delete restrict/);
  });

  it("enables RLS on all tenant tables", () => {
    expect(sql).toMatch(/alter table public\.connected_channels enable row level security/);
    expect(sql).toMatch(/alter table public\.sponsor_campaigns enable row level security/);
    expect(sql).toMatch(/alter table public\.deliverables enable row level security/);
    expect(sql).toMatch(/alter table public\.evidence enable row level security/);
    expect(sql).toMatch(/alter table public\.evaluations enable row level security/);
    expect(sql).toMatch(/alter table public\.scans enable row level security/);
    expect(sql).toMatch(/alter table public\.webhook_events enable row level security/);
  });

  it("creates RLS policies using is_org_member", () => {
    const matches = sql.match(/is_org_member\(organization_id\)/g) ?? [];
    expect(matches.length).toBeGreaterThan(10);
  });

  it("evidence/evaluations have no update/delete policies for authenticated (append-only)", () => {
    // Should have select+insert but not update/delete for evidence/evaluations
    expect(sql).toMatch(/evidence_select_member/);
    expect(sql).toMatch(/evidence_insert_member/);
    expect(sql).not.toMatch(/evidence_update_member/);
    expect(sql).not.toMatch(/evidence_delete_member/);
    expect(sql).toMatch(/evaluations_select_member/);
    expect(sql).toMatch(/evaluations_insert_member/);
    expect(sql).not.toMatch(/evaluations_update_member/);
  });

  it("webhook_events supports youtube/kick and organization scoping", () => {
    expect(sql).toMatch(/check \(platform in \('twitch','youtube','kick','stripe','razorpay','discord'\)\)/);
    expect(sql).toMatch(/webhook_events_provider_check/);
    expect(sql).toMatch(/webhook_events_org_idx/);
  });
});
