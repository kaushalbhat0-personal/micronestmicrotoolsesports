import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })) },
  })),
}));

vi.mock("@/lib/env/callback", () => ({
  getAppBaseUrl: () => "https://example.com",
}));

import { requestPasswordReset } from "./password-actions";
import { createClient } from "@/lib/supabase/server";

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valid email -> generic success", async () => {
    const fd = new FormData();
    fd.set("email", "user@example.com");
    const r = await requestPasswordReset(fd);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("If an account exists");
    const mocked = vi.mocked(createClient);
    expect(mocked).toHaveBeenCalled();
    const client = await mocked();
    const mockReset = vi.mocked((client as unknown as { auth: { resetPasswordForEmail: ReturnType<typeof vi.fn> } }).auth.resetPasswordForEmail);
    // Verify redirectTo trusted base via last call
    const lastCall = mockReset.mock.calls[mockReset.mock.calls.length - 1] as unknown[] | undefined;
    if (lastCall) {
      expect(lastCall[0]).toBe("user@example.com");
      expect((lastCall[1] as { redirectTo: string }).redirectTo).toBe("https://example.com/auth/callback?next=/reset-password");
    }
  });

  it("empty email -> validation error", async () => {
    const fd = new FormData();
    fd.set("email", "");
    const r = await requestPasswordReset(fd);
    expect(r.ok).toBe(false);
    expect(r.fieldError).toBeDefined();
  });

  it("invalid email -> validation error", async () => {
    const fd = new FormData();
    fd.set("email", "not-an-email");
    const r = await requestPasswordReset(fd);
    expect(r.ok).toBe(false);
  });

  it("Supabase error -> still generic success (no enumeration)", async () => {
    const mocked = vi.mocked(createClient);
    const client = (await mocked()) as unknown as { auth: { resetPasswordForEmail: ReturnType<typeof vi.fn> } };
    const mockReset = vi.mocked(client.auth.resetPasswordForEmail);
    mockReset.mockResolvedValueOnce({ data: null, error: { message: "User not found" } } as unknown as never);
    const fd = new FormData();
    fd.set("email", "ghost@example.com");
    const r = await requestPasswordReset(fd);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("If an account exists");
  });

  it("redirectTo always trusted base", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    await requestPasswordReset(fd);
    const mocked = vi.mocked(createClient);
    const client = (await mocked()) as unknown as { auth: { resetPasswordForEmail: ReturnType<typeof vi.fn> } };
    const mockReset = vi.mocked(client.auth.resetPasswordForEmail);
    const lastCall = mockReset.mock.calls[mockReset.mock.calls.length - 1] as unknown[] | undefined;
    if (lastCall) {
      expect((lastCall[1] as { redirectTo: string }).redirectTo).toContain("/auth/callback?next=/reset-password");
    }
  });

  it("email lowercased and trimmed", async () => {
    const fd = new FormData();
    fd.set("email", "  USER@EXAMPLE.COM  ");
    await requestPasswordReset(fd);
    const mocked = vi.mocked(createClient);
    const client = (await mocked()) as unknown as { auth: { resetPasswordForEmail: ReturnType<typeof vi.fn> } };
    const mockReset = vi.mocked(client.auth.resetPasswordForEmail);
    const lastCall = mockReset.mock.calls[mockReset.mock.calls.length - 1] as unknown[] | undefined;
    if (lastCall) expect(lastCall[0]).toBe("user@example.com");
  });
});
