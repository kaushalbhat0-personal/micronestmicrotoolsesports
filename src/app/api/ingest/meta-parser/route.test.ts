import { describe, expect, it, vi, beforeEach } from "vitest";
import { forbiddenError } from "@/lib/errors";

vi.mock("@/server/cron/cron-auth", () => ({
  assertCronAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock("@/server/cron/run-ledger", () => ({
  recordCronRunStart: vi.fn(),
  recordCronRunComplete: vi.fn(),
}));
vi.mock("@/features/meta-parser/services/ingest", () => ({
  ingestGamePatches: vi.fn(),
}));
vi.mock("@/features/meta-parser/repositories/store", () => ({
  createSupabaseMetaParserStore: vi.fn(() => ({})),
}));

import { assertCronAuth } from "@/server/cron/cron-auth";
import { ingestGamePatches } from "@/features/meta-parser/services/ingest";
import { GET, POST } from "./route";

const CRON_SECRET = "test-secret-1234567890";

describe("meta-parser ingest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("rejects missing auth without leaking the secret", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {
      throw forbiddenError("Invalid cron secret");
    });
    const res = await GET(new Request("https://example.com/api/ingest/meta-parser", { headers: {} }));
    expect([401, 403]).toContain(res.status);
    expect(await res.text()).not.toContain(CRON_SECRET);
  });

  it("returns 404 for unregistered games (MLBB has no adapter)", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    const res = await GET(
      new Request("https://example.com/api/ingest/meta-parser?game=mobile-legends", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(res.status).toBe(404);
    expect(vi.mocked(ingestGamePatches)).not.toHaveBeenCalled();
  });

  it("rejects backfill depth above the bound", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    const res = await GET(
      new Request("https://example.com/api/ingest/meta-parser?game=dota-2&backfill=99", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(res.status).toBe(400);
    expect(vi.mocked(ingestGamePatches)).not.toHaveBeenCalled();
  });

  it("runs the shared pipeline for dota-2 and reports outcomes", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    vi.mocked(ingestGamePatches).mockResolvedValue({
      gameSlug: "dota-2",
      attempted: 1,
      inserted: 1,
      unchanged: 0,
      revised: 0,
      failed: 0,
      outcomes: [{ version: "7.41", outcome: "inserted", changeCount: 12 }],
      parserVersion: "dotaconstants-structured.1",
      adapterVersion: "dota-2.1",
      viaFallback: false,
    });
    const res = await POST(
      new Request("https://example.com/api/ingest/meta-parser?game=dota-2", {
        method: "POST",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(1);
    expect(body.parserVersion).toBe("dotaconstants-structured.1");
    expect(body.adapterVersion).toBe("dota-2.1");
    expect(body.viaFallback).toBe(false);
  });
});
