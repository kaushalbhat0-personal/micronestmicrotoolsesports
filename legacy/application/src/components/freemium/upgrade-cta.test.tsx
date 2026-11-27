import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { UpgradeCTA } from "./upgrade-cta";

describe("UpgradeCTA", () => {
  it("8. renders the supplied href", () => {
    const html = renderToString(<UpgradeCTA href="/dashboard/acme/settings/billing" label="Upgrade" />);
    expect(html).toContain('href="/dashboard/acme/settings/billing"');
  });

  it("9. renders the supplied label", () => {
    const html = renderToString(<UpgradeCTA href="/pricing" label="Upgrade to Tie-Breaker" />);
    expect(html).toContain("Upgrade to Tie-Breaker");
  });

  it("10. is a natively keyboard-focusable link with an accessible name", () => {
    const html = renderToString(<UpgradeCTA href="/pricing" label="Upgrade" />);
    expect(html).toContain("<a");
    expect(html).toContain('aria-label="Upgrade"');
  });

  it("11. does not embed a hardcoded billing destination", () => {
    const html = renderToString(<UpgradeCTA href="/custom/destination" label="Upgrade" />);
    expect(html).toContain('href="/custom/destination"');
    expect(html).not.toContain("/pricing");
    expect(html).not.toContain("settings/billing");
  });
});
