import { describe, it, expect, vi, beforeEach } from "vitest";

// These are code-level/static tests that verify authorization semantics
// without requiring a live Supabase instance. They mock the Supabase client
// and auth layer to simulate anonymous, non-admin, and super-admin callers.
// Full RLS integration tests would require a local Supabase DB.

const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

vi.mock("./get-user", () => ({
  requireUser: vi.fn(async () => {
    const r = mockGetUser();
    if (r instanceof Error) throw r;
    return r;
  }),
  getCurrentUser: vi.fn(async () => {
    const r = mockGetUser();
    if (r instanceof Error) return null;
    return r;
  }),
}));

import { requireSuperAdmin, isSuperAdmin } from "./require-super-admin";
import { requireUser } from "./get-user";

describe("requireSuperAdmin — platform authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A. Anonymous user → 401 (authenticationError)", async () => {
    const { authenticationError } = await import("@/lib/errors");
    mockGetUser.mockImplementation(() => {
      throw authenticationError();
    });
    await expect(requireSuperAdmin()).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("B. Authenticated non-admin → 403", async () => {
    mockGetUser.mockResolvedValue({ id: "user-2", email: "user@example.com" });
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(requireSuperAdmin()).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(mockRpc).toHaveBeenCalledWith("is_super_admin");
  });

  it("B. RPC error → 403 (do not leak DB details)", async () => {
    mockGetUser.mockResolvedValue({ id: "user-2", email: "user@example.com" });
    mockRpc.mockResolvedValue({ data: null, error: { message: "db exploded" } });
    await expect(requireSuperAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    // ensure original DB message not exposed in safeMessage
    try {
      await requireSuperAdmin();
    } catch (e) {
      const err = e as { safeMessage: string; message: string };
      expect(err.safeMessage).not.toContain("db exploded");
    }
  });

  it("C. Super Admin → succeeds and returns user", async () => {
    const user = { id: "admin-1", email: "admin@micronest.example" };
    mockGetUser.mockResolvedValue(user);
    mockRpc.mockResolvedValue({ data: true, error: null });
    const result = await requireSuperAdmin();
    expect(result).toEqual(user);
  });

  it("isSuperAdmin() returns false for non-admin", async () => {
    mockGetUser.mockResolvedValue({ id: "user-2" });
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await isSuperAdmin()).toBe(false);
  });

  it("isSuperAdmin() returns true for admin", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await isSuperAdmin()).toBe(true);
  });

  it("does not use email, env, or organization slug", async () => {
    const content = await import("node:fs").then((fs) => fs.readFileSync("src/lib/auth/require-super-admin.ts", "utf8"));
    expect(content).not.toMatch(/NEXT_PUBLIC/);
    expect(content).not.toMatch(/@micronest/i);
    // ensure no orgSlug param
    expect(content).not.toMatch(/orgSlug/);
    expect(content).toContain("is_super_admin");
    expect(content).toContain("auth.uid");
  });

  it("uses auth.uid()-based RPC, not user-controlled userId param", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/lib/auth/require-super-admin.ts", "utf8");
    // RPC should be called without args; auth.uid() inside SQL
    expect(content).toContain('rpc("is_super_admin")');
    expect(content).not.toMatch(/rpc\("is_super_admin",.*user_id/i);
  });
});
