import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  ORGANIZATION_TIMEZONE_DEFAULT,
  getOrganizationTimezone,
  isValidTimezoneIdentifier,
  parseTimezoneIdentifier,
} from "@/server/services/organization-timezone";

/**
 * Canonical workspace timezone resolver tests
 * (RCCF-FREEMIUM-PLATFORM-IMPLEMENT-06).
 *
 * Unit tests with a mocked Supabase client at the query boundary.
 * No static timezone list anywhere — validation uses the runtime IANA
 * database (mirroring the migration's pg_timezone_names CHECK).
 */

function mockClient(timezoneRow: { timezone?: unknown } | null, queryError = false) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () =>
            queryError || timezoneRow === null
              ? { data: null, error: { message: "no rows" } }
              : { data: timezoneRow, error: null },
          ),
        })),
      })),
    })),
  };
}

describe("isValidTimezoneIdentifier — no static list", () => {
  it("accepts valid Asia/Kolkata", () => {
    expect(isValidTimezoneIdentifier("Asia/Kolkata")).toBe(true);
  });

  it("accepts valid America/New_York", () => {
    expect(isValidTimezoneIdentifier("America/New_York")).toBe(true);
  });

  it("accepts valid Europe/London", () => {
    expect(isValidTimezoneIdentifier("Europe/London")).toBe(true);
  });

  it("rejects UTC offsets such as +05:30", () => {
    expect(isValidTimezoneIdentifier("+05:30")).toBe(false);
    expect(isValidTimezoneIdentifier("UTC+5:30")).toBe(false);
  });

  it("rejects abbreviations such as IST", () => {
    expect(isValidTimezoneIdentifier("IST")).toBe(false);
  });

  it("rejects empty, overlong, and non-string values", () => {
    expect(isValidTimezoneIdentifier("")).toBe(false);
    expect(isValidTimezoneIdentifier(null)).toBe(false);
    expect(isValidTimezoneIdentifier(undefined)).toBe(false);
    expect(isValidTimezoneIdentifier(123)).toBe(false);
    expect(isValidTimezoneIdentifier("Not_A_Real_Zone/Xyz")).toBe(false);
  });

  it("parseTimezoneIdentifier returns the value or throws VALIDATION_ERROR", () => {
    expect(parseTimezoneIdentifier("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(() => parseTimezoneIdentifier("IST")).toThrow();
    expect(() => parseTimezoneIdentifier("+05:30")).toThrow();
  });
});

describe("getOrganizationTimezone — canonical server resolver", () => {
  it("reads the stored Asia/Kolkata timezone", async () => {
    const tz = await getOrganizationTimezone(mockClient({ timezone: "Asia/Kolkata" }) as never, "org-1");
    expect(tz).toBe("Asia/Kolkata");
  });

  it("reads the stored America/New_York timezone", async () => {
    const tz = await getOrganizationTimezone(mockClient({ timezone: "America/New_York" }) as never, "org-1");
    expect(tz).toBe("America/New_York");
  });

  it("reads the stored Europe/London timezone", async () => {
    const tz = await getOrganizationTimezone(mockClient({ timezone: "Europe/London" }) as never, "org-1");
    expect(tz).toBe("Europe/London");
  });

  it("missing organization fails safely (NOT_FOUND, never a default)", async () => {
    await expect(getOrganizationTimezone(mockClient(null) as never, "org-missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("invalid stored timezone fails safely (INTERNAL, never APP_TIMEZONE fallback)", async () => {
    await expect(getOrganizationTimezone(mockClient({ timezone: "IST" }) as never, "org-1")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
    await expect(getOrganizationTimezone(mockClient({}) as never, "org-1")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("never uses APP_TIMEZONE as a value fallback — no import, no fallback expression", () => {
    // §10 requires documenting the APP_TIMEZONE distinction in prose; what
    // is forbidden is *using* it as authority. Guard the mechanisms, not
    // the documentation.
    const impl = readFileSync("src/server/services/organization-timezone.ts", "utf8");
    expect(impl).not.toMatch(/from\s+["']@\/lib\/utils\/format["']/);
    expect(impl).not.toMatch(/\?\?\s*APP_TIMEZONE/);
    expect(impl).not.toMatch(/\|\|\s*APP_TIMEZONE/);
  });

  it("does not accept a client-provided timezone (API takes only server-derived org ID)", async () => {
    // The resolver signature is (supabase, organizationId): there is no
    // timezone parameter, so a caller cannot inject one — even a crafted
    // organizationId is only ever used as a lookup key, never returned.
    const tz = await getOrganizationTimezone(
      mockClient({ timezone: "Asia/Kolkata" }) as never,
      "America/New_York",
    );
    expect(tz).toBe("Asia/Kolkata");
  });

  it("empty organization ID is rejected before any query", async () => {
    const client = mockClient({ timezone: "Asia/Kolkata" });
    await expect(getOrganizationTimezone(client as never, "")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("database default is the documented Asia/Kolkata literal (not an APP_TIMEZONE import)", () => {
    // The default string happens to equal the display default, but the
    // resolver/migration must never import APP_TIMEZONE as authority —
    // guarded by the no-APP_TIMEZONE-reference test above.
    expect(ORGANIZATION_TIMEZONE_DEFAULT).toBe("Asia/Kolkata");
  });
});
