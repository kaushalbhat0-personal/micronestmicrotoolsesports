import { describe, it, expect } from "vitest";
import { passwordSchema, resetPasswordSchema } from "./index";

describe("password validation 8-72", () => {
  it("rejects <8", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
  });
  it("accepts 8", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });
  it("rejects >72", () => {
    const long = "a".repeat(73);
    expect(passwordSchema.safeParse(long).success).toBe(false);
  });
  it("accepts 72", () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
  });
  it("mismatch fails", () => {
    const r = resetPasswordSchema.safeParse({ password: "12345678", confirmPassword: "different" });
    expect(r.success).toBe(false);
  });
  it("match passes", () => {
    const r = resetPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345678" });
    expect(r.success).toBe(true);
  });
});
