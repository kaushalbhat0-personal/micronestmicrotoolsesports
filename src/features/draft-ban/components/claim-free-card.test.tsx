import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimFreeDraftBanCard } from "./claim-free-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClaimFreeDraftBanCard", () => {
  it("presents the Free-forever plan in customer language (no quota/RPC/entitlement jargon)", () => {
    const html = renderToString(<ClaimFreeDraftBanCard orgSlug="acme" />);
    expect(html).toContain("Draft &amp; Ban");
    expect(html).toContain("1 official match this month");
    expect(html).toContain("Free forever");
    expect(html).toContain("Start free");
    expect(html).not.toMatch(/quota|RPC|entitlement|UTC|user_tool_entitlements/i);
  });
});
