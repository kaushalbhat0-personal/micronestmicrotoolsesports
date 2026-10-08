import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const shell = readFileSync(join(process.cwd(), "src/components/layout/dashboard-shell.tsx"), "utf8");

// Entitled operational path only (Your Tools through Explore Tools).
const entitledBlock = shell.slice(shell.indexOf("{/* YOUR TOOLS */}"), shell.indexOf("{/* EXPLORE TOOLS"));

describe("dashboard sidebar IA — RCCF-UX-SIDEBAR-IMPLEMENT-01 (static)", () => {
  it("has no CREATORS group", () => {
    expect(shell).not.toContain(">Creators<");
    expect(shell).not.toMatch(/\{label:\s*"Creators"/);
  });

  it("has no MORE TOOLS group", () => {
    expect(shell).not.toContain(">More Tools<");
  });

  it("renders no Soon badges in the entitled operational path", () => {
    expect(entitledBlock).not.toContain("Soon");
    expect(entitledBlock).not.toContain("comingSoon");
  });

  it("Explore Tools links to the current workspace billing page", () => {
    expect(shell).toContain(">Explore Tools<");
    expect(shell).toContain("Browse all tools");
    expect(shell).toContain("/settings/billing");
    expect(shell).not.toMatch(/\/dashboard\/[a-z0-9-]+\/settings\/billing/);
  });

  it("Channels and Connections render beneath Sponsorship via subItems (no separate section)", () => {
    expect(entitledBlock).not.toContain("/channels");
    expect(entitledBlock).not.toContain("/connections");
    // Sub-items come from the tool model, rendered generically.
    expect(entitledBlock).toContain("tool.subItems");
  });

  it("Settings, Billing, and Workspaces remain available", () => {
    expect(shell).toContain("/settings`");
    expect(shell).toContain("/settings/billing");
    expect(shell).toContain("/dashboard/organizations");
    expect(shell).toContain("Workspaces");
    expect(shell).toContain(">Settings<");
  });

  it("skip-to-content link targets the main landmark", () => {
    expect(shell).toContain("Skip to main content");
    expect(shell).toContain('href="#main-content"');
    expect(shell).toMatch(/<main id="main-content"/);
  });

  it("preserves aria-current, focus states, and mobile Sheet behavior", () => {
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain("focus-visible:ring-2");
    expect(shell).toContain('aria-label="Open navigation"');
    expect(shell).toContain("setMobileOpen(false)");
  });

  it("breadcrumb nests Channels and Connections under Sponsorship Tracking", () => {
    expect(shell).toContain('{ label: "Sponsorship Tracking"');
  });

  it("legacy fallback never implies tool access (no Creators, no coming-soon)", () => {
    const fallbackBlock = shell.slice(shell.indexOf("Fallback (no entitlement data"));
    expect(fallbackBlock).toContain('group.label !== "Creators"');
    expect(fallbackBlock).toContain('group.label !== "Coming soon"');
    expect(fallbackBlock).toContain("!item.comingSoon");
  });
});
