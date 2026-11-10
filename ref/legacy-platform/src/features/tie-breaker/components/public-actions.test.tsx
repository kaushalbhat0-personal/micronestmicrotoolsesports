import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { CopyResultButton, PrintResultButton } from "./public-actions";
import { ShareLinkButton } from "./share-link-button";

describe("public and share actions", () => {
  it("renders copy-result with accessible confirmation status", () => {
    const html = renderToString(<CopyResultButton text="result" />);
    expect(html).toContain("Copy result");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("min-h-[44px]");
  });

  it("renders a print action", () => {
    const html = renderToString(<PrintResultButton />);
    expect(html).toContain("Print / Save PDF");
    expect(html).toContain('aria-label="Print result"');
  });

  it("renders the dashboard share-link control without exposing the token as text", () => {
    const html = renderToString(<ShareLinkButton shareToken="dddddddd-dddd-4ddd-8ddd-dddddddddddd" />);
    expect(html).toContain("Copy share link");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  });
});
