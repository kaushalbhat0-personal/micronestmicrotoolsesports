// P10 moderation workspace route audit: disabled review-queue shell.
// These routes are session-gated presentation only: they may confirm a
// verified session, but must never touch the service role, never read base
// tables or queue rows, never accept caller-supplied user IDs, never expose
// an approve/return/publish/archive action, and never enable writes while the
// moderation kill switch is OFF. Pure static audit: no network, no client.

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

const writerPath = join(
  here,
  "..",
  "..",
  "..",
  "features",
  "moderation",
  "server",
  "report-writer.ts"
);
const writerContent = readFileSync(writerPath, "utf8");

describe("P10 moderation workspace route audit — session-gated shell, gate-closed", () => {
  it("covers the expected moderation surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("moderation", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("reports") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("tournaments") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("organizers") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("derives identity from the session: no caller-supplied user IDs", () => {
    const renderSources = routeSources.filter((s) => !s.path.includes("_lib"));
    for (const { path, content } of renderSources) {
      expect(content, `${path}: caller user id`).not.toContain("user_id");
      expect(content, `${path}: caller user id`).not.toContain("userId");
    }
  });

  it("uses no service-role or elevated client in route modules", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
      expect(content, `${path}: service client`).not.toMatch(
        /createServiceClient|serviceRoleClient|getServiceClient|withServiceRole/i
      );
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
    }
  });

  it("reads no base tables and performs no mutations", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: base-table read`).not.toMatch(/\.from\(/);
      expect(content, `${path}: direct mutation`).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    }
  });

  it("exposes no operational review control (copy may name the disabled decisions)", () => {
    // Pages honestly DESCRIBE what moderators will do once approved; what is
    // forbidden is any control that performs it: no buttons, no forms, no
    // server actions, no writer/queue calls.
    for (const { path, content } of routeSources) {
      expect(content, `${path}: button control`).not.toContain("<button");
      expect(content, `${path}: form control`).not.toContain("<form");
      expect(content, `${path}: click handler`).not.toContain("onClick");
      expect(content, `${path}: submit handler`).not.toContain("onSubmit");
      expect(content, `${path}: server action`).not.toContain('"use server"');
      expect(content, `${path}: writer call`).not.toMatch(
        /recordModerationDecisionOp|reviewReportOp|submitReportOp|submitVerificationOp|assertModeratorActionAllowed/
      );
      expect(content, `${path}: queue call`).not.toMatch(/listQueuedReports|getQueuedReport/);
      expect(content, `${path}: rpc call`).not.toMatch(/\.rpc\(/);
      expect(content, `${path}: direct mutation`).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    }
    // The shell honestly names the disabled decisions in copy only: pages may
    // describe what moderators WILL do, but no control may perform it.
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
