import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppBaseUrl, getOAuthCallbackUrl } from "./callback";

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("getAppBaseUrl", () => {
  beforeEach(() => {
    // Clean relevant env
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("Case 1 — Explicit production URL", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://micronestmicrotoolsesports.vercel.app" });
    expect(getAppBaseUrl()).toBe("https://micronestmicrotoolsesports.vercel.app");
    expect(getOAuthCallbackUrl("twitch")).toBe("https://micronestmicrotoolsesports.vercel.app/api/auth/twitch/callback");
  });

  it("Case 2 — Empty explicit URL with VERCEL_PROJECT_PRODUCTION_URL", () => {
    setEnv({
      NEXT_PUBLIC_APP_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "micronestmicrotoolsesports.vercel.app",
    });
    expect(getAppBaseUrl()).toBe("https://micronestmicrotoolsesports.vercel.app");
  });

  it("Case 3 — Vercel production URL absent, fallback to VERCEL_URL", () => {
    setEnv({
      NEXT_PUBLIC_APP_URL: "",
      APP_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "",
      VERCEL_URL: "some-preview.vercel.app",
    });
    expect(getAppBaseUrl()).toBe("https://some-preview.vercel.app");
  });

  it("Case 4 — No URL configuration", () => {
    setEnv({
      NEXT_PUBLIC_APP_URL: "",
      APP_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "",
      VERCEL_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
    });
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("Case 5 — Trailing slash normalization", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://micronestmicrotoolsesports.vercel.app///" });
    expect(getAppBaseUrl()).toBe("https://micronestmicrotoolsesports.vercel.app");
  });

  it("Case 6 — Bare hostname", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "micronestmicrotoolsesports.vercel.app" });
    expect(getAppBaseUrl()).toBe("https://micronestmicrotoolsesports.vercel.app");
  });

  it("does not use Supabase URL when Vercel URL available", () => {
    setEnv({
      NEXT_PUBLIC_APP_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "micronestmicrotoolsesports.vercel.app",
      NEXT_PUBLIC_SUPABASE_URL: "https://knniommcyyhbyiwljisk.supabase.co",
    });
    expect(getAppBaseUrl()).toBe("https://micronestmicrotoolsesports.vercel.app");
    expect(getAppBaseUrl()).not.toContain("supabase.co");
  });
});
