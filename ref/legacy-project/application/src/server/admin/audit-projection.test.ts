import { describe, it, expect } from "vitest";
import { safeAuditProjection } from "./audit-log";

describe("safeAuditProjection — ADMIN-10A security contract", () => {
  it("password-like key omitted", () => {
    const p = safeAuditProjection({ password: "secret123", name: "ok" });
    expect(p.entries.find((e) => e.key === "password")).toBeUndefined();
    expect(p.entries.find((e) => e.key === "name")?.value).toBe("ok");
    expect(p.omitted).toBe(1);
  });

  it("token-like key omitted (access_token, refresh_token, api_key)", () => {
    const p = safeAuditProjection({ access_token: "tok", refresh_token: "r", api_key: "k", keep: "yes" });
    expect(p.entries.length).toBe(1);
    expect(p.entries[0]!.key).toBe("keep");
    expect(p.omitted).toBe(3);
  });

  it("secret-like and client_secret omitted", () => {
    const p = safeAuditProjection({ secret: "s", client_secret: "cs", visible: "v" });
    expect(p.entries.find((e) => e.key === "visible")).toBeDefined();
    expect(p.omitted).toBe(2);
  });

  it("api_key variants omitted (case-insensitive)", () => {
    const p = safeAuditProjection({ API_KEY: "x", Api_Key: "y", safe: "1" });
    expect(p.entries.length).toBe(1);
    expect(p.omitted).toBe(2);
  });

  // helper to avoid strict null checks in test assertions

  it("nested forbidden key omitted", () => {
    const p = safeAuditProjection({ outer: { secret: "hidden" }, safe: "ok" });
    expect(p.entries.find((e) => e.key === "outer")).toBeUndefined();
    expect(p.entries.find((e) => e.key === "safe")).toBeDefined();
    expect(p.omitted).toBe(1);
  });

  it("safe field retained", () => {
    const p = safeAuditProjection({ status: "active", reason: "test" });
    expect(p.entries).toHaveLength(2);
    expect(p.omitted).toBe(0);
    expect(p.empty).toBe(false);
  });

  it("entry limit enforced at 20", () => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) obj[`field${i}`] = `value${i}`;
    const p = safeAuditProjection(obj);
    expect(p.entries.length).toBe(20);
    expect(p.omitted).toBeGreaterThan(0);
  });

  it("value truncation enforced at 200 chars", () => {
    const long = "a".repeat(500);
    const p = safeAuditProjection({ long });
    expect(p.entries[0]!.value.length).toBeLessThanOrEqual(200);
  });

  it("omitted count correct for mixed safe/forbidden", () => {
    const p = safeAuditProjection({ a: "1", password: "x", b: "2", token: "y", c: "3" });
    expect(p.entries.map((e) => e.key)).toEqual(["a", "b", "c"]);
    expect(p.omitted).toBe(2);
  });

  it("empty object returns empty true", () => {
    const p = safeAuditProjection({});
    expect(p.empty).toBe(true);
    expect(p.entries.length).toBe(0);
  });

  it("null returns empty true", () => {
    const p = safeAuditProjection(null);
    expect(p.empty).toBe(true);
    expect(p.entries.length).toBe(0);
  });

  it("service_role and private keys omitted", () => {
    const p = safeAuditProjection({ service_role: "key", private_key: "k", ok: "1" });
    expect(p.entries.length).toBe(1);
    expect(p.omitted).toBe(2);
  });
});
