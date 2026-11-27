import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreePayoutTrackerCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreePayoutTrackerCard", () => {
  it("presents the quota-limited Free plan in customer language (canonical badge, no contradiction)", () => {
    const html = renderToString(<ClaimFreePayoutTrackerCard orgSlug="acme" />);
    expect(html).toContain("Prize Payout Tracker");
    expect(html).toContain("Free plan");
    expect(html).toContain("1 published tracker per workspace month");
    expect(html).toContain("up to 20 recipients per tracker");
    expect(html).toContain("Start free");
    // F9: a quota-limited tool must never claim "Free forever".
    expect(html).not.toContain("Free forever");
    expect(html).not.toMatch(/quota|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
