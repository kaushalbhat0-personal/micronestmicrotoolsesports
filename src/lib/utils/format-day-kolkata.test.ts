import { describe, expect, it } from "vitest";
import { formatDayKolkata } from "./format";

describe("formatDayKolkata (RCCF F11 — hydration-safe dates)", () => {
  it("pins Asia/Kolkata so server and client can never disagree", () => {
    // 2026-10-01T20:00:00Z is Oct 02 in IST but Oct 01 in UTC — a bare
    // toLocaleDateString hydrated across those zones mismatched (#418).
    expect(formatDayKolkata("2026-10-01T20:00:00.000Z")).toBe("02 Oct 2026");
    expect(formatDayKolkata("2026-10-02T11:28:08.000Z")).toBe("02 Oct 2026");
  });

  it("is deterministic for the same instant", () => {
    const a = formatDayKolkata("2026-10-02T11:28:08.000Z");
    const b = formatDayKolkata("2026-10-02T11:28:08.000Z");
    expect(a).toBe(b);
  });

  it("falls back safely for empty or invalid input", () => {
    expect(formatDayKolkata(null)).toBe("—");
    expect(formatDayKolkata(undefined)).toBe("—");
    expect(formatDayKolkata("not-a-date")).toBe("not-a-date");
  });
});
