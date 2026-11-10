import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { shouldTriggerNavigationProgress } from "./navigation-progress";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const CURRENT = "http://localhost:3000/contact";

function anchor(overrides: { target?: string | null; download?: string | null; ariaDisabled?: string | null } = {}) {
  return { target: null, download: null, ariaDisabled: null, ...overrides };
}

describe("navigation progress trigger logic", () => {
  it("triggers for genuine internal navigations", () => {
    for (const href of ["/", "/tools", "/tools/sponsor-sentinel", "/pricing", "/meta-parser", "/meta-parser/valorant", "/login", "/signup", "/dashboard/acme", "/dashboard/acme/settings/billing"]) {
      expect(shouldTriggerNavigationProgress(href, anchor(), CURRENT), href).toBe(true);
    }
  });

  it("triggers for query changes (e.g. billing ?plan=)", () => {
    expect(shouldTriggerNavigationProgress("/dashboard/acme/settings/billing?plan=x", anchor(), "http://localhost:3000/dashboard/acme/settings/billing")).toBe(true);
  });

  it("excludes external, mailto, tel, downloads, hash-only, new tabs, modifiers, same-URL", () => {
    // external
    expect(shouldTriggerNavigationProgress("https://example.com/x", anchor(), CURRENT)).toBe(false);
    expect(shouldTriggerNavigationProgress("//example.com/x", anchor(), CURRENT)).toBe(false);
    expect(shouldTriggerNavigationProgress("http://other.test/y", anchor(), CURRENT)).toBe(false);
    // schemes
    expect(shouldTriggerNavigationProgress("mailto:a@b.com", anchor(), CURRENT)).toBe(false);
    expect(shouldTriggerNavigationProgress("tel:+911234", anchor(), CURRENT)).toBe(false);
    expect(shouldTriggerNavigationProgress("javascript:void(0)", anchor(), CURRENT)).toBe(false);
    // downloads
    expect(shouldTriggerNavigationProgress("/file.pdf", anchor({ download: "" }), CURRENT)).toBe(false);
    // hash-only
    expect(shouldTriggerNavigationProgress("#section", anchor(), CURRENT)).toBe(false);
    expect(shouldTriggerNavigationProgress("/tools#section", anchor(), "http://localhost:3000/tools")).toBe(false);
    // new tabs / windows
    expect(shouldTriggerNavigationProgress("/pricing", anchor({ target: "_blank" }), CURRENT)).toBe(false);
    // modifier keys / non-left click
    expect(shouldTriggerNavigationProgress("/pricing", anchor(), CURRENT, { button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false);
    expect(shouldTriggerNavigationProgress("/pricing", anchor(), CURRENT, { button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false);
    // disabled
    expect(shouldTriggerNavigationProgress("/pricing", anchor({ ariaDisabled: "true" }), CURRENT)).toBe(false);
    // same-URL no-op
    expect(shouldTriggerNavigationProgress("/contact", anchor(), CURRENT)).toBe(false);
    expect(shouldTriggerNavigationProgress(null, anchor(), CURRENT)).toBe(false);
  });
});

describe("navigation progress mount + implementation (RCCF-PLATFORM-NAV-LOADING-08)", () => {
  it("mounts exactly once in the root layout", () => {
    const root = src("src/app/layout.tsx");
    expect(root).toContain("NavigationProgress");
    expect(root.match(/<NavigationProgress/g)).toHaveLength(1);
  });

  it("does not duplicate the mount in dashboard-shell", () => {
    const shell = src("src/components/layout/dashboard-shell.tsx");
    expect(shell).not.toContain("<NavigationProgress");
  });

  it("uses one delegated document listener and no heavy client machinery", () => {
    const code = src("src/components/ui/navigation-progress.tsx");
    expect(code).toContain('document.addEventListener("click"');
    expect(code.match(/addEventListener/g)?.length).toBeLessThanOrEqual(2);
    for (const banned of ["IntersectionObserver", "requestAnimationFrame", "addEventListener(\"scroll\"", "setInterval("]) {
      expect(code, `${banned} must not exist`).not.toContain(banned);
    }
  });

  it("preserves reduced-motion protection and accessible progressbar semantics", () => {
    const code = src("src/components/ui/navigation-progress.tsx");
    expect(code).toContain("prefers-reduced-motion");
    expect(code).toContain('role="progressbar"');
    expect(code).toContain('aria-label="Navigating"');
  });

  it("preserves dashboard shell behavior (aria-current, mobile auto-close, Sheet)", () => {
    const shell = src("src/components/layout/dashboard-shell.tsx");
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain("setMobileOpen(false)");
    expect(shell).toContain("useEffect(() => {");
    expect(shell).toContain("Sheet");
  });

  it("adds no new dependencies", () => {
    const code = src("src/components/ui/navigation-progress.tsx");
    expect(code).not.toMatch(/from "(framer-motion|gsap|nprogress|next-nprogress-bar)/);
  });
});

describe("billing loading skeleton", () => {
  it("exists alongside the real billing page and reuses the Skeleton primitive", () => {
    expect(existsSync(join(process.cwd(), "src/app/(dashboard)/dashboard/[orgSlug]/settings/billing/loading.tsx"))).toBe(true);
    const code = src("src/app/(dashboard)/dashboard/[orgSlug]/settings/billing/loading.tsx");
    expect(code).toContain("Skeleton");
    expect(code).toContain("@/components/ui/loading-state");
    for (const banned of ["Razorpay", "checkout.js", "useState", "percentage"]) {
      expect(code, `${banned} must not exist`).not.toContain(banned);
    }
  });

  it("renders structural regions non-interactively with status semantics", () => {
    // Source-level render contract: node-env vitest uses the classic JSX
    // transform, so importing Skeleton-based components for renderToString
    // fails on the shared primitive (which relies on the automatic runtime,
    // as do most repo components). Assert the rendered contract statically.
    const code = src("src/app/(dashboard)/dashboard/[orgSlug]/settings/billing/loading.tsx");
    expect(code).toContain('role="status"');
    expect(code).toContain('aria-label="Loading billing"');
    expect(code).toContain("sr-only");
    expect(code).toContain("Loading billing…");
    expect(code).not.toContain("<button");
    expect(code).not.toContain("<a ");
    expect(code).not.toContain("role=\"alert\"");
  });

  it("covers the major billing regions (tools, plan, renewal, history)", () => {
    const code = src("src/app/(dashboard)/dashboard/[orgSlug]/settings/billing/loading.tsx").toLowerCase();
    for (const region of ["your tools", "available tools", "current plan", "renewal", "billing history"]) {
      expect(code, `must cover ${region}`).toContain(region);
    }
  });
});
