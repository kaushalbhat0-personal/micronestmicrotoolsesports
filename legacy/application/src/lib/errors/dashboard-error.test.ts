import { describe, expect, it } from "vitest";
import { AppError, authenticationError, entitlementError, internalError } from "@/lib/errors";
import { mapDashboardError } from "./dashboard-error";

describe("mapDashboardError — customer-safe boundary mapping", () => {
  it("AUTHENTICATION_REQUIRED maps to session-expired copy with Sign in (no retry loop)", () => {
    const view = mapDashboardError(authenticationError());
    expect(view.kind).toBe("authentication");
    expect(view.message).toBe("Your session has expired. Sign in again to continue.");
    expect(view.showLogin).toBe(true);
    expect(view.showRetry).toBe(false);
    expect(view.message).not.toContain("AUTHENTICATION_REQUIRED");
    expect(view.message).not.toContain("Authentication required");
  });

  it("legacy 'Authentication required' Error message maps to login (no raw render)", () => {
    const view = mapDashboardError(new Error("Authentication required"));
    expect(view.kind).toBe("authentication");
    expect(view.message).toBe("Your session has expired. Sign in again to continue.");
    expect(view.showLogin).toBe(true);
    expect(view.showRetry).toBe(false);
  });

  it("raw internal database error never renders", () => {
    const view = mapDashboardError(new Error('relation "public.user_tool_entitlements" does not exist'));
    expect(view.kind).toBe("generic");
    expect(view.message).not.toContain("relation");
    expect(view.message).not.toContain("user_tool_entitlements");
    expect(view.showLogin).toBe(false);
  });

  it("unknown AppError never renders raw message or code", () => {
    const view = mapDashboardError(internalError("db exploded: uuid 123e4567-e89b-12d3-a456-426614174000"));
    expect(view.kind).toBe("generic");
    expect(view.message).not.toContain("db exploded");
    expect(view.message).not.toContain("123e4567");
    expect(view.message).not.toContain("INTERNAL_ERROR");
    expect(view.message).not.toContain("AppError");
  });

  it("Supabase-style auth transport error does not leak internals", () => {
    const view = mapDashboardError(new Error("invalid JWT: unable to parse or verify signature"));
    // Even auth-flavored internals collapse to the fixed customer copy.
    expect(view.message).toBe("Your session has expired. Sign in again to continue.");
    expect(view.showRetry).toBe(false);
  });

  it("entitlement denial keeps access UX (no login, no retry)", () => {
    const view = mapDashboardError(entitlementError());
    expect(view.kind).toBe("access");
    expect(view.showLogin).toBe(false);
    expect(view.showRetry).toBe(false);
  });

  it("genuinely retryable unknown failure keeps retry but with generic copy", () => {
    const view = mapDashboardError(new Error("fetch failed"));
    expect(view.kind).toBe("generic");
    expect(view.showRetry).toBe(true);
    expect(view.message).not.toContain("fetch failed");
  });

  it("non-Error throwables map to generic copy", () => {
    const view = mapDashboardError("some string");
    expect(view.kind).toBe("generic");
    expect(view.message).not.toContain("some string");
    expect(view instanceof Object).toBe(true);
  });

  it("AppError code name never leaks into customer copy", () => {
    const err = new AppError({ code: "FORBIDDEN", status: 403, message: "row-level security policy violation" });
    const view = mapDashboardError(err);
    expect(view.message).not.toContain("FORBIDDEN");
    expect(view.message).not.toContain("row-level security");
  });
});
