import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SectionHeader } from "./section-header";

describe("SectionHeader", () => {
  it("renders title", () => {
    const html = renderToString(<SectionHeader title="Requirements" />);
    expect(html).toContain("Requirements");
    expect(html).toContain("<h2");
  });

  it("renders description", () => {
    const html = renderToString(<SectionHeader title="Proof" description="Latest activity captured from connected creator channels." />);
    expect(html).toContain("Latest activity captured");
  });

  it("renders action", () => {
    const html = renderToString(<SectionHeader title="Requirements" action={<button>Add requirement</button>} />);
    expect(html).toContain("Add requirement");
  });

  it("handles optional action absence", () => {
    const html = renderToString(<SectionHeader title="Channels" description="No action" />);
    expect(html).toContain("Channels");
    expect(html).not.toContain("<button");
  });

  it("supports icon", () => {
    const html = renderToString(<SectionHeader title="Proof" icon={<span>★</span>} />);
    expect(html).toContain("★");
  });

  it("wraps action gracefully (responsive)", () => {
    const html = renderToString(<SectionHeader title="Title" description="Desc" action={<button>Action</button>} />);
    expect(html).toContain("flex");
    expect(html).toContain("sm:flex-row");
  });
});
