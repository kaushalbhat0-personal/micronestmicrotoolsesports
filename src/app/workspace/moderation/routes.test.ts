// P10 moderation workspace route audit: disabled review-queue shell for
// reports/tournaments/organizers. P15-M2B.4 intentionally adds a separate
// super-admin BGMI ownership review surface under bgmi-ownership/.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function listRouteSources(): { path: string; content: string }[] {
  const entries: { path: string; content: string }[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === "node_modules") {
        continue;
      }
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|mts|cts)$/.test(name.name) && !/\.test\.[jt]sx?$/.test(name.name)) {
        entries.push({ path: full, content: readFileSync(full, "utf8") });
      }
    }
  };
  walk(here);
  return entries;
}

const routeSources = listRouteSources();
const p10ShellSources = routeSources.filter((s) => !s.path.includes(`${join("moderation", "bgmi-ownership")}`));
const m2b4Sources = routeSources.filter((s) => s.path.includes(`${join("moderation", "bgmi-ownership")}`));

const writerPath = join(
  here,
  "..",
  "..",
  "..",
  "features",
  "moderation",
  "server",
  "report-writer.ts",
);
const writerContent = readFileSync(writerPath, "utf8");

describe("P10 moderation workspace route audit — session-gated shell, gate-closed", () => {
  it("covers the expected moderation surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("moderation", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("reports") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("tournaments") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("organizers") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("bgmi-ownership") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("derives identity from the session: no caller-supplied user IDs", () => {
    const renderSources = p10ShellSources.filter((s) => !s.path.includes("_lib"));
    for (const { path, content } of renderSources) {
      expect(content, `${path}: caller user id`).not.toContain("user_id");
      expect(content, `${path}: caller user id`).not.toContain("userId");
    }
  });

  it("uses no service-role or elevated client in route modules", () => {
    for (const { path, content } of p10ShellSources) {
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
      expect(content, `${path}: service client`).not.toMatch(
        /createServiceClient|serviceRoleClient|getServiceClient|withServiceRole/i,
      );
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
    }
  });

  it("reads no base tables and performs no mutations", () => {
    for (const { path, content } of p10ShellSources) {
      expect(content, `${path}: base-table read`).not.toMatch(/\.from\(/);
      expect(content, `${path}: direct mutation`).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    }
  });

  it("exposes no operational review control on P10 shells (copy may name disabled decisions)", () => {
    for (const { path, content } of p10ShellSources) {
      expect(content, `${path}: button control`).not.toContain("<button");
      expect(content, `${path}: form control`).not.toContain("<form");
      expect(content, `${path}: click handler`).not.toContain("onClick");
      expect(content, `${path}: submit handler`).not.toContain("onSubmit");
      expect(content, `${path}: server action`).not.toContain('"use server"');
      expect(content, `${path}: writer call`).not.toMatch(
        /recordModerationDecisionOp|reviewReportOp|submitReportOp|submitVerificationOp|assertModeratorActionAllowed/,
      );
      expect(content, `${path}: queue call`).not.toMatch(/listQueuedReports|getQueuedReport/);
      expect(content, `${path}: rpc call`).not.toMatch(/\.rpc\(/);
      expect(content, `${path}: direct mutation`).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    }
    const boundaryPath = join(here, "_lib", "boundary.ts");
    const boundaryContent = readFileSync(boundaryPath, "utf8");
    expect(boundaryContent).toContain("MODERATION_WORKSPACE_DISABLED_MESSAGE");
    expect(boundaryContent).toContain("Nothing here can be approved");
  });

  it("keeps the moderation kill switch OFF (flipping it breaks this test by design)", () => {
    expect(writerContent).toContain("MODERATION_WRITES_ENABLED: boolean = false");
  });

  it("is never indexed or followed", () => {
    for (const { path, content } of routeSources.filter((s) => s.path.endsWith("page.tsx"))) {
      expect(content, `${path}: robots`).toContain("robots");
      expect(content, `${path}: noindex`).toContain("index: false");
    }
  });
});

describe("P15-M2B.4 BGMI ownership review surface invariants", () => {
  it("exists as an isolated super-admin review route", () => {
    expect(m2b4Sources.length).toBeGreaterThan(0);
    expect(m2b4Sources.some((s) => s.path.endsWith("actions.ts"))).toBe(true);
    expect(m2b4Sources.some((s) => s.path.endsWith("page.tsx"))).toBe(true);
  });

  it("never embeds service-role keys or direct supabase-js clients in route modules", () => {
    for (const { path, content } of m2b4Sources) {
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: createAdminClient`).not.toContain("createAdminClient");
    }
  });

  it("gates decisions through decideBgmiOwnershipCase / requireSuperAdmin path", () => {
    const actions = m2b4Sources.find((s) => s.path.endsWith("actions.ts"));
    expect(actions).toBeDefined();
    expect(actions!.content).toContain("decideBgmiOwnershipCase");
    expect(actions!.content).toContain("mintReviewerBgmiOwnershipEvidenceSignedUrl");
    expect(actions!.content).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });
});
