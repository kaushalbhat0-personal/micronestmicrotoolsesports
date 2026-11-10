import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { CheckNowButton } from "./check-now-button";

// Mock next/navigation router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock server action
vi.mock("@/features/sponsor-sentinel/actions/campaign-actions", () => ({
  requestScanAction: vi.fn(async () => ({ ok: true })),
}));

describe("CheckNowButton", () => {
  it("initial button is Check now", () => {
    const html = renderToString(<CheckNowButton orgSlug="tag-esports" campaignId="camp-1" />);
    expect(html).toContain("Check now");
    expect(html).not.toContain("Checking");
  });

  it("has correct aria-label Check now when not pending", () => {
    const html = renderToString(<CheckNowButton orgSlug="tag-esports" campaignId="camp-1" />);
    expect(html).toContain('aria-label="Check now"');
  });

  it("renders as button with accessible label", () => {
    const html = renderToString(<CheckNowButton orgSlug="tag-esports" campaignId="camp-1" />);
    expect(html).toContain("<button");
    expect(html).toContain("Check now");
  });

  it("does not render internal error details in initial state", () => {
    const html = renderToString(<CheckNowButton orgSlug="tag-esports" campaignId="camp-1" />);
    expect(html).not.toContain("stack");
    expect(html).not.toContain("API");
    expect(html).not.toContain("provider");
  });

  it("shows customer-facing wording Checking… is used (not scanning)", async () => {
    // Verify source file contains expected pending text
    const fs = await import("fs");
    const path = "src/features/sponsor-sentinel/components/check-now-button.tsx";
    const content = fs.readFileSync(path, "utf8");
    expect(content).toContain("Checking");
    expect(content).not.toContain("scanning");
    expect(content).not.toContain("scanner");
    expect(content).not.toContain("executeScan");
  });
});
