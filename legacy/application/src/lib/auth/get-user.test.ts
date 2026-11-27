import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: (...a: unknown[]) => (mockGetUser as (...args: unknown[]) => unknown)(...a) },
  })),
}));

type CodedError = { name?: string; code?: string; safeMessage?: string };

async function freshAuth() {
  // Fresh module per case: getCurrentUser is React-cached, so each case needs
  // its own instance. Note: structural assertions (code/name) are used instead
  // of instanceof because module reloading creates distinct AppError identities.
  vi.resetModules();
  return import("./get-user");
}

function coded(err: unknown): CodedError {
  return err as CodedError;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCurrentUser session classification", () => {
  it("null session (Auth session missing) → null (authentication required)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Auth session missing!", status: 400 } });
    const { getCurrentUser } = await freshAuth();
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("invalid/expired JWT → null (re-login), not a service error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "invalid JWT: unable to parse", status: 401 } });
    const { getCurrentUser } = await freshAuth();
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("no user and no error → null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { getCurrentUser } = await freshAuth();
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("auth transport failure → retryable service error (NOT unauthenticated)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "fetch failed", status: 503 } });
    const { getCurrentUser } = await freshAuth();
    const err = await getCurrentUser().catch((e: unknown) => e);
    expect(coded(err).name).toBe("AppError");
    expect(coded(err).code).toBe("INTEGRATION_ERROR");
    // Customer-safe: raw transport detail stays out of the client message.
    expect(coded(err).safeMessage).not.toContain("fetch failed");
  });

  it("auth server 500 → throws, never returns null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Internal server error", status: 500 } });
    const { getCurrentUser } = await freshAuth();
    const err = await getCurrentUser().catch((e: unknown) => e);
    expect(coded(err).name).toBe("AppError");
    expect(coded(err).code).toBe("INTEGRATION_ERROR");
  });

  it("successful user → unchanged", async () => {
    const user = { id: "u1", email: "a@b.c" };
    mockGetUser.mockResolvedValueOnce({ data: { user }, error: null });
    const { getCurrentUser } = await freshAuth();
    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it("requireUser: null session → AUTHENTICATION_REQUIRED", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Auth session missing!", status: 400 } });
    const { requireUser } = await freshAuth();
    const err = await requireUser().catch((e: unknown) => e);
    expect(coded(err).name).toBe("AppError");
    expect(coded(err).code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("requireUser: transport failure propagates service error (not auth error)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "socket hang up", status: 502 } });
    const { requireUser } = await freshAuth();
    const err = await requireUser().catch((e: unknown) => e);
    expect(coded(err).name).toBe("AppError");
    expect(coded(err).code).toBe("INTEGRATION_ERROR");
  });
});
