import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Logo, LogoMark } from "./logo";

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

describe("LogoMark — compact brand mark", () => {
  it("uses mark asset not full lockup", () => {
    const html = renderToString(<LogoMark size={32} />);
    expect(html).toContain("micronest-mark.svg");
    expect(html).not.toContain("Final_MicroNest_Logo.svg");
    expect(html).toContain('alt="MicroNest"');
  });

  it("linked LogoMark has home label", () => {
    const html = renderToString(<LogoMark size={32} href="/" />);
    expect(html).toContain('aria-label="MicroNest home"');
    expect(html).toContain('href="/"');
  });

  it("non-linked mark does not render anchor", () => {
    const html = renderToString(<LogoMark size={80} />);
    expect(html).not.toContain("<a");
  });

  it("renders square dimensions", () => {
    const html = renderToString(<LogoMark size={40} />);
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
  });
});
