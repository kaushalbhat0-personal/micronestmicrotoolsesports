import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteHeaderShell } from "./site-header-shell";

describe("SiteHeaderShell — P14-D10 navigation (anonymous vs authenticated)", () => {
  it("anonymous desktop shows grouped Discover plus Log in / Sign up, no account menu", () => {
    const html = renderToStaticMarkup(<SiteHeaderShell signedIn={false} />);
    expect(html).toContain("Discover");
    expect(html).toContain('href="/players"');
    expect(html).toContain('href="/tournaments"');
    expect(html).toContain('href="/news"');
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
    expect(html).not.toContain("Account");
    expect(html).not.toContain("/settings/profile");
    expect(html).not.toContain("Sign out");
    // Grouped hierarchy: brand + discover menu + auth, single row containers.
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('aria-controls="discover-menu"');
  });

  it("authenticated desktop shows Workspace + Account, no redundant signup/login", () => {
    const html = renderToStaticMarkup(<SiteHeaderShell signedIn={true} />);
    expect(html).toContain("Workspace");
    expect(html).toContain("Account");
    expect(html).toContain('href="/workspace/teams"');
    expect(html).not.toContain('href="/signup"');
    expect(html).not.toContain('href="/login"');
  });

  it("mobile panel exposes stacked nav and touch-friendly auth actions", () => {
    const anon = renderToStaticMarkup(<SiteHeaderShell signedIn={false} />);
    expect(anon).toContain('aria-label="Mobile"');
    expect(anon).toContain('aria-controls="primary-menu"');
    expect(anon).toContain("Sign up");
    expect(anon).toContain("Log in");
    const authed = renderToStaticMarkup(<SiteHeaderShell signedIn={true} />);
    expect(authed).toContain("Team workspace");
    expect(authed).toContain("Profile settings");
    expect(authed).toContain("Sign out");
  });

  it("keeps Competitive Arena treatment and no horizontal-overflow primitives", () => {
    const html = renderToStaticMarkup(<SiteHeaderShell signedIn={false} />);
    expect(html).toContain("bg-arena-950");
    expect(html).toContain("bg-accent-600");
    // Sharp geometry: no rounded-full pills in header chrome.
    expect(html).not.toContain("rounded-full");
    expect(html).not.toContain("Opportunities");
  });
});
