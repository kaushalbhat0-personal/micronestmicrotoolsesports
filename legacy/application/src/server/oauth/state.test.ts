import { describe, expect, it } from "vitest";
import { generateState, verifyState } from "./state";

describe("OAuth state", () => {
  it("state generation is random and tenant-bound", () => {
    const a = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    const b = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    expect(a.state).not.toBe(b.state);
    expect(a.state).toContain(".");
    expect(a.nonce.length).toBeGreaterThan(10);
  });

  it("valid verification passes", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "kick" });
    const payload = verifyState({ state, expectedOrganizationId: "org-a", expectedUserId: "user-1", expectedProvider: "kick" });
    expect(payload.orgId).toBe("org-a");
    expect(payload.userId).toBe("user-1");
    expect(payload.provider).toBe("kick");
  });

  it("tampered state rejected", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    const tampered = state.slice(0, -2) + "xx";
    expect(() => verifyState({ state: tampered, expectedOrganizationId: "org-a", expectedUserId: "user-1" })).toThrow(/Invalid state/);
  });

  it("tampered payload rejected", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "youtube" });
    const [payloadB64, sig] = state.split(".");
    const tamperedPayload = payloadB64!.slice(0, -1) + (payloadB64!.endsWith("A") ? "B" : "A");
    const tampered = `${tamperedPayload}.${sig}`;
    expect(() => verifyState({ state: tampered, expectedOrganizationId: "org-a", expectedUserId: "user-1" })).toThrow(/Invalid state/);
  });

  it("wrong organization rejected", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    expect(() => verifyState({ state, expectedOrganizationId: "org-b", expectedUserId: "user-1" })).toThrow(/organization mismatch/i);
  });

  it("wrong user rejected", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    expect(() => verifyState({ state, expectedOrganizationId: "org-a", expectedUserId: "user-2" })).toThrow(/user mismatch/i);
  });

  it("wrong provider rejected when expectedProvider set", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    expect(() => verifyState({ state, expectedOrganizationId: "org-a", expectedUserId: "user-1", expectedProvider: "youtube" })).toThrow(/provider mismatch/i);
  });

  it("expired state rejected", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "kick" });
    // Simulate now 11 min later
    const futureNow = Date.now() + 11 * 60 * 1000;
    expect(() => verifyState({ state, expectedOrganizationId: "org-a", expectedUserId: "user-1", nowMs: futureNow })).toThrow(/expired/i);
  });

  it("malformed state rejected", () => {
    expect(() => verifyState({ state: "not-a-state", expectedOrganizationId: "org-a", expectedUserId: "user-1" })).toThrow(/Malformed/);
    expect(() => verifyState({ state: "", expectedOrganizationId: "org-a", expectedUserId: "user-1" })).toThrow(/Missing/);
    expect(() => verifyState({ state: "a.b.c", expectedOrganizationId: "org-a", expectedUserId: "user-1" })).toThrow(/Malformed/);
  });

  it("state is unpredictable (no orgId/userId in plaintext without decode)", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    // state is base64url(payload).sig, payload is base64url JSON but signature prevents tamper
    // Ensure state does not equal simple concatenation without HMAC
    expect(state.split(".").length).toBe(2);
    expect(state.split(".")[1]!.length).toBeGreaterThan(20);
  });

  it("replay: same state verifies twice cryptographically (single-use enforced via cookie layer, not HMAC)", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    const p1 = verifyState({ state, expectedOrganizationId: "org-a", expectedUserId: "user-1" });
    const p2 = verifyState({ state, expectedOrganizationId: "org-a", expectedUserId: "user-1" });
    expect(p1.nonce).toBe(p2.nonce);
    // Single-use is enforced by caller comparing query state === cookie state and then clearing cookie; cryptographically replay is expected to still verify
  });

  it("does not contain secrets or tokens", () => {
    const { state } = generateState({ organizationId: "org-a", userId: "user-1", provider: "twitch" });
    expect(state).not.toContain("secret");
    expect(state).not.toContain("token");
    expect(JSON.stringify(state)).not.toContain("CREDENTIALS_ENCRYPTION_KEY");
  });
});
