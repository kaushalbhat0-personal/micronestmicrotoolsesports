import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { OrgBadge } from "./org-branding";

describe("OrgBadge", () => {
  it("renders initials when no logo is available", () => {
    const html = renderToString(<OrgBadge name="Acme Esports" logoUrl={null} />);
    expect(html).toContain("AE");
    expect(html).toContain('aria-label="Acme Esports initials"');
  });

  it("renders the locked snapshot logo over https", () => {
    const html = renderToString(<OrgBadge name="Acme Esports" logoUrl="https://example.com/logo.png" />);
    expect(html).toContain('src="https://example.com/logo.png"');
    expect(html).toContain('alt="Acme Esports logo"');
  });

  it("refuses non-https logo URLs and falls back to initials", () => {
    const html = renderToString(<OrgBadge name="Acme Esports" logoUrl="javascript:alert(1)" />);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("AE");
  });
});
