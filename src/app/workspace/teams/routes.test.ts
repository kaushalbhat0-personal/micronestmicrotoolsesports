// P2 workspace static audit (mirrors the P1 teams audit).
// Reads the workspace route sources and fails if a route/component can reach
// base tables directly, use the service role, render ownership/applicant
// internals, or enable a write path. The gated server-operation layer
// (server/workspace*.ts) is audited separately: session-derived identity,
// no service role, kill switch ON. Pure static audit: no network, no client.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function listSources(sub: string): { path: string; content: string }[] {
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
  walk(join(here, sub));
  return entries;
}

// Route surface: pages, actions, lib, components under src/app/workspace
// (NOT the gated server-operation layer under src/features).
const routeSources = listSources(".").filter(
  (s) => !s.path.endsWith("routes.test.ts"),
);

const serverSources = listSources(join("..", "..", "..", "features", "teams", "server")).filter(
  (s) => s.path.endsWith("workspace.ts") || s.path.endsWith("workspace-writer.ts"),
);

describe("P2 workspace route audit — surface coverage", () => {
  it("covers the expected route surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("workspace", "teams", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes(join("[id]")) && p.endsWith(join("[id]", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("settings", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("roster", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("teams", "actions.ts")))).toBe(true);
  });
});

describe("P2 workspace route audit — no direct data path in routes/components", () => {
  it("has no raw table access in any route/component module", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      for (const table of [
        "public.teams",
        "public.team_members",
        "public.recruitment_posts",
        "public.applications",
        "public.reports",
        "public.app_users",
      ]) {
        expect(content, `${path}: base table ref ${table}`).not.toContain(table);
      }
    }
  });

  it("uses no service-role, admin client or signed-URL flow", () => {
    for (const { path, content } of [...routeSources, ...serverSources]) {
      // Usage-shaped patterns only: "never service-role" prose in security
      // comments must not trip this gate.
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
      expect(content, `${path}: service client`).not.toMatch(
        /createServiceClient|serviceRoleClient|getServiceClient|withServiceRole/i,
      );
      expect(content, `${path}: admin surface`).not.toContain("admin.");
      expect(content, `${path}: signed URLs`).not.toContain("SignedUrl");
    }
  });

  it("renders no ownership, applicant or decision internals", () => {
    // Render surface only: _lib/forms.ts legitimately forwards protected
    // keys so strict schemas REJECT them (covered by route-lib tests), and
    // actions.ts carries the disabled message. Neither renders HTML.
    const renderSources = routeSources.filter((s) => !s.path.includes("_lib"));
    for (const { path, content } of renderSources) {
      for (const token of [
        "owner_user_id",
        "created_by",
        "organization_id",
        "applicant_user_id",
        "decided_by",
        "decided_at",
      ]) {
        expect(content, `${path}: internal token ${token}`).not.toContain(token);
      }
    }
  });

  it("enables no direct table write path in routes/components", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: direct mutation`).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    }
  });

  it("re-exports gated server actions", () => {
    const actions = routeSources.find((s) => s.path.endsWith(join("teams", "actions.ts")));
    expect(actions).toBeDefined();
    expect(actions?.content).toContain("createTeamAction");
    expect(actions?.content).toContain("updateTeamSettingsAction");
    expect(actions?.content).not.toContain("owner_user_id");
  });
});

describe("P2 workspace route audit — gated server-operation layer", () => {
  it("keeps Teams writes enabled while other feature switches stay independent", () => {
    const writer = serverSources.find((s) => s.path.endsWith("workspace-writer.ts"));
    expect(writer).toBeDefined();
    expect(writer?.content).toContain("WORKSPACE_WRITES_ENABLED");
    expect(writer?.content).toContain('from "../domain/workspace"');
    const domainPath = join(process.cwd(), "src", "features", "teams", "domain", "workspace.ts");
    const domain = readFileSync(domainPath, "utf8");
    expect(domain).toContain("WORKSPACE_WRITES_ENABLED: boolean = true");
  });

  it("derives identity exclusively from the verified session", () => {
    for (const source of serverSources) {
      expect(source.content, `${source.path}: session identity`).toMatch(
        /getUser|ensureAppUser/,
      );
    }
    const writer = serverSources.find((s) => s.path.endsWith("workspace-writer.ts"))?.content ?? "";
    expect(writer).toContain("ensureAppUser");
    // No caller-supplied identity parameter anywhere in the layer.
    for (const source of serverSources) {
      expect(source.content, `${source.path}: forged identity`).not.toMatch(/userId:\s*string|user_id:\s*string\s*[,}]/);
    }
  });

  it("exposes no ownership transfer, captain assignment or org authority", () => {
    const combined = serverSources.map((s) => s.content).join("\n").toLowerCase();
    expect(combined).not.toContain("transfer");
    expect(combined).not.toContain("appoint");
    // organization_id may appear in rejection-contract comments, but never
    // as a read, write, or authority check: strip line comments first.
    for (const source of serverSources) {
      const code = source.content.replace(/^.*\/\/.*$/gm, "");
      expect(code, `${source.path}: org authority`).not.toContain("organization_id");
    }
  });
});
