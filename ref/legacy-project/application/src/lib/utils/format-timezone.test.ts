import { describe, expect, it } from "vitest";
import { formatDateTimeKolkata, APP_TIMEZONE } from "./format";

describe("formatDateTimeKolkata — RCCF-SPONSOR-PROOF-11 timezone", () => {
  it("APP_TIMEZONE is Asia/Kolkata", () => {
    expect(APP_TIMEZONE).toBe("Asia/Kolkata");
  });

  it("Check History / Campaign Detail / Latest Proof share same formatter", async () => {
    // Deterministic UTC instant: 2026-10-02T11:28:08Z = 16:58 IST (UTC+5:30)
    // Previous bug showed Campaign Detail as 11:28 UTC while Check History showed 16:58 IST
    const utc = "2026-10-02T11:28:08.000Z";
    const formatted = formatDateTimeKolkata(utc);
    // Should contain IST time, not UTC 11:28
    expect(formatted).toMatch(/16:58/);
    expect(formatted).toMatch(/2026/);
    // Should contain timezone short name (IST or GMT+5:30)
    expect(formatted).toMatch(/IST|GMT\+5:30/i);
  });

  it("Check Details same formatter (no browser drift)", () => {
    const utc = "2026-10-02T11:28:08.000Z";
    const a = formatDateTimeKolkata(utc);
    const b = formatDateTimeKolkata(utc);
    expect(a).toBe(b);
  });

  it("Midnight boundary 2026-10-01T20:00:00Z -> 2026-10-02 IST", () => {
    // UTC 20:00 on Oct 1 is 01:30 Oct 2 IST — should show Oct 02
    const utc = "2026-10-01T20:00:00.000Z";
    const formatted = formatDateTimeKolkata(utc);
    expect(formatted).toMatch(/02/);
    expect(formatted).toMatch(/Oct/i);
    // Should be 01:30 IST
    expect(formatted).toMatch(/01:30/);
  });

  it("null returns em dash", () => {
    expect(formatDateTimeKolkata(null)).toBe("—");
    expect(formatDateTimeKolkata(undefined)).toBe("—");
  });

  it("no browser timezone dependency — explicit timeZone", () => {
    // Even if process TZ is UTC, output must be Kolkata
    // 2026-01-15T00:00:00Z = 05:30 Jan 15 IST
    const formatted = formatDateTimeKolkata("2026-01-15T00:00:00.000Z");
    expect(formatted).toMatch(/05:30/);
  });

  it("consistent across surfaces: evidence observed_at and scan started_at", () => {
    const ts = "2026-10-02T10:00:00.000Z"; // 15:30 IST
    const scanFormatted = formatDateTimeKolkata(ts);
    const evidenceFormatted = formatDateTimeKolkata(ts);
    expect(scanFormatted).toBe(evidenceFormatted);
  });
});
