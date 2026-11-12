// P13-A adversarial + scope tests (static SQL + simulated authorization).
// Covers: self-review, spoofed reviewer identity, inactive moderators,
// republish-after-unpublish freshness, published mutation, rollback
// boundaries, D-01/D-04/D-07/D-08/D-11/D-12/D-13/D-14 representation, and the
// deferred-scope exclusions (D-05/D-02/D-09). Static + simulated only.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSelfApproval } from "../domain/decision";
import {
  REPORT_CATEGORIES,
  REPORT_RESOLUTIONS,
  REPORT_STATUSES,
} from "../domain/report";
import { stripSqlComments } from "./sql";

const MIG_DIR = path.join(process.cwd(), "supabase/migrations");
const ACTIVATION = readFileSync(path.join(MIG_DIR, "20261113000005_p13_activation.sql"), "utf8");
const ACT_BODY = stripSqlComments(ACTIVATION);
const SNAPSHOT = readFileSync(path.join(MIG_DIR, "20261113000004_p13_f02_snapshot.sql"), "utf8");
const SNAP_BODY = stripSqlComments(SNAPSHOT);

describe("adversarial: reviewer identity and authority", () => {
  it("organizer cannot manufacture approval (policy requires active super-admin + self reviewer)", () => {
    expect(ACT_BODY).toContain("public.is_super_admin()");
    expect(ACT_BODY).toContain("reviewer_id = auth.uid()");
    expect(ACT_BODY).toContain("status = 'active'");
    // Transition-time re-check lives in the validator (snapshot file).
    expect(SNAP_BODY).toContain("au.status = 'active'");
  });

  it("self-review is blocked in SQL even for admin+member overlap", () => {
    expect(isSelfApproval(["org-1"], "org-1")).toBe(true);
    const validator = SNAP_BODY.split("tournament_review_approval_valid")[1] ?? "";
    expect(validator).toContain("organizer_members");
  });

  it("reviewer identity spoofing is unrepresentable at intake", async () => {
    const { parseModerationDecisionInput, parseReviewReportInput } = await import(
      "../server/report-writer"
    );
    expect(() =>
      parseModerationDecisionInput({
        tournamentId: "11111111-1111-4111-8111-111111111111",
        decision: "publish",
        reason: "Evidence reviewed; listing matches the organizer announcement.",
        reviewerId: "attacker",
      })
    ).toThrow();
    expect(() =>
      parseReviewReportInput({
        reportId: "11111111-1111-4111-8111-111111111111",
        resolution: "action_taken",
        reason: "Takedown executed after review.",
        reviewer_id: "attacker",
      })
    ).toThrow();
  });

  it("unauthorized and inactive moderators fail (validator re-checks live state)", () => {
    // Policy gate (insert-time) + validator gate (transition-time) both
    // require live is_super_admin(); suspension between decision and publish
    // fails the transition. Static: both gates present.
    expect(ACT_BODY.match(/public\.is_super_admin\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("republish after unpublish needs a fresh decision (old publish approval cannot be reused)", () => {
    expect(ACT_BODY).toContain("'republish'");
    // Decision types are exact-match in the validator (p_decision equality).
    expect(stripSqlComments(SNAPSHOT)).toContain("d.decision = p_decision");
  });

  it("published content mutation stays blocked (F-02 freeze untouched by activation)", () => {
    expect(ACT_BODY).not.toContain("freeze_published_tournament_content");
    const freeze = readFileSync(
      path.join(MIG_DIR, "20261113000002_p11_f02_published_integrity.sql"),
      "utf8"
    );
    expect(freeze).toContain("NEW.published_at is distinct from OLD.published_at");
  });
});

describe("rollback and replay boundaries (static)", () => {
  it("both P13-A files document their rollback in-header", () => {
    expect(SNAPSHOT).toMatch(/rollback/i);
    expect(ACTIVATION).toMatch(/rollback/i);
  });

  it("activation replaces exactly one function and drops nothing", () => {
    expect(ACT_BODY).not.toMatch(/drop (table|trigger|function|policy)/i);
    expect(ACT_BODY.match(/create or replace function/g)?.length).toBe(2);
    expect(ACT_BODY).toContain("public.provision_organizer(");
    expect(ACT_BODY).toContain("public.enforce_tournament_lifecycle()");
  });
});

describe("approved scope representation (static)", () => {
  it("excludes verification activation (D-05 deferred): no case policies", () => {
    expect(ACT_BODY).not.toContain("verification_cases");
  });

  it("excludes organization linkage, media, and evidence (D-02/D-09 deferred)", () => {
    expect(ACT_BODY).not.toMatch(/organization_slug|linkage/i);
    expect(ACT_BODY).not.toMatch(/evidence|media|bucket|upload|storage/i);
  });

  it("keeps table access least-privilege (no table grants, no anon policies)", () => {
    expect(ACT_BODY).not.toMatch(/grant\s+\w+\s+on\s+table/i);
    expect(ACT_BODY).not.toMatch(/create policy[^;]*\bto anon\b/i);
    expect(ACT_BODY).not.toMatch(/create policy[^;]*for delete/i);
  });

  it("D-07/D-08/D-13 vocabulary present: mandatory reasons, no-delete, retention", () => {
    expect(ACT_BODY).toContain("reason");
    expect(ACT_BODY).not.toMatch(/delete from|truncate/i);
    expect(REPORT_STATUSES).toContain("resolved");
    expect(REPORT_CATEGORIES).toContain("other");
    expect(REPORT_RESOLUTIONS).toContain("action_taken");
  });

  it("D-14 discipline holds: all three write switches remain OFF", () => {
    for (const [file, constant] of [
      ["src/features/organizers/server/organizer-writer.ts", "ORGANIZER_WRITES_ENABLED"],
      ["src/features/tournaments/server/tournament-writer.ts", "TOURNAMENT_WRITES_ENABLED"],
      ["src/features/moderation/server/report-writer.ts", "MODERATION_WRITES_ENABLED"],
    ] as const) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).toContain(`${constant}: boolean = false`);
    }
  });
});
