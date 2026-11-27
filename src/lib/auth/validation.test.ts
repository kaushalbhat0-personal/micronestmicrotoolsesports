import { describe, expect, it } from "vitest";
import { validateDisplayName, validateEmail, validatePassword } from "./validation";

describe("auth validation (P14-D10)", () => {
  it("accepts valid email addresses and rejects invalid ones", () => {
    expect(validateEmail("captain@example.com").ok).toBe(true);
    expect(validateEmail("").ok).toBe(false);
    expect(validateEmail("not-an-email").ok).toBe(false);
    expect(validateEmail("a@b").ok).toBe(false);
    expect(validateEmail("a b@example.com").ok).toBe(false);
  });

  it("enforces the minimum password length", () => {
    expect(validatePassword("").ok).toBe(false);
    expect(validatePassword("short1").ok).toBe(false);
    expect(validatePassword("longenough1").ok).toBe(true);
  });

  it("enforces display-name bounds", () => {
    expect(validateDisplayName("").ok).toBe(false);
    expect(validateDisplayName("A").ok).toBe(false);
    expect(validateDisplayName("Nova Captain").ok).toBe(true);
    expect(validateDisplayName("x".repeat(61)).ok).toBe(false);
  });
});
