import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreePrizeSplitterCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreePrizeSplitterCard", () => {
  it("presents unlimited Free in customer language (canonical badge, no contradiction)", () => {
    const html = renderToString(<ClaimFreePrizeSplitterCard orgSlug="acme" />);
    expect(html).toContain("Prize Pool Splitter");
    expect(html).toContain("Free forever");
    expect(html).toContain("Unlimited calculations");
    expect(html).toContain("Start free");
    // F9: an unlimited tool must never be labelled "Free plan".
    expect(html).not.toContain("Free plan");
    expect(html).not.toMatch(/quota|metered|per month|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
