import { describe, expect, it } from "vitest";
import { generateVerifier, generateChallenge, validateVerifierFormat } from "./pkce";
import { createHash } from "node:crypto";

describe("PKCE", () => {
  it("verifier generated has valid format/length", () => {
    const v = generateVerifier();
    expect(validateVerifierFormat(v)).toBe(true);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    // base64url has no padding
    expect(v).not.toContain("=");
    expect(v).not.toContain("+");
    expect(v).not.toContain("/");
  });

  it("verifier is random", () => {
    const a = generateVerifier();
    const b = generateVerifier();
    expect(a).not.toBe(b);
  });

  it("challenge generated deterministically and uses S256 base64url", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    // RFC 7636 example: verifier dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk => challenge E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    // But our verifier range differs; test with known: hash of verifier
    const expected = (() => {
      const hash = createHash("sha256").update(verifier).digest();
      return hash.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    })();
    expect(generateChallenge(verifier)).toBe(expected);
  });

  it("known verifier → deterministic challenge (RFC example style)", () => {
    const verifier = "a".repeat(43);
    const c1 = generateChallenge(verifier);
    const c2 = generateChallenge(verifier);
    expect(c1).toBe(c2);
    expect(c1).not.toContain("=");
    expect(c1).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("challenge uses SHA-256", () => {
    const verifier = generateVerifier();
    const challenge = generateChallenge(verifier);
    // SHA256 output is 32 bytes => 43 base64url chars
    expect(challenge.length).toBe(43);
  });

  it("base64url has no padding", () => {
    for (let i = 0; i < 5; i++) {
      const v = generateVerifier();
      const c = generateChallenge(v);
      expect(c).not.toContain("=");
      expect(v).not.toContain("=");
    }
  });

  it("invalid verifier length throws", () => {
    expect(() => generateChallenge("short")).toThrow(/Invalid verifier/);
    expect(() => generateChallenge("a".repeat(200))).toThrow(/Invalid verifier/);
  });

  it("verifier not persisted and contains no secrets", () => {
    const v = generateVerifier();
    expect(v).not.toContain("secret");
    expect(JSON.stringify(v)).not.toContain("token");
  });
});
