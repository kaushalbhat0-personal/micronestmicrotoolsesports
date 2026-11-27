import { describe, expect, it } from "vitest";
import { appendPublicUrl, buildWhatsAppShareUrl, truncateForShare, WHATSAPP_PREFILL_BUDGET } from "./whatsapp";

describe("buildWhatsAppShareUrl", () => {
  it("1. plain ASCII", () => {
    expect(buildWhatsAppShareUrl("Hello shared")).toBe("https://wa.me/?text=Hello%20shared");
  });

  it("2. spaces become %20, never +", () => {
    const url = buildWhatsAppShareUrl("a b c");
    expect(url).toContain("a%20b%20c");
    expect(url).not.toContain("a+b+c");
  });

  it("3. newlines become %0A", () => {
    expect(buildWhatsAppShareUrl("line1\nline2")).toBe("https://wa.me/?text=line1%0Aline2");
  });

  it("4. emoji preserved", () => {
    const url = buildWhatsAppShareUrl("🏆 winners");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("🏆 winners");
  });

  it("5. unicode preserved", () => {
    const url = buildWhatsAppShareUrl("café naïve đội");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("café naïve đội");
  });

  it.each([
    ["6. ampersand", "fish & chips", "fish%20%26%20chips"],
    ["7. hash", "team #1", "team%20%231"],
    ["8. question mark", "ready?", "ready%3F"],
    ["9. percent", "100% done", "100%25%20done"],
    ["10. plus", "1+1=2", "1%2B1%3D2"],
  ])("%s", (_label, input, encoded) => {
    expect(buildWhatsAppShareUrl(input)).toBe(`https://wa.me/?text=${encoded}`);
  });

  it("11. mixed unicode + punctuation round-trips", () => {
    const input = "🏆 Alpha — 50% +bónus? #1!";
    const url = buildWhatsAppShareUrl(input);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe(input);
  });

  it("12. no double encoding", () => {
    // A literal %20 in the message must encode the % itself, not pass through.
    expect(buildWhatsAppShareUrl("100%20off")).toBe("https://wa.me/?text=100%2520off");
  });

  it("13. no raw + substitution for spaces", () => {
    const url = buildWhatsAppShareUrl("hello world");
    expect(url.split("?text=")[1]).not.toContain("+");
  });

  it("14. appends no phone number — recipient chosen in WhatsApp", () => {
    const url = buildWhatsAppShareUrl("hi");
    expect(url).toBe("https://wa.me/?text=hi");
    expect(url).not.toMatch(/wa\.me\/\d/);
  });
});

describe("appendPublicUrl", () => {
  it("14b. URL placement: body, blank line, URL on its own final line", () => {
    expect(appendPublicUrl("Result here", "https://example.com/share/abc")).toBe("Result here\n\nView online: https://example.com/share/abc");
  });
});

describe("truncateForShare", () => {
  it("15. truncation keeps output within budget", () => {
    const { text, truncated } = truncateForShare("a\n".repeat(500), 100);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(100);
  });

  it("16. truncation prefers the latest boundary within budget and reports shortening", () => {
    const { text, truncated } = truncateForShare("line one\nline two is longer\nline three", 20);
    expect(truncated).toBe(true);
    expect(text).toBe("line one\nline two");
  });

  it("17. short message unchanged", () => {
    expect(truncateForShare("short", 100)).toEqual({ text: "short", truncated: false });
    expect(WHATSAPP_PREFILL_BUDGET).toBeGreaterThan(0);
  });
});
