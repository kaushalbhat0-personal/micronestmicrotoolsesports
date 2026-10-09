import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { FreeUsageLine } from "./free-usage-line";

// React SSR emits `<!-- -->` separators between interpolated expressions.
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "");
}

describe("FreeUsageLine", () => {
  it("4. renders current usage", () => {
    const html = textOf(renderToString(<FreeUsageLine used={2} limit={3} label="official records" />));
    expect(html).toContain("2 of 3 official records");
  });

  it("5. renders the limit", () => {
    const html = textOf(renderToString(<FreeUsageLine used={0} limit={10} label="widgets" />));
    expect(html).toContain("0 of 10 widgets");
  });

  it("6. renders a custom unit label", () => {
    const html = textOf(renderToString(<FreeUsageLine used={1} limit={1} label="official result" />));
    expect(html).toContain("1 of 1 official result");
  });

  it("7. does not assume Sponsorship terminology", () => {
    const html = renderToString(<FreeUsageLine used={2} limit={3} label="official records" />);
    for (const term of ["check", "campaign", "channel", "Sponsorship", "sponsor-sentinel"]) {
      expect(html).not.toContain(term);
    }
  });
});
