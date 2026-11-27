import { describe, it, expect } from "vitest";
import { serverSchema, clientSchema } from "./schema";

describe("env validation", () => {
  it("rejects missing SUPABASE_URL", () => {
    const result = serverSchema.safeParse({
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "key",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid server env", () => {
    const result = serverSchema.safeParse({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NODE_ENV: "test",
    });
    expect(result.success).toBe(true);
  });

  it("validates client env", () => {
    const result = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid client url", () => {
    const result = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(result.success).toBe(false);
  });
});
