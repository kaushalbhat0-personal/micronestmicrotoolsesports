import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreeTieBreakerCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreeTieBreakerCard", () => {
  it("presents the Free plan in customer language (no quota/RPC/entitlement jargon)", () => {
    const html = renderToString(<ClaimFreeTieBreakerCard orgSlug="acme" />);
    expect(html).toContain("Tie-Breaker Resolver");
    expect(html).toContain("3 official records this month");
    expect(html).toContain("Start free");
    expect(html).not.toMatch(/quota|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
