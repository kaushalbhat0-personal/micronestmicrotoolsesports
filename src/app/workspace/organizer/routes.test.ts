// P9 workspace organizer route audit: workspace data-path + write-gate audit.
// Public organizer routes stay reader-only (see src/app/organizers/routes.test.ts).
// Workspace routes are session-bound: they may read the caller's own rows
// through base-table RLS (organizers/organizer_members/tournaments) but must
// never touch the service role, never accept caller-supplied user IDs, never
// expose other users' identity, and never enable writes while the kill
// switch is OFF. Pure static audit: no network, no Supabase client.

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

const routeSources = listRouteSources().filter((s) => !s.path.endsWith("routes.test.ts"));

const writerPath = join(
  here,
  "..",
  "..",
  "..",
  "features",
  "organizers",
  "server",
  "organizer-writer.ts"
);
const writerContent = readFileSync(writerPath, "utf8");

describe("P9 organizer workspace route audit — session-bound, gate-closed", () => {
  it("covers the expected workspace surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("organizer", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("tournaments", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("new") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("edit") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("derives identity from the session: no caller-supplied user IDs", () => {
    // Render surface only: _lib/forms.ts legitimately forwards protected
    // keys so strict schemas REJECT them (covered by schema tests), and
    // actions.ts carries the disabled message. Neither renders HTML.
    const renderSources = routeSources.filter((s) => !s.path.includes("_lib"));
    for (const { path, content } of renderSources) {
      expect(content, `${path}: caller user id`).not.toContain("user_id");
      expect(content, `${path}: caller user id`).not.toContain("userId");
    }
    const actionsPath = join(here, "actions.ts");
    const actionsContent = readFileSync(actionsPath, "utf8");
    expect(actionsContent).toContain("auth.getUser");
    expect(actionsContent).not.toContain("user_id");
    expect(actionsContent).not.toContain("userId");
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

  it("returns the disabled boundary message: no fake success", () => {
    const actionsPath = join(here, "actions.ts");
    const actionsContent = readFileSync(actionsPath, "utf8");
    const boundaryPath = join(here, "_lib", "boundary.ts");
    const boundaryContent = readFileSync(boundaryPath, "utf8");
    expect(boundaryContent).toContain("ORGANIZER_WORKSPACE_DISABLED_MESSAGE");
    expect(boundaryContent).toContain("Nothing was saved");
    expect(actionsContent).toContain("ORGANIZER_WORKSPACE_DISABLED_MESSAGE");
    expect(actionsContent).not.toContain(".insert(");
    expect(actionsContent).not.toContain(".update(");
    expect(actionsContent).not.toContain(".delete(");
    expect(actionsContent).not.toContain(".upsert(");
  });

  it("keeps the organizer publishing kill switch OFF (flipping it breaks this test by design)", () => {
    expect(writerContent).toContain("ORGANIZER_WRITES_ENABLED: boolean = false");
  });

  it("exposes no verification self-approval or ownership assignment surface", () => {
    // No form control may assign trust/verification/ownership, and no route
    // may write those columns. Read-display of the caller's own basis
    // (role) is permitted.
    for (const { path, content } of routeSources) {
      expect(content, `${path}: trust control`).not.toContain('name="trust');
      expect(content, `${path}: verification approve`).not.toMatch(/approv.*verif|verif.*approv/i);
      expect(content, `${path}: direct mutation`).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    }
  });
});
