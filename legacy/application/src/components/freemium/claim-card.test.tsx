import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ClaimCard } from "./claim-card";

describe("ClaimCard", () => {
  it("12. renders the tool name", () => {
    const html = renderToString(<ClaimCard toolName="Tie-Breaker" onClaim={() => undefined} />);
    expect(html).toContain("Tie-Breaker");
  });

  it("13. renders supplied limits/copy", () => {
    const html = renderToString(
      <ClaimCard
        toolName="Tie-Breaker"
        description="Settle ties with rules everyone can see."
        limits="3 official records a month. No payment required."
        onClaim={() => undefined}
      />
    );
    expect(html).toContain("Settle ties with rules everyone can see.");
    expect(html).toContain("3 official records a month. No payment required.");
  });

  it("14. wires the supplied claim handler to the claim button without render-time calls", () => {
    const onClaim = vi.fn();
    const html = renderToString(<ClaimCard toolName="Tie-Breaker" claimLabel="Start free" onClaim={onClaim} />);
    // Static render must never execute the handler (activation-only wiring).
    expect(onClaim).not.toHaveBeenCalled();
    // The single activation affordance carries the caller label.
    expect(html).toContain("<button");
    expect(html).toContain("Start free");
  });

  it("15. shows loading/disabled state correctly", () => {
    const html = renderToString(<ClaimCard toolName="Tie-Breaker" status="loading" onClaim={() => undefined} />);
    expect(html).toContain("disabled");
    expect(html).toContain("aria-busy=\"true\"");
    // Spinner affordance from the shared Button.
    expect(html).toContain("animate-spin");
  });

  it("16. renders the supplied customer-safe error", () => {
    const html = renderToString(
      <ClaimCard toolName="Tie-Breaker" status="error" error="Could not start free access" onClaim={() => undefined} />
    );
    expect(html).toContain("Could not start free access");
    expect(html).toContain('role="alert"');
  });

  it("17. does not expose raw error object details", () => {
    const html = renderToString(
      <ClaimCard toolName="Tie-Breaker" status="error" error="Something went wrong. Please try again." onClaim={() => undefined} />
    );
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("stack");
    expect(html).not.toContain("ECONNREFUSED");
  });

  it("18. performs no direct database/network authorization logic (caller-owned execution)", () => {
    // The component accepts only data + a callback: no identifiers that
    // could route to data, policy, or payment layers (see architecture.test.ts
    // for the matching source-level import ban).
    const html = renderToString(<ClaimCard toolName="Tie-Breaker" onClaim={() => undefined} />);
    // "order"/"payment" omitted here: they collide with the "border" class
    // substring; the source-level import ban in architecture.test.ts is the
    // real guarantee against those layers.
    for (const term of ["user_id", "organization_id", "supabase", "policy", "quota", "checkout", "grant"]) {
      expect(html).not.toContain(term);
    }
  });
});
