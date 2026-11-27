import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as scanRepo from "@/server/repositories/scans";
import {
  reserveFreeCheckOrThrow,
  mapConsumeFreeCheckError,
} from "./sponsorship-limits";

/**
 * FIX-06 H2: reserveFreeCheckOrThrow routing + error mapping (mocked client).
 * Real-Postgres atomicity is proven in consume-free-check.integration.test.ts;
 * these tests pin routing (paid bypass vs RPC), arg minimality, and mapping.
 */

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();

function mockClient(opts: {
  member?: boolean;
  orgGrant?: boolean;
  userGrant?: { source: string; expires_at: string | null } | null;
  rpcRow?: Record<string, unknown> | null;
  rpcError?: { code: string; message: string } | null;
}) {
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const rpc = vi.fn(async (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args });
    if (fn === "consume_free_check") {
      if (opts.rpcError) return { data: null, error: opts.rpcError };
      return { data: opts.rpcRow ?? { id: "scan-new" }, error: null };
    }
    if (fn === "has_tool_access") return { data: !!opts.orgGrant, error: null };
    return { data: null, error: { message: "unknown fn" } };
  });
  const from = vi.fn((table: string) => {
    const self: Record<string, unknown> = {};
    const terminal = async () => {
      if (table === "tools") return { data: { id: TOOL_ID, slug: "sponsor-sentinel", is_active: true }, error: null };
      if (table === "organization_members")
        return { data: opts.member === false ? null : { id: "m1" }, error: null };
      if (table === "user_tool_entitlements") return { data: opts.userGrant ?? null, error: null };
      return { data: null, error: null };
    };
    self.select = () => self;
    self.eq = () => self;
    self.order = () => self;
    self.limit = () => self;
    self.or = () => self;
    self.in = () => self;
    self.gte = () => self;
    self.single = terminal;
    self.maybeSingle = terminal;
    self.then = (resolve: (v: unknown) => void) => {
      if (table === "tool_entitlements") resolve({ data: opts.orgGrant ? [{ is_all_access: false, tool_id: TOOL_ID, expires_at: null }] : [], error: null });
      else if (table === "sponsor_campaigns") resolve({ data: [], error: null });
      else if (table === "connected_channels") resolve({ data: [], error: null });
      else if (table === "scans") resolve({ data: [], error: null });
      else if (table === "organizations") resolve({ data: null, error: null });
      else resolve({ data: [], error: null });
    };
    return self;
  });
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, rpcCalls, rpc };
}

const BASE = {
  userId: "user-1",
  organizationId: "org-a",
  campaignId: "camp-1",
  platform: "twitch" as const,
  scannerVersion: "test-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(scanRepo, "tryCreateScanWithLock").mockResolvedValue({ id: "scan-direct" } as never);
});

describe("reserveFreeCheckOrThrow routing", () => {
  it("paid user bypasses the RPC via the existing direct path", async () => {
    const { client, rpcCalls } = mockClient({ userGrant: { source: "subscription", expires_at: FUTURE } });
    const res = await reserveFreeCheckOrThrow(client, BASE);
    expect(res.freePath).toBe(false);
    expect(res.scan.id).toBe("scan-direct");
    expect(scanRepo.tryCreateScanWithLock).toHaveBeenCalledTimes(1);
    expect(rpcCalls.some((c) => c.fn === "consume_free_check")).toBe(false);
  });

  it("All Access org bypasses the RPC (no metering, no lock)", async () => {
    const { client, rpcCalls } = mockClient({ orgGrant: true, userGrant: { source: "free", expires_at: null } });
    const res = await reserveFreeCheckOrThrow(client, BASE);
    expect(res.freePath).toBe(false);
    expect(rpcCalls.some((c) => c.fn === "consume_free_check")).toBe(false);
  });

  it("free user calls the RPC with minimal authoritative inputs only", async () => {
    const { client, rpcCalls } = mockClient({
      userGrant: { source: "free", expires_at: null },
      rpcRow: { id: "scan-rpc", status: "pending" },
    });
    const res = await reserveFreeCheckOrThrow(client, BASE);
    expect(res.freePath).toBe(true);
    expect(res.scan.id).toBe("scan-rpc");
    const rpcCall = rpcCalls.find((c) => c.fn === "consume_free_check");
    expect(rpcCall).toBeDefined();
    // Minimal inputs: identity + location + scan params. No usage, plan,
    // source, flags, or quota results accepted from callers.
    expect(Object.keys(rpcCall!.args as Record<string, unknown>).sort()).toEqual(
      ["p_campaign_id", "p_organization_id", "p_platform", "p_scanner_version", "p_user_id"].sort(),
    );
    expect(scanRepo.tryCreateScanWithLock).not.toHaveBeenCalled();
  });

  it("no coverage → throws without touching the RPC", async () => {
    const { client, rpcCalls } = mockClient({ userGrant: null });
    await expect(reserveFreeCheckOrThrow(client, BASE)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(rpcCalls.some((c) => c.fn === "consume_free_check")).toBe(false);
  });

  it("no membership → throws without touching the RPC", async () => {
    const { client, rpcCalls } = mockClient({ member: false, userGrant: { source: "free", expires_at: null } });
    await expect(reserveFreeCheckOrThrow(client, BASE)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(rpcCalls.some((c) => c.fn === "consume_free_check")).toBe(false);
  });
});

describe("mapConsumeFreeCheckError", () => {
  it("SFQ01 → checks quota error (existing customer copy)", () => {
    const e = mapConsumeFreeCheckError({ code: "SFQ01", message: "quota_exceeded:budget: x" });
    expect(e).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((e as Error).message).toMatch(/10 free checks/);
  });

  it("SFQ02 → covered error", () => {
    const e = mapConsumeFreeCheckError({ code: "SFQ02", message: "quota_exceeded:covered: x" });
    expect(e).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((e as Error).message).toMatch(/isn't covered by Free/);
  });

  it("SFD01 → CONFLICT already_running (existing shape)", () => {
    const e = mapConsumeFreeCheckError({ code: "SFD01", message: "already_running: x" });
    expect(e).toMatchObject({ code: "CONFLICT", status: 409 });
    expect((e as Error).message).toMatch(/already running/);
  });

  it("SFN01 → denial (covered kind, customer-safe)", () => {
    const e = mapConsumeFreeCheckError({ code: "SFN01", message: "no_access: x" });
    expect(e).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((e as Error).message).toMatch(/isn't active for your workspace/);
  });

  it("unknown errors rethrow untouched (fail closed upstream)", () => {
    const boom = new Error("connection reset");
    expect(mapConsumeFreeCheckError(boom)).toBe(boom);
  });
});
