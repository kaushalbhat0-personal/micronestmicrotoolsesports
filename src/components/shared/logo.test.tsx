import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Logo } from "./logo";

describe("Logo — brand presence", () => {
  it("linked Logo has accessible home label and href", () => {
    const html = renderToString(<Logo height={32} href="/" />);
    expect(html).toContain('aria-label="MicroNest home"');
    expect(html).toContain('href="/"');
    expect(html).toContain('alt="MicroNest"');
  });

  it("non-linked Logo (hero) does not become a link", () => {
    const html = renderToString(<Logo height={88} href="" />);
    expect(html).not.toContain("<a");
    expect(html).toContain('alt="MicroNest"');
  });

  it("default linked Logo preserves home behavior", () => {
    const html = renderToString(<Logo height={28} />);
    expect(html).toContain('aria-label="MicroNest home"');
    expect(html).toContain('alt="MicroNest"');
  });

  it("supports priority without breaking", () => {
    const html = renderToString(<Logo height={32} priority href="/" />);
    expect(html).toContain('alt="MicroNest"');
  });
});
