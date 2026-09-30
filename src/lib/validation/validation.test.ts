import { describe, it, expect } from "vitest";
import { isSafeRedirect } from "./index";

describe("isSafeRedirect", () => {
  it("allows safe internal paths", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("/dashboard/123")).toBe(true);
  });

  it("rejects external and protocol-relative", () => {
    expect(isSafeRedirect("https://evil.com")).toBe(false);
    expect(isSafeRedirect("//evil.com")).toBe(false);
    expect(isSafeRedirect("http://example.com")).toBe(false);
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect(undefined)).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
  });

  it("rejects path with ://", () => {
    expect(isSafeRedirect("/redirect://evil")).toBe(false);
  });
});
