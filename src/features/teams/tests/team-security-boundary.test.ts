// P14-D3 team security boundary — STATIC SQL-text tests (no live PostgreSQL).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const MIG_ADMIN = readFileSync(
  path.join(root, "supabase/migrations/20261112000002_p14_admin_superadmin_active_gate.sql"),
  "utf8",
);
const MIG_TEAMS = readFileSync(
  path.join(root, "supabase/migrations/20261114000001_p14_teams_foundation.sql"),
  "utf8",
);
const MIG_MEMBERS = readFileSync(
  path.join(root, "supabase/migrations/20261114000002_p14_team_members.sql"),
  "utf8",
);
const MIG_AUDIT = readFileSync(
  path.join(root, "supabase/migrations/20261114000003_p14_team_audit_events.sql"),
  "utf8",
);
const MIG_PUBLIC = readFileSync(
  path.join(root, "supabase/migrations/20261114000004_p14_team_public_rpcs.sql"),
  "utf8",
);
const MIG_MUTATION = readFileSync(
  path.join(root, "supabase/migrations/20261114000005_p14_team_mutation_rpcs.sql"),
  "utf8",
);

function escapeLikeLiteral(input: string): string {
  return input
    .slice(0, 120)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

describe("A6 archival — historical D1 teams files stay out of active chain", () => {
  it("does not keep archived D1 teams SQL in supabase/migrations", () => {
    expect(existsSync(path.join(root, "supabase/migrations/20261112000002_d1_teams_discovery.sql"))).toBe(
      false,
    );
    expect(
      existsSync(path.join(root, "supabase/migrations/20261112000003_d1_security_remediation.sql")),
    ).toBe(false);
    expect(
      existsSync(path.join(root, "supabase/migrations/20261112000004_d1_insert_boundary_indexes.sql")),
    ).toBe(false);
  });
});

describe("F-A01 re-homed is_super_admin active gate", () => {
  it("joins platform_admins to active app_users", () => {
    expect(MIG_ADMIN).toContain("join public.app_users as au on au.id = pa.user_id");
    expect(MIG_ADMIN).toContain("au.status = 'active'");
  });
});

describe("teams immutable columns (A2/A4)", () => {
  it("guards owner/slug/game/created_by/organization_id", () => {
    expect(MIG_TEAMS).toContain("enforce_teams_immutable_columns");
    for (const col of ["owner_user_id", "created_by", "game_key", "slug", "organization_id"]) {
      expect(MIG_TEAMS).toContain(`NEW.${col} is distinct from OLD.${col}`);
    }
  });
  it("revokes client DML on teams before helpers grant select", () => {
    expect(MIG_TEAMS.toLowerCase()).toContain("revoke all on table public.teams from authenticated");
  });
});

describe("membership helpers and RLS (A1/A3)", () => {
  it("defines owner / active-member / captain helpers with empty search_path", () => {
    expect(MIG_MEMBERS).toContain("is_team_owner");
    expect(MIG_MEMBERS).toContain("is_team_active_member");
    expect(MIG_MEMBERS).toContain("is_team_captain");
    expect(MIG_MEMBERS).toContain("set search_path = ''");
    expect(MIG_MEMBERS).toContain("role = 'captain'");
    expect(MIG_MEMBERS).not.toContain("role = 'co_captain'");
  });
  it("denies client DML on team_members", () => {
    expect(MIG_MEMBERS.toLowerCase()).toContain(
      "revoke all on table public.team_members from authenticated",
    );
    expect(MIG_MEMBERS.toLowerCase()).not.toMatch(
      /grant\s+(insert|update|delete)\s+on\s+table\s+public\.team_members/,
    );
  });
});

describe("audit append-only", () => {
  it("blocks update/delete on team_audit_events", () => {
    expect(MIG_AUDIT).toContain("prevent_team_audit_mutation");
    expect(MIG_AUDIT).toContain("team_audit_events is append-only");
    expect(MIG_AUDIT.toLowerCase()).toContain(
      "revoke all on table public.team_audit_events from authenticated",
    );
  });
});

describe("public RPCs privacy (A3)", () => {
  it("masks projection and counts active members only", () => {
    expect(MIG_PUBLIC).toContain("membership_status = 'active'");
    expect(MIG_PUBLIC).toContain("lifecycle_status = 'active'");
    expect(MIG_PUBLIC.toLowerCase()).not.toContain("owner_user_id");
    expect(MIG_PUBLIC).toContain("escape '\\'");
  });
  it("LIKE escape reference matches SQL chain", () => {
    expect(escapeLikeLiteral("a%_b\\c")).toBe("a\\%\\_b\\\\c");
  });
});

describe("mutation RPCs (A1/A4/A5)", () => {
  it("create_team requires active account, verified email, captain seed, audit", () => {
    expect(MIG_MUTATION).toContain("email_confirmed_at is not null");
    expect(MIG_MUTATION).toContain("au.status = 'active'");
    expect(MIG_MUTATION).toContain("'captain'");
    expect(MIG_MUTATION).toContain("'active'");
    expect(MIG_MUTATION).toContain("team.created");
    expect(MIG_MUTATION.toLowerCase()).not.toContain("transfer_team");
    expect(MIG_MUTATION.toLowerCase()).not.toContain("transfer_owner");
  });
  it("update_team_settings uses is_team_captain and audits", () => {
    expect(MIG_MUTATION).toContain("is_team_captain(p_team_id)");
    expect(MIG_MUTATION).toContain("team.settings_updated");
  });
  it("does not invent deferred membership admin RPCs", () => {
    expect(MIG_MUTATION.toLowerCase()).not.toContain("create function public.leave_team");
    expect(MIG_MUTATION.toLowerCase()).not.toContain("create function public.remove_team_member");
    expect(MIG_MUTATION.toLowerCase()).not.toContain("create function public.appoint_captain");
  });
});

describe("deferred applications stay out of P14 foundation", () => {
  it("does not create applications or recruitment_posts tables", () => {
    const combined = [MIG_TEAMS, MIG_MEMBERS, MIG_AUDIT, MIG_PUBLIC, MIG_MUTATION].join("\n");
    expect(combined.toLowerCase()).not.toContain("create table public.applications");
    expect(combined.toLowerCase()).not.toContain("create table public.recruitment_posts");
  });
});
