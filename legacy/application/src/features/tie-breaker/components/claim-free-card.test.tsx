import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreeTieBreakerCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreeTieBreakerCard", () => {
  it("presents the quota-limited Free plan in customer language (canonical badge, no contradiction)", () => {
    const html = renderToString(<ClaimFreeTieBreakerCard orgSlug="acme" />);
    expect(html).toContain("Tie-Breaker Resolver");
    expect(html).toContain("Free plan");
    expect(html).toContain("3 locked official records per workspace month");
    expect(html).toContain("Start free");
    // F9: a quota-limited tool must never claim "Free forever".
    expect(html).not.toContain("Free forever");
    expect(html).not.toMatch(/quota|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
