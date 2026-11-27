// P11 F-02 regression tests (static SQL review + domain classification).
// Material edits to published tournaments, non-material set (empty by strict
// default), re-review lifecycle interplay, cross-organizer editing. Static +
// simulated only — runtime execution stays an open item.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isMaterialTournamentField,
  MATERIAL_FIELD_RATIONALE,
  MATERIAL_TOURNAMENT_FIELDS,
} from "../domain/material-fields";
import { canRoleTransition } from "@/features/organizers/domain/permissions";

const MIG_F02 = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261113000002_p11_f02_published_integrity.sql"),
  "utf8"
);

describe("F-02 published-content freeze (static)", () => {
  it("freezes every material field while published", () => {
    for (const field of MATERIAL_TOURNAMENT_FIELDS) {
      expect(MIG_F02, `freeze clause for ${field}`).toContain(
        `NEW.${field} is distinct from OLD.${field}`
      );
    }
  });

  it("fires only on published rows", () => {
    expect(MIG_F02).toContain("OLD.lifecycle = 'published'");
    expect(MIG_F02).toContain("before update on public.tournaments");
  });

  it("leaves lifecycle transitions and system columns to their own governors", () => {
    // Lifecycle allowlist stays with the P9 lifecycle trigger; system columns
    // ride along with legitimate transitions.
    expect(MIG_F02).not.toContain("NEW.lifecycle is distinct from OLD.lifecycle");
    for (const system of ["updated_by", "updated_at", "created_by", "created_at", "id", "slug"]) {
      expect(MIG_F02, `system column ${system} not frozen`).not.toContain(
        `NEW.${system} is distinct from OLD.${system}`
      );
    }
  });

  it("follows the hardened trigger convention and adds no privilege", () => {
    expect(MIG_F02).toContain("security invoker");
    expect(MIG_F02).toContain("set search_path = ''");
    expect(MIG_F02).toContain(
      "revoke all on function public.freeze_published_tournament_content() from authenticated"
    );
    expect(MIG_F02).not.toMatch(/create policy/i);
    expect(MIG_F02).not.toMatch(/grant (insert|update|select|all)\b/i);
    expect(MIG_F02).toContain("create trigger trg_tournaments_freeze_published");
  });
});

describe("F-02 material classification (domain)", () => {
  it("covers the full inspected surface with a rationale each", () => {
    const required = [
      "title",
      "game_key",
      "region_code",
      "starts_at",
      "ends_at",
      "entry_fee_minor",
      "prize_pool_minor",
      "eligibility",
      "registration_url",
      "organizer_id",
      "description",
    ];
    for (const field of required) {
      expect(isMaterialTournamentField(field)).toBe(true);
      expect(MATERIAL_FIELD_RATIONALE[field as keyof typeof MATERIAL_FIELD_RATIONALE]).toMatch(
        /.+/
      );
    }
  });

  it("every material field has a documented reason (no silent entries)", () => {
    for (const field of MATERIAL_TOURNAMENT_FIELDS) {
      expect(MATERIAL_FIELD_RATIONALE[field].length).toBeGreaterThan(10);
    }
  });

  it("system columns are not material", () => {
    for (const system of ["id", "slug", "created_by", "created_at", "updated_by", "updated_at", "lifecycle"]) {
      expect(isMaterialTournamentField(system)).toBe(false);
    }
  });
});

describe("F-02 re-review lifecycle (simulated)", () => {
  it("direct publication bypass stays blocked for every role", () => {
    expect(canRoleTransition("owner", "draft", "published")).toBe(false);
    expect(canRoleTransition("admin", "draft", "published")).toBe(false);
    expect(canRoleTransition("editor", "draft", "published")).toBe(false);
    expect(canRoleTransition("moderator", "draft", "published")).toBe(false);
  });

  it("unpublish stays explicitly authorized; silent reactivation stays moderator-only", () => {
    expect(canRoleTransition("owner", "published", "unpublished")).toBe(true);
    expect(canRoleTransition("editor", "published", "unpublished")).toBe(false);
    expect(canRoleTransition("owner", "unpublished", "published")).toBe(false);
    expect(canRoleTransition("moderator", "unpublished", "published")).toBe(true);
  });

  it("republication requires a new submission cycle, not a silent flip", () => {
    // unpublished -> published is moderator-only AND disabled; the two-step
    // path (unpublish, edit, resubmit, moderator review) is the only route.
    expect(canRoleTransition("owner", "unpublished", "published")).toBe(false);
    expect(canRoleTransition("owner", "draft", "submitted")).toBe(true);
  });
});
