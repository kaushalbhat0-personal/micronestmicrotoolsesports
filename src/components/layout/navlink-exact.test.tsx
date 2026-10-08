import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { NavLink } from "./dashboard-shell";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useParams: () => ({}), usePathname: () => "/" };
});

describe("NavLink exact matching (Settings/Billing)", () => {
  it("12. Settings is NOT active on the Billing route", () => {
    const html = renderToString(
      <NavLink href={"/dashboard/acme/settings" as never} icon="Settings2" label="Settings" pathname="/dashboard/acme/settings/billing" onNavigate={() => {}} exact />
    );
    expect(html).not.toContain('aria-current="page"');
  });

  it("13. Billing IS active on the Billing route", () => {
    const html = renderToString(
      <NavLink href={"/dashboard/acme/settings/billing" as never} icon="CreditCard" label="Billing" pathname="/dashboard/acme/settings/billing" onNavigate={() => {}} />
    );
    expect(html).toContain('aria-current="page"');
  });

  it("14. Settings remains active on the Settings route itself", () => {
    const html = renderToString(
      <NavLink href={"/dashboard/acme/settings" as never} icon="Settings2" label="Settings" pathname="/dashboard/acme/settings" onNavigate={() => {}} exact />
    );
    expect(html).toContain('aria-current="page"');
  });

  it("non-exact links keep prefix matching for nested tool routes", () => {
    const html = renderToString(
      <NavLink href={"/dashboard/acme/sponsor-sentinel/campaigns" as never} icon="ShieldCheck" label="Campaigns" pathname="/dashboard/acme/sponsor-sentinel/campaigns/abc" onNavigate={() => {}} />
    );
    expect(html).toContain('aria-current="page"');
  });

  it("unrelated route is not active", () => {
    const html = renderToString(
      <NavLink href={"/dashboard/acme/settings/billing" as never} icon="CreditCard" label="Billing" pathname="/dashboard/acme/channels" onNavigate={() => {}} />
    );
    expect(html).not.toContain('aria-current="page"');
  });
});
