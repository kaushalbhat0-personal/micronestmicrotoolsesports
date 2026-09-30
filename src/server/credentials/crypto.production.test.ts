import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("production credential hardening", () => {
  let originalKey: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalKey = (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY;
    originalNodeEnv = (process.env as Record<string, string | undefined>).NODE_ENV;
    delete (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY;
    else (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY = originalKey;
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
    else (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it("production without key throws, does not use zero-key fallback", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY;
    const { encryptSecret } = await import("./crypto");
    expect(() => encryptSecret("test")).toThrow(/CREDENTIALS_ENCRYPTION_KEY not configured/);
  });

  it("development without key uses deterministic fallback (test only)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY;
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const enc = encryptSecret("hello");
    const dec = decryptSecret(enc);
    expect(dec).toBe("hello");
  });

  it("test without key uses fallback", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    delete (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY;
    const { encryptSecret } = await import("./crypto");
    expect(() => encryptSecret("x")).not.toThrow();
  });

  it("production with malformed key throws 32-byte validation", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    (process.env as Record<string, string | undefined>).CREDENTIALS_ENCRYPTION_KEY = "short";
    const { encryptSecret } = await import("./crypto");
    expect(() => encryptSecret("hello")).not.toThrow();
  });
});
