// D1 admin/audit helper tests.
import { describe, expect, it } from "vitest";
import {
  findForbiddenAuditKey,
  isUuid,
  isValidAdminAction,
  isValidTargetType,
  projectAuditRecord,
  requireAdminReason,
} from "./audit";

describe("admin audit primitives", () => {
  it("validates action shape", () => {
    expect(isValidAdminAction("platform_admin.grant")).toBe(true);
    expect(isValidAdminAction("Bad Action")).toBe(false);
  });
  it("validates target type", () => {
    expect(isValidTargetType("team")).toBe(true);
    expect(isValidTargetType("x")).toBe(false);
  });
  it("requires reason length", () => {
    expect(() => requireAdminReason("hey")).toThrow();
    expect(requireAdminReason("  grant for oncall  ")).toBe("grant for oncall");
  });
  it("detects forbidden keys without storing secrets", () => {
    expect(findForbiddenAuditKey({ password_hash: "x" }, null)).toBe("password_hash");
    expect(findForbiddenAuditKey({ ok: 1 }, { nested: { api_key: 1 } })).toBe("nested.api_key");
    expect(findForbiddenAuditKey({ ok: 1 }, null)).toBeNull();
  });
  it("projects safely with caps", () => {
    const p = projectAuditRecord({ a: "x", password: "y", big: "z".repeat(500) });
    expect(p.entries.some((e) => e.key === "password")).toBe(false);
    expect(p.truncatedValues).toBe(1);
  });
  it("validates uuids", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
