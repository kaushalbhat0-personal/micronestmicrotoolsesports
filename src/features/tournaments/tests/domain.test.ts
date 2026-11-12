// P3 tournament domain tests (pure, no network, no database).
// Covers: status derivation boundaries, registration-open gating (fail
// closed), timezone validation/formatting without throwing, money shapes
// and display, organizer refs (verification frozen false), and external
// registration URL rules.

import { describe, expect, it } from "vitest";
import { formatInTimezone, isValidTimezone, parseInstantMs } from "../domain/dates";
import {
  formatEntryFee,
  formatPrizePool,
  isMoneyAmount,
} from "../domain/money";
import {
  ORGANIZER_TRUST_NOTE,
  isOrganizerRef,
  organizerKindLabel,
} from "../domain/organizer";
import { isValidRegistrationUrl } from "../domain/registration";
import { deriveStatus, isRegistrationOpen } from "../domain/tournament";

const START = Date.parse("2026-12-01T10:00:00.000Z");
const END = Date.parse("2026-12-03T18:00:00.000Z");

describe("deriveStatus", () => {
  it("buckets instants into upcoming / ongoing / completed", () => {
    expect(deriveStatus(START, END, START - 1)).toBe("upcoming");
    expect(deriveStatus(START, END, START)).toBe("ongoing");
    expect(deriveStatus(START, END, END - 1)).toBe("ongoing");
    expect(deriveStatus(START, END, END)).toBe("completed");
  });

  it("fails closed to completed on non-finite inputs", () => {
    expect(deriveStatus(Number.NaN, END, START)).toBe("completed");
    expect(deriveStatus(START, Number.POSITIVE_INFINITY, START)).toBe("completed");
  });
});

describe("isRegistrationOpen", () => {
  const base = { lifecycle: "published" as const, status: "upcoming" as const, nowMs: START - 1000 };
  it("opens only for published + upcoming + open window", () => {
    expect(isRegistrationOpen({ ...base, registrationClosesAtMs: null })).toBe(true);
    expect(
      isRegistrationOpen({ ...base, registrationClosesAtMs: START - 500 }),
    ).toBe(true);
    expect(
      isRegistrationOpen({ ...base, registrationClosesAtMs: START - 2000 }),
    ).toBe(false);
  });

  it("fails closed on drafts, started events and bad inputs", () => {
    expect(
      isRegistrationOpen({ ...base, lifecycle: "draft", registrationClosesAtMs: null }),
    ).toBe(false);
    expect(
      isRegistrationOpen({ ...base, lifecycle: "unpublished", registrationClosesAtMs: null }),
    ).toBe(false);
    expect(
      isRegistrationOpen({ ...base, status: "ongoing", registrationClosesAtMs: null }),
    ).toBe(false);
    expect(
      isRegistrationOpen({ ...base, status: "completed", registrationClosesAtMs: null }),
    ).toBe(false);
    expect(
      isRegistrationOpen({ ...base, registrationClosesAtMs: Number.NaN }),
    ).toBe(false);
  });
});

describe("dates and timezones", () => {
  it("parses ISO instants and rejects garbage without throwing", () => {
    expect(parseInstantMs("2026-12-01T10:00:00.000Z")).toBe(START);
    expect(parseInstantMs("not-a-date")).toBeNull();
    expect(parseInstantMs(null)).toBeNull();
    expect(() => parseInstantMs("2026-13-99T99:99:99Z")).not.toThrow();
  });

  it("accepts IANA zones and rejects free text", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
  });

  it("formats in-zone without throwing, failing closed on bad input", () => {
    const formatted = formatInTimezone("2026-12-01T10:00:00.000Z", "Asia/Kolkata");
    expect(formatted).toContain("2026");
    expect(formatInTimezone("garbage", "Asia/Kolkata")).toBe("garbage");
    expect(() => formatInTimezone("2026-12-01T10:00:00.000Z", "Mars/Olympus")).not.toThrow();
  });
});

describe("money", () => {
  it("validates minor-unit amounts with ISO currency", () => {
    expect(isMoneyAmount({ amountMinor: 0, currency: "INR" })).toBe(true);
    expect(isMoneyAmount({ amountMinor: 49900, currency: "USD" })).toBe(true);
    expect(isMoneyAmount({ amountMinor: -1, currency: "INR" })).toBe(false);
    expect(isMoneyAmount({ amountMinor: 10.5, currency: "INR" })).toBe(false);
    expect(isMoneyAmount({ amountMinor: 100, currency: "inr" })).toBe(false);
    expect(isMoneyAmount({ amountMinor: 100, currency: "INR!" })).toBe(false);
    expect(isMoneyAmount(null)).toBe(false);
  });

  it("displays free entry and non-disclosure without inventing figures", () => {
    expect(formatEntryFee(null)).toBe("Not disclosed");
    expect(formatEntryFee({ amountMinor: 0, currency: "INR" })).toBe("Free entry");
    expect(formatEntryFee({ amountMinor: 49900, currency: "INR" })).toContain("499");
    expect(formatPrizePool(null)).toBe("Not disclosed");
  });
});

describe("organizer refs", () => {
  it("accepts independent and organization refs with verification frozen false", () => {
    expect(
      isOrganizerRef({ kind: "independent", name: "Nova Events", slug: null, verified: false }),
    ).toBe(true);
    expect(
      isOrganizerRef({ kind: "organization", name: "Nova Org", slug: "nova-org", verified: false }),
    ).toBe(true);
    expect(organizerKindLabel("independent")).toContain("Independent");
    expect(organizerKindLabel("organization")).toContain("Organization");
    expect(ORGANIZER_TRUST_NOTE).toContain("self-declared");
  });

  it("rejects badges, short names and unknown kinds", () => {
    expect(
      isOrganizerRef({ kind: "independent", name: "Nova Events", slug: null, verified: true }),
    ).toBe(false);
    expect(isOrganizerRef({ kind: "sponsor", name: "Nova Events", slug: null, verified: false })).toBe(
      false,
    );
    expect(isOrganizerRef({ kind: "independent", name: "x", slug: null, verified: false })).toBe(false);
  });
});

describe("registration URLs", () => {
  it("accepts https URLs and rejects everything hostile", () => {
    expect(isValidRegistrationUrl("https://events.example.com/register?cup=monsoon")).toBe(true);
    expect(isValidRegistrationUrl("http://events.example.com/register")).toBe(false);
    expect(isValidRegistrationUrl("javascript:alert(1)")).toBe(false);
    expect(isValidRegistrationUrl("data:text/html,<h1>x</h1>")).toBe(false);
    expect(isValidRegistrationUrl("https://user:pass@events.example.com/")).toBe(false);
    expect(isValidRegistrationUrl("https://")).toBe(false);
    expect(isValidRegistrationUrl("not a url")).toBe(false);
    expect(isValidRegistrationUrl("")).toBe(false);
    expect(isValidRegistrationUrl(null)).toBe(false);
    expect(isValidRegistrationUrl(`https://events.example.com/${"x".repeat(2100)}`)).toBe(false);
  });
});
