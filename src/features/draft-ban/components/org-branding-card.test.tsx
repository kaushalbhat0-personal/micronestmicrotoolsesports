import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { OrgBrandingCard } from "./org-branding-card";

const LOGO = "https://cdn.example/logo.png";

function card(props: Partial<React.ComponentProps<typeof OrgBrandingCard>> = {}) {
  return renderToString(
    <OrgBrandingCard orgSlug="acme" orgName="Acme Esports" logoUrl={LOGO} canManage={false} brandingEnabled={false} {...props} />,
  );
}

describe("OrgBrandingCard paid-only copy", () => {
  it("free card with a stored logo never claims it appears on official results", () => {
    const html = card({ brandingEnabled: false });
    expect(html).not.toContain("Logo shown on official results");
    expect(html).not.toContain("Your name and logo appear on every official draft record");
    // Stored-asset honesty without implying breakage: initials + upgrade path.
    expect(html).toContain("Logo stored");
    expect(html).toContain("workspace initials");
    expect(html).toContain("Upgrade to show your logo");
    expect(html).toContain("Acme Esports");
  });

  it("free card without a logo keeps the existing empty-state copy", () => {
    const html = card({ brandingEnabled: false, logoUrl: null });
    expect(html).toContain("No logo yet");
    expect(html).not.toContain("Logo shown on official results");
  });

  it("paid card retains the positive branding message", () => {
    const html = card({ brandingEnabled: true });
    expect(html).toContain("Logo shown on official results");
    expect(html).toContain("Your name and logo appear on every official draft record");
  });

  it("paid card without a logo keeps the empty-state copy", () => {
    const html = card({ brandingEnabled: true, logoUrl: null });
    expect(html).toContain("No logo yet");
  });

  it("derives branding presentation from props only — no entitlement logic in the component", () => {
    const source = readFileSync(join(process.cwd(), "src/features/draft-ban/components/org-branding-card.tsx"), "utf8");
    expect(source).not.toMatch(/resolveDraftBanAccessLevel|resolveToolAccessLevel|getToolFreePolicy/);
    expect(source).not.toMatch(/tool_entitlements|from\("organizations"\)/);
    expect(source).toMatch(/brandingEnabled/);
  });
});
