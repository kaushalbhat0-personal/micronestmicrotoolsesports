// P4 News — sanitization tests (pure, no database).
// Verifies the reimplemented Meta-Parser idea: strip markup, decode the
// small entity set, collapse whitespace, cap length, https-only URLs.

import { describe, expect, it } from "vitest";
import { containsMarkup, isSafeExternalUrl, sanitizePlainText } from "@/features/news/domain/sanitize";

describe("sanitizePlainText", () => {
  it("strips tags entirely (no allowlist)", () => {
    expect(sanitizePlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
    expect(sanitizePlainText('<img src=x onerror=alert(1)>text')).toBe("text");
    expect(sanitizePlainText('<script>alert("xss")</script>safe')).toBe('alert("xss") safe');
  });

  it("decodes the small entity set", () => {
    expect(sanitizePlainText("Fish &amp; Chips")).toBe("Fish & Chips");
    expect(sanitizePlainText("&lt;not a tag&gt;")).toBe("<not a tag>");
  });

  it("collapses whitespace, drops controls, caps length", () => {
    expect(sanitizePlainText("  too\n\n   much\t whitespace  ")).toBe("too much whitespace");
    expect(sanitizePlainText("ab").length).toBeLessThanOrEqual(3);
    expect(sanitizePlainText("x".repeat(5000), 100).length).toBe(100);
  });

  it("detects markup", () => {
    expect(containsMarkup("plain text")).toBe(false);
    expect(containsMarkup("<b>bold</b>")).toBe(true);
  });
});

describe("isSafeExternalUrl", () => {
  it("accepts https and rejects http/credentials/junk", () => {
    expect(isSafeExternalUrl("https://example.com/story")).toBe(true);
    expect(isSafeExternalUrl("http://example.com/story")).toBe(false);
    expect(isSafeExternalUrl("https://user:pass@example.com/")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
  });
});
