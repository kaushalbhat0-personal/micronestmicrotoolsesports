// P11 F-03 + queue regression tests (static SQL review + boundary pins).
// Bootstrap privilege boundaries (no functional claim path), queue
// visibility (no public reads, no reporter exposure), reviewer authorization
// (session-derived only), historical audit integrity (no cascades, append-only
// decisions). Static + simulated only.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertBootstrapAllowed,
  RECOMMENDED_BOOTSTRAP,
  REJECTED_BOOTSTRAP,
} from "../domain/bootstrap";
import { ModerationWriteDisabledError } from "../domain/report";
import { stripSqlComments } from "./sql";

const MIG_DIR = path.join(process.cwd(), "supabase/migrations");
const P9_05 = readFileSync(path.join(MIG_DIR, "20261112000005_p9_organizer_foundation.sql"), "utf8");
const P11_FILES = [
  "20261113000001_p11_f01_trust_guard.sql",
  "20261113000002_p11_f02_published_integrity.sql",
  "20261113000003_p11_moderation_queue.sql",
].map((file) => readFileSync(path.join(MIG_DIR, file), "utf8"));
const QUEUE = P11_FILES[2] as string;
const QUEUE_BODY = stripSqlComments(QUEUE);

describe("F-03 bootstrap privilege boundary (static)", () => {
  it("no P11 migration adds any policy or grant (nothing becomes writable)", () => {
    for (const sql of P11_FILES) {
      expect(sql).not.toMatch(/create policy/i);
      expect(sql).not.toMatch(/grant\s+(insert|update|select|delete|all)\b/i);
    }
  });

  it("the founding-owner insert path stays closed (P9 posture preserved)", () => {
    expect(P9_05).not.toMatch(/create policy[^;]*organizer_members[^;]*insert/i);
    expect(P9_05).toContain("revoke insert");
  });

  it("no owner-claim or admin-provisioning code path exists", () => {
    const writer = readFileSync(
      path.join(process.cwd(), "src/features/organizers/server/organizer-writer.ts"),
      "utf8"
    );
    expect(writer).not.toMatch(/\.insert\(/);
    expect(writer).not.toMatch(/claim|provision/i);
    const moderation = readFileSync(
      path.join(process.cwd(), "src/features/moderation/server/report-writer.ts"),
      "utf8"
    );
    expect(moderation).not.toMatch(/claim|provision/i);
  });

  it("recommends admin-provisioned bootstrap and rejects open self-claim", () => {
    expect(RECOMMENDED_BOOTSTRAP).toBe("admin_provisioned");
    expect(REJECTED_BOOTSTRAP).toBe("open_self_claim");
    expect(() => assertBootstrapAllowed("organizer-claim")).toThrow(ModerationWriteDisabledError);
  });

  it("no public user can mint arbitrary owner identity (no user_id input anywhere)", () => {
    for (const file of [
      "src/features/organizers/server/organizer-writer.ts",
      "src/features/moderation/server/report-writer.ts",
      "src/features/moderation/server/moderation-reader.ts",
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, `${file}: caller owner id`).not.toMatch(/owner_user_id|ownerId\s*:\s*string/);
      expect(source, `${file}: service role`).not.toContain("SERVICE_ROLE");
    }
  });
});

describe("moderation queue schema (static)", () => {
  it("covers submissions, verification reviews, and reports — nothing else", () => {
    expect(QUEUE).toContain("create table public.moderation_reports");
    expect(QUEUE).toContain("create table public.verification_cases");
    expect(QUEUE).toContain("create table public.moderation_decisions");
    expect(QUEUE).not.toMatch(/create table public\.\w*(evidence|upload|media|file|attachment)/i);
  });

  it("is default-deny: RLS on, zero policies, zero API grants", () => {
    expect(QUEUE.match(/enable row level security/gi)).toHaveLength(3);
    expect(QUEUE).not.toMatch(/create policy/i);
    for (const table of ["moderation_reports", "verification_cases", "moderation_decisions"]) {
      expect(QUEUE).toContain(`revoke all on table public.${table} from authenticated`);
      expect(QUEUE).toContain(`revoke all on table public.${table} from anon`);
    }
  });

  it("separates the queue from public projections", () => {
    // No masked-reader RPC shape (RETURNS TABLE directory/detail functions)
    // and no EXECUTE grants: the queue is invisible to anon/authenticated.
    expect(QUEUE_BODY).not.toMatch(/returns table/i);
    expect(QUEUE_BODY).not.toMatch(/create or replace function public\.(search_|get_)/i);
    expect(QUEUE_BODY).not.toMatch(/grant execute/i);
  });

  it("exposes no reporter identity path and takes no reviewer identity input", () => {
    // No RPC/helpers accept identities; reviewer columns are nullable and only
    // writable under future moderator policies (none exist yet).
    expect(QUEUE_BODY).not.toMatch(/p_reporter|p_reviewer|reviewer_id uuid not null/i);
    expect(QUEUE_BODY).toContain("reporter_id uuid null");
  });

  it("prevents duplicate/conflicting open reviews per entity", () => {
    expect(QUEUE).toContain("moderation_reports_open_entity_uidx");
    expect(QUEUE).toContain("verification_cases_open_organizer_uidx");
    expect(QUEUE).toContain("where status in ('open', 'under_review')");
    expect(QUEUE).toContain("where status in ('submitted', 'under_review')");
  });

  it("preserves historical records: append-only decisions, no cascade deletion", () => {
    expect(QUEUE).toContain("moderation_decisions is append-only");
    expect(QUEUE).toContain("trg_moderation_decisions_no_update");
    expect(QUEUE).not.toMatch(/on delete cascade/i);
    expect(QUEUE).toContain("on delete restrict");
    expect(QUEUE).toContain("on delete set null");
  });

  it("keeps evidence storage out of scope", () => {
    expect(QUEUE_BODY).not.toMatch(/evidence_url|storage|bucket|file_|upload|attachment/i);
  });

  it("hardened trigger convention for the audit guard", () => {
    expect(QUEUE).toContain("security invoker");
    expect(QUEUE).toContain("set search_path = ''");
    expect(QUEUE).toContain(
      "revoke all on function public.prevent_moderation_decision_mutation() from authenticated"
    );
  });
});

describe("cross-organizer write isolation (simulated regression)", () => {
  it("update contracts cannot move a listing between organizers", async () => {
    const { parseUpdateTournamentInput } = await import(
      "@/features/organizers/server/organizer-writer"
    );
    expect(() =>
      parseUpdateTournamentInput({
        tournamentId: "11111111-1111-4111-8111-111111111111",
        patch: {
          title: "Monsoon Showdown Cup",
          gameKey: "bgmi",
          regionCode: "india",
          format: "team",
          startsAt: "2026-12-01T10:00:00.000Z",
          endsAt: "2026-12-03T18:00:00.000Z",
          timezone: "Asia/Kolkata",
          registration: { method: "external", url: "https://events.example.com/register" },
          organizerId: "22222222-2222-4222-8222-222222222222",
        },
      })
    ).toThrow();
  });

  it("forged reviewer metadata is rejected at every intake", async () => {
    const { parseReviewReportInput, parseModerationDecisionInput } = await import(
      "../server/report-writer"
    );
    expect(() =>
      parseReviewReportInput({
        reportId: "11111111-1111-4111-8111-111111111111",
        resolution: "duplicate",
        reason: "Same listing already reported and actioned.",
        reviewerId: "22222222-2222-4222-8222-222222222222",
      })
    ).toThrow();
    expect(() =>
      parseModerationDecisionInput({
        tournamentId: "11111111-1111-4111-8111-111111111111",
        decision: "publish",
        reason: "Evidence reviewed; listing matches the organizer announcement.",
        decidedBy: "22222222-2222-4222-8222-222222222222",
        decidedAt: "2026-11-13T00:00:00.000Z",
      })
    ).toThrow();
  });
});
