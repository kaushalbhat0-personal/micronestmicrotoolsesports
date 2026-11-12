import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ReadinessCard } from "./readiness-card";

describe("ReadinessCard", () => {
  it("renders all complete (ready)", () => {
    const html = renderToString(
      <ReadinessCard
        title="Campaign setup"
        items={[
          { label: "Campaign details", status: "complete" },
          { label: "Requirement added", status: "complete" },
          { label: "Creator channel connected", status: "complete" },
        ]}
        action={<button>Start tracking</button>}
      />
    );
    expect(html).toContain("Campaign setup");
    expect(html).toContain("Campaign details");
    expect(html).toContain("3 of 3 ready");
    expect(html).toContain("Ready");
    expect(html).toContain("Start tracking");
    expect(html).toContain("border-success/20");
  });

  it("renders one blocked item (needs setup)", () => {
    const html = renderToString(
      <ReadinessCard
        title="Campaign setup"
        items={[
          { label: "Campaign details", status: "complete" },
          { label: "Requirement added", status: "complete" },
          { label: "Creator channel not connected", status: "blocked", description: "Connect a channel to start tracking." },
        ]}
        action={<button>Connect channel</button>}
      />
    );
    expect(html).toContain("Creator channel not connected");
    expect(html).toContain("Needs setup");
    expect(html).toContain("Connect a channel");
    expect(html).toContain("border-warning/20");
    expect(html).toContain("×");
  });

  it("renders warning state", () => {
    const html = renderToString(
      <ReadinessCard
        title="Campaign setup"
        items={[{ label: "Requirement needs review", status: "warning", description: "Check tags" }]}
      />
    );
    expect(html).toContain("Requirement needs review");
    expect(html).toContain("⚠");
  });

  it("renders action", () => {
    const html = renderToString(<ReadinessCard title="Ready" items={[{ label: "Done", status: "complete" }]} action={<a href="/connect">Connect</a>} />);
    expect(html).toContain("Connect");
    expect(html).toContain('href="/connect"');
  });

  it("responsive-safe structure (no fixed widths, stacks)", () => {
    const html = renderToString(<ReadinessCard title="Setup" items={[{ label: "Item", status: "complete" }]} />);
    expect(html).not.toContain("w-[600px]");
    expect(html).toContain("flex");
  });

  it("shows completed count", () => {
    const html = renderToString(<ReadinessCard title="Setup" items={[{ label: "A", status: "complete" }, { label: "B", status: "blocked" }]} />);
    expect(html).toContain("1 of 2 ready");
  });
});
