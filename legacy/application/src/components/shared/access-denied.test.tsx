import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { AppError, entitlementError, forbiddenError, isEntitlementDenied, validationError } from "@/lib/errors";
import { AccessDenied } from "./access-denied";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) };
});

describe("access-denied classification", () => {
  it("matches only the entitlement-required condition", () => {
    expect(isEntitlementDenied(entitlementError("x"))).toBe(true);
    expect(isEntitlementDenied(new AppError({ code: "ENTITLEMENT_REQUIRED", status: 403, message: "m" }))).toBe(true);
  });

  it("does not swallow other failures", () => {
    expect(isEntitlementDenied(forbiddenError("nope"))).toBe(false);
    expect(isEntitlementDenied(validationError("bad"))).toBe(false);
    expect(isEntitlementDenied(new Error("boom"))).toBe(false);
    expect(isEntitlementDenied(null)).toBe(false);
    expect(isEntitlementDenied(undefined)).toBe(false);
    expect(isEntitlementDenied("ENTITLEMENT_REQUIRED")).toBe(false);
  });
});

describe("AccessDenied component", () => {
  it("renders approved copy with workspace billing actions", () => {
    const html = renderToString(<AccessDenied orgSlug="acme-esports" />);
    expect(html).toContain("Tool not active");
    expect(html).toContain("active for your workspace yet");
    expect(html).toContain("Check your plan or open Billing to activate access");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("View plans");
    expect(html).toContain('href="/dashboard/acme-esports/settings/billing"');
    expect(html).toContain("Open Billing");
  });

  it("exposes no internal identifiers", () => {
    const html = renderToString(<AccessDenied orgSlug="acme-esports" />);
    expect(html).not.toMatch(/entitlement|organization_id|tenant|slug|UUID|RPC|RLS|webhook|stateless|immutable|sponsor-sentinel|prize-splitter|draft-ban/i);
    expect(html).not.toContain("Something went wrong");
  });

  it("meets touch-target and heading requirements", () => {
    const html = renderToString(<AccessDenied orgSlug="acme-esports" />);
    expect(html).toMatch(/<h[1-6][^>]*>Tool not active<\//);
    expect(html).toContain("min-h-[44px]");
  });
});
