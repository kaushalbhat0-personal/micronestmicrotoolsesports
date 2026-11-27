import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    const html = renderToString(<EmptyState title="No creator channels connected" />);
    expect(html).toContain("No creator channels connected");
  });

  it("renders description", () => {
    const html = renderToString(<EmptyState title="No campaigns" description="Create your first campaign to start tracking" />);
    expect(html).toContain("Create your first campaign");
  });

  it("renders primary action", () => {
    const html = renderToString(<EmptyState title="No campaigns" action={<button>Connect a channel</button>} />);
    expect(html).toContain("Connect a channel");
  });

  it("renders secondary action", () => {
    const html = renderToString(
      <EmptyState title="No channels" description="Connect a channel" action={<button>Connect</button>} secondaryAction={<a href="/help">How it works</a>} />
    );
    expect(html).toContain("Connect");
    expect(html).toContain("How it works");
  });

  it("renders icon", () => {
    const html = renderToString(<EmptyState title="No scans" icon={<span data-testid="icon">★</span>} />);
    expect(html).toContain("★");
  });

  it("has accessible structure (heading)", () => {
    const html = renderToString(<EmptyState title="No deliverables" description="Add one" />);
    expect(html).toContain("<h3");
    expect(html).toContain("No deliverables");
  });

  it("remains readable on narrow screens (no fixed width)", () => {
    const html = renderToString(<EmptyState title="No proof yet" description="We haven’t found matching activity" className="max-w-md" />);
    expect(html).toContain("No proof yet");
    // Ensure no inline fixed width like w-[600px]
    expect(html).not.toContain("w-[600px]");
  });
});
