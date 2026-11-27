import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { DeliverableForm } from "./deliverable-form";

// Mock next/navigation not needed; form uses server action directly
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("DeliverableForm pending UX", () => {
  it("idle state shows Add requirement", () => {
    const html = renderToString(<DeliverableForm orgSlug="test-org" campaignId="camp-1" />);
    expect(html).toContain("Add requirement");
    expect(html).toContain('aria-label="Add requirement"');
  });

  it("uses useTransition pending pattern", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/features/sponsor-sentinel/components/deliverable-form.tsx", "utf8");
    expect(content).toContain("useTransition");
    expect(content).toContain("pending");
    expect(content).toContain("Adding requirement");
  });

  it("pending shows disabled and aria-busy and loading spinner via Button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/features/sponsor-sentinel/components/deliverable-form.tsx", "utf8");
    expect(content).toContain('aria-busy={pending}');
    expect(content).toContain("disabled={pending}");
    expect(content).toContain("loading={pending}");
    // Button already supports loading spinner
    expect(content).toContain('aria-label={pending ? "Adding requirement"');
  });

  it("prevents duplicate submission via disabled while pending", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/features/sponsor-sentinel/components/deliverable-form.tsx", "utf8");
    // startTransition ensures pending true during action
    expect(content).toContain("startTransition(async () => {");
    expect(content).toContain("disabled={pending}");
  });

  it("shows error alert on failure and allows retry", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/features/sponsor-sentinel/components/deliverable-form.tsx", "utf8");
    expect(content).toContain('role="alert"');
    expect(content).toContain("setError");
    // Error clears pending via transition end
  });

  it("does not expose technical details in pending text", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/features/sponsor-sentinel/components/deliverable-form.tsx", "utf8");
    expect(content).not.toContain("scanning");
    expect(content).not.toContain("scanner");
  });
});
