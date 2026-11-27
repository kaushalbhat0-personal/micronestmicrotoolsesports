import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  BootstrapError,
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import { ensureAppUser } from "../server/ensure-app-user";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

interface FakeRpcResult {
  data: Array<{ id: string; status: string }> | null;
  error: { message: string } | null;
}

function fakeClient(opts: {
  sessionUserId?: string | null;
  sessionError?: boolean;
  rpc?: FakeRpcResult | ((calls: number) => FakeRpcResult);
  onRpc?: () => void;
}): { client: SupabaseClient; rpcCalls: () => number } {
  let calls = 0;
  const resolveRpc = (): FakeRpcResult =>
    typeof opts.rpc === "function"
      ? (opts.rpc as (calls: number) => FakeRpcResult)(calls)
      : (opts.rpc ?? {
          data: [{ id: SESSION_USER_ID, status: "active" }],
          error: null,
        });
  const client = {
    auth: {
      getUser: vi.fn(async () => {
        if (opts.sessionError || opts.sessionUserId === null) {
          return {
            data: { user: null },
            error: { message: "Auth session missing" },
          };
        }
        return {
          data: { user: { id: opts.sessionUserId ?? SESSION_USER_ID } },
          error: null,
        };
      }),
    },
    rpc: vi.fn(async () => {
      calls += 1;
      opts.onRpc?.();
      return resolveRpc();
    }),
  };
  return {
    client: client as unknown as SupabaseClient,
    rpcCalls: () => calls,
  };
}

describe("ensureAppUser — authentication (02 §3, 08 T2)", () => {
  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("rejects session lookup failures", async () => {
    const { client } = fakeClient({ sessionError: true });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("derives identity exclusively from the session", async () => {
    const { client } = fakeClient({});
    const appUser = await ensureAppUser(client);
    expect(appUser).toEqual({ id: SESSION_USER_ID, status: "active" });
  });

  it("accepts no caller-supplied user ID (session wins by construction)", () => {
    // The operation signature carries no identity parameter: there is no
    // body/query/state value that could override auth.uid().
    expect(ensureAppUser.length).toBe(1);
  });
});

describe("ensureAppUser — bootstrap (D-G1-01)", () => {
  it("creates exactly one row on first invocation", async () => {
    const { client, rpcCalls } = fakeClient({});
    const appUser = await ensureAppUser(client);
    expect(rpcCalls()).toBe(1);
    expect(appUser).toEqual({ id: SESSION_USER_ID, status: "active" });
  });

  it("returns the existing row on repeated invocation", async () => {
    const { client, rpcCalls } = fakeClient({});
    const first = await ensureAppUser(client);
    const second = await ensureAppUser(client);
    expect(rpcCalls()).toBe(2);
    expect(second).toEqual(first);
  });

  it("treats RPC failures as recoverable", async () => {
    const { client } = fakeClient({
      rpc: { data: null, error: { message: "connection reset" } },
    });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(BootstrapError);
  });

  it("treats an empty result as recoverable (retryable)", async () => {
    const { client } = fakeClient({ rpc: { data: [], error: null } });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(BootstrapError);
  });

  it("treats an ambiguous result as a failure, never a guess", async () => {
    const { client } = fakeClient({
      rpc: {
        data: [
          { id: SESSION_USER_ID, status: "active" },
          { id: SESSION_USER_ID, status: "active" },
        ],
        error: null,
      },
    });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(BootstrapError);
  });

  it("fails closed when the returned row is not the session identity", async () => {
    // Even a compromised return path cannot initialize another identity.
    const { client } = fakeClient({
      rpc: { data: [{ id: OTHER_USER_ID, status: "active" }], error: null },
    });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(BootstrapError);
  });
});

describe("ensureAppUser — account status (D-G1-01/D-G1-02)", () => {
  it("blocks suspended accounts with a generic error", async () => {
    const { client } = fakeClient({
      rpc: { data: [{ id: SESSION_USER_ID, status: "suspended" }], error: null },
    });
    const failure = await ensureAppUser(client).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SuspendedError);
    const message = (failure as Error).message;
    expect(message).toBe("Account unavailable. Contact support if this persists.");
    // No enumeration: the message carries no status, id, or reason.
    expect(message).not.toContain("suspended");
    expect(message).not.toContain(SESSION_USER_ID);
  });

  it("blocks unknown statuses (fail closed)", async () => {
    const { client } = fakeClient({
      rpc: { data: [{ id: SESSION_USER_ID, status: "deleted-pending" }], error: null },
    });
    await expect(ensureAppUser(client)).rejects.toBeInstanceOf(SuspendedError);
  });

  it("returns a minimal identity (no reason, timestamps, or flags)", async () => {
    const { client } = fakeClient({});
    expect(await ensureAppUser(client)).toEqual({
      id: SESSION_USER_ID,
      status: "active",
    });
  });
});
