import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreePrizeSplitterCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreePrizeSplitterCard", () => {
  it("presents unlimited Free in customer language (no quota/metering jargon)", () => {
    const html = renderToString(<ClaimFreePrizeSplitterCard orgSlug="acme" />);
    expect(html).toContain("Prize Pool Splitter");
    expect(html).toContain("Free forever");
    expect(html).toContain("unlimited calculations");
    expect(html).toContain("Start free");
    expect(html).not.toMatch(/quota|metered|per month|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
