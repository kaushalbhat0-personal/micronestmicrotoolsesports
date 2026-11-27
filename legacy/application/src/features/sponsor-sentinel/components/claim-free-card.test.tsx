import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreeSponsorshipCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreeSponsorshipCard (RCCF F5)", () => {
  it("offers the same Free activation path as other tools with the channel next step", () => {
    const html = renderToString(<ClaimFreeSponsorshipCard orgSlug="acme" />);
    expect(html).toContain("Sponsorship Tracking");
    expect(html).toContain("Free plan");
    expect(html).toContain("1 active campaign");
    expect(html).toContain("1 connected channel");
    expect(html).toContain("10 checks/month");
    expect(html).toContain("connect a creator channel");
    expect(html).toContain("Start free");
    // F9: a quota-limited tool must never claim "Free forever".
    expect(html).not.toContain("Free forever");
    expect(html).not.toMatch(/quota|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
