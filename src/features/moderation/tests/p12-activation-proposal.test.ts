// P12 activation-proposal gate tests (static document review).
// Asserts the proposal DDL honors every prohibition, the approval record is
// blank, no migration file was created, and no operational surface was added.
// Nothing here executes SQL or approves anything.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripSqlComments } from "./sql";

const DOC_DIR = path.join(process.cwd(), "docs/product-development/P12-owner-authorization");
const PROPOSAL = readFileSync(path.join(DOC_DIR, "activation-migration-proposal.md"), "utf8");
const RECORD = readFileSync(path.join(DOC_DIR, "owner-approval-record.md"), "utf8");

function extractSqlBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const re = /```sql\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    blocks.push(stripSqlComments(match[1] as string));
  }
  return blocks;
}

const SQL_BLOCKS = extractSqlBlocks(PROPOSAL);
const SQL = SQL_BLOCKS.join("\n");

describe("activation proposal shape", () => {
  it("contains exactly the §2–§4 DDL blocks (function, policies, lifecycle)", () => {
    expect(SQL_BLOCKS).toHaveLength(3);
    expect(SQL).toContain("provision_organizer");
    expect(SQL).toContain("moderation_reports reporter insert");
    expect(SQL).toContain("verification_cases owner insert");
    expect(SQL).toContain("moderation_decisions moderator insert");
    expect(SQL).toContain("create or replace function public.enforce_tournament_lifecycle()");
  });

  it("grants nothing to API roles on any table", () => {
    expect(SQL).not.toMatch(/grant\s+\w+\s+on\s+(table|public\.(moderation_|verification_|organizers|organizer_|tournaments|app_users|admin_))/i);
    expect(SQL).toContain("grant execute on function public.provision_organizer");
  });

  it("adds no self-confirmation, bypass, weakening, exposure, or cross-org path", () => {
    expect(SQL).not.toMatch(/service_role/i);
    expect(SQL).toContain("not public.is_super_admin()");
    expect(SQL).toContain("publishing a submitted tournament requires approved moderator authority");
    // F-02 freeze list is referenced by nothing here: no narrowing possible.
    expect(SQL).not.toContain("freeze_published_tournament_content");
    expect(SQL).not.toMatch(/drop (trigger|function|table|policy)/i);
    expect(SQL).not.toMatch(/evidence_url|bucket|upload|attachment/i);
    expect(SQL).not.toMatch(/create or replace function public\.(search_|get_)/i);
  });

  it("keeps draft-to-published closed for every role", () => {
    expect(SQL).toContain("tournament lifecycle transition %");
    expect(SQL).not.toMatch(/OLD\.lifecycle = 'draft' and NEW\.lifecycle = 'published'[\s\S]{0,200}?return NEW/);
  });

  it("every queue policy is gated (moderator check or session membership)", () => {
    const policies = SQL.match(/create policy "[^"]+"\n[^;]+?;/gi) ?? [];
    expect(policies.length).toBe(9);
    for (const policy of policies) {
      expect(policy).toMatch(/is_super_admin\(\)|auth\.uid\(\)/);
    }
    expect(SQL).not.toMatch(/create policy[^;]*\bto anon\b/i);
  });
});

describe("approval record reflects P13-A owner decisions", () => {
  it("records 10 approvals, 1 in-principle, 3 deferrals, 0 unapproved lines", () => {
    const lines = RECORD.split("\n").filter((line) => /^\| D-\d+/.test(line));
    expect(lines).toHaveLength(14);
    expect(lines.filter((line) => line.includes("| APPROVED |")).length).toBe(10);
    expect(lines.filter((line) => line.includes("APPROVED IN PRINCIPLE")).length).toBe(1);
    expect(lines.filter((line) => line.includes("| DEFERRED |")).length).toBe(3);
    expect(lines.some((line) => line.includes("UNAPPROVED"))).toBe(false);
  });

  it("defers verification, media/evidence, and professional badge (D-05/D-09/D-03)", () => {
    for (const id of ["D-03", "D-05", "D-09"]) {
      const line = RECORD.split("\n").find((l) => l.startsWith(`| ${id} `));
      expect(line).toContain("DEFERRED");
    }
  });

  it("qualifies D-06: no blind reset or data destruction", () => {
    const line = RECORD.split("\n").find((l) => l.startsWith("| D-06 "));
    expect(line).toContain("NOT permission to blindly reset or destroy data");
  });
});

describe("P12 added no implementation surface", () => {
  it("created no migration file", () => {
    const files = readdirSync(path.join(process.cwd(), "supabase/migrations"));
    expect(files.some((file) => /p12/i.test(file))).toBe(false);
  });

  it("added no operational moderator surface (no actions, no new routes)", () => {
    const root = path.join(process.cwd(), "src/app/workspace/moderation");
    const stack: string[] = [root];
    const seen: string[] = [];
    while (stack.length > 0) {
      const dir = stack.pop() as string;
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          stack.push(full);
        } else {
          seen.push(full);
        }
      }
    }
    expect(seen.some((file) => file.endsWith("actions.ts"))).toBe(false);
    for (const file of seen.filter((f) => !f.endsWith(".test.ts"))) {
      expect(readFileSync(file, "utf8")).not.toContain('"use server"');
    }
  });

  it("keeps all three write switches OFF", () => {
    const organizer = readFileSync(
      path.join(process.cwd(), "src/features/organizers/server/organizer-writer.ts"),
      "utf8"
    );
    const tournament = readFileSync(
      path.join(process.cwd(), "src/features/tournaments/server/tournament-writer.ts"),
      "utf8"
    );
    const moderation = readFileSync(
      path.join(process.cwd(), "src/features/moderation/server/report-writer.ts"),
      "utf8"
    );
    expect(organizer).toContain("ORGANIZER_WRITES_ENABLED: boolean = false");
    expect(tournament).toContain("TOURNAMENT_WRITES_ENABLED: boolean = false");
    expect(moderation).toContain("MODERATION_WRITES_ENABLED: boolean = false");
  });
});
