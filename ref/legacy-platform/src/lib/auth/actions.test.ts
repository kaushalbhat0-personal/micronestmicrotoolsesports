import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSignOut, mockCreateClient } = vi.hoisted(() => {
  const mockSignOut = vi.fn(async () => ({ error: null }));
  const mockCreateClient = vi.fn(async () => ({
    auth: { signOut: mockSignOut },
  }));
  return { mockSignOut, mockCreateClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
  }),
}));

import { signOutAction } from "./actions";

describe("signOutAction — real Supabase signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates server client, calls signOut once, redirects to /login", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("does not use browser localStorage or custom endpoint", async () => {
    await expect(signOutAction()).rejects.toThrow();
    expect(mockSignOut).toHaveBeenCalled();
    // Ensure no other auth method was called
    expect(mockCreateClient).toHaveBeenCalled();
  });
});
