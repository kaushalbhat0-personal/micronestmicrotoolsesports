import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("maps draft → Setup", () => {
    const html = renderToString(<StatusBadge status="draft" />);
    expect(html).toContain("Setup");
    expect(html).toContain("◌");
    // Internal value still draft in aria-label
    expect(html).toContain("draft");
  });

  it("maps active → Tracking", () => {
    const html = renderToString(<StatusBadge status="active" />);
    expect(html).toContain("Tracking");
    expect(html).toContain("●");
  });

  it("maps completed → Completed", () => {
    const html = renderToString(<StatusBadge status="completed" />);
    expect(html).toContain("Completed");
    expect(html).toContain("✓");
  });

  it("maps archived → Archived", () => {
    const html = renderToString(<StatusBadge status="archived" />);
    expect(html).toContain("Archived");
  });

  it("maps PASS → Confirmed", () => {
    const html = renderToString(<StatusBadge status="PASS" />);
    expect(html).toContain("Confirmed");
    expect(html).toContain("✓");
    expect(html).toContain("bg-emerald-500");
  });

  it("maps FAIL → Not found", () => {
    const html = renderToString(<StatusBadge status="FAIL" />);
    expect(html).toContain("Not found");
    expect(html).toContain("×");
    expect(html).toContain("bg-destructive");
  });

  it("maps NOT_VERIFIABLE → Needs review", () => {
    const html = renderToString(<StatusBadge status="NOT_VERIFIABLE" />);
    expect(html).toContain("Needs review");
    expect(html).toContain("◐");
    expect(html).toContain("bg-amber-500");
  });

  it("maps NOT_SUPPORTED → Not applicable", () => {
    const html = renderToString(<StatusBadge status="NOT_SUPPORTED" />);
    expect(html).toContain("Not applicable");
    expect(html).toContain("—");
  });

  it("maps PENDING → Checking", () => {
    const html = renderToString(<StatusBadge status="PENDING" />);
    expect(html).toContain("Checking");
    expect(html).toContain("◌");
  });

  it("verifies internal values remain unchanged (status still present in aria-label)", () => {
    const html = renderToString(<StatusBadge status="PASS" />);
    expect(html).toContain('aria-label="Confirmed: PASS"');
  });

  it("renders icon + text, not color alone", () => {
    const html = renderToString(<StatusBadge status="FAIL" />);
    // Both icon and label must be present
    expect(html).toContain("×");
    expect(html).toContain("Not found");
  });

  it("renders as span with accessible semantics", () => {
    const html = renderToString(<StatusBadge status="draft" />);
    expect(html).toContain("<span");
    // Should have aria-label
    expect(html).toContain("aria-label");
  });
});
