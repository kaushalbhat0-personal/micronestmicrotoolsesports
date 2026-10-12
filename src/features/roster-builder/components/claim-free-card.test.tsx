import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreeRosterBuilderCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreeRosterBuilderCard", () => {
  it("presents unlimited Free in customer language (no quota/metering jargon)", () => {
    // React 19 SSR emits `<!-- -->` between adjacent text/expressions.
    const html = renderToString(<ClaimFreeRosterBuilderCard orgSlug="acme" />).replace(/<!-- -->/g, "");
    expect(html).toContain("Tournament Roster &amp; Slot Builder");
    expect(html).toContain("Free forever");
    expect(html).toContain("unlimited rosters");
    expect(html).toContain("Start free");
    expect(html).not.toMatch(/quota|metered|per month|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
