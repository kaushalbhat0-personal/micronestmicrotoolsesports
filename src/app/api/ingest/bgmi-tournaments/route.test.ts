import { describe, expect, it, vi, beforeEach } from "vitest";
import { forbiddenError } from "@/lib/errors";

vi.mock("@/server/cron/cron-auth", () => ({
  assertCronAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/features/bgmi-tournaments/repositories/store", () => ({
  createSupabaseBgmiStore: vi.fn(() => ({})),
}));
vi.mock("@/features/bgmi-tournaments/services/ingest", () => ({
  ingestTournamentStage: vi.fn(),
}));

import { assertCronAuth } from "@/server/cron/cron-auth";
import { ingestTournamentStage } from "@/features/bgmi-tournaments/services/ingest";
import { GET } from "./route";

const CRON_SECRET = "test-secret-1234567890";

describe("GET /api/ingest/bgmi-tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("rejects unauthenticated calls without running ingestion", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {
      throw forbiddenError("Invalid cron secret");
    });
    const response = await GET(new Request("https://example.com/api/ingest/bgmi-tournaments"));
    expect([401, 403]).toContain(response.status);
    expect(vi.mocked(ingestTournamentStage)).not.toHaveBeenCalled();
  });

  it("rejects unknown tournaments before touching any store", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    const response = await GET(
      new Request("https://example.com/api/ingest/bgmi-tournaments?tournament=nope-2026&stage=grand-finals", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; outcomes: Array<{ outcome: string }> };
    expect(body.ok).toBe(false);
    expect(body.outcomes[0]?.outcome).toBe("failed");
    expect(vi.mocked(ingestTournamentStage)).not.toHaveBeenCalled();
  });

  it("runs per-stage ingestion and reports outcomes", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    vi.mocked(ingestTournamentStage).mockResolvedValue({
      tournamentSlug: "bmsd-2026",
      stageSlug: "grand-finals",
      outcome: "unchanged",
      teamsCount: 16,
      matchesCompleted: 18,
      matchesTotal: 18,
      sourceRevision: 720523,
      warnings: [],
    });
    const response = await GET(
      new Request("https://example.com/api/ingest/bgmi-tournaments?tournament=bmsd-2026&stage=grand-finals", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; outcomes: Array<{ outcome: string }> };
    expect(body.ok).toBe(true);
    expect(body.outcomes[0]).toMatchObject({ tournamentSlug: "bmsd-2026", stageSlug: "grand-finals" });
  });

  it("supports multi-stage dispatch with per-stage isolation", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    vi.mocked(ingestTournamentStage)
      .mockResolvedValueOnce({
        tournamentSlug: "bmsd-2026",
        stageSlug: "playoffs",
        outcome: "inserted",
        teamsCount: 16,
        matchesCompleted: 18,
        matchesTotal: 18,
        sourceRevision: 720523,
        warnings: [],
      })
      .mockResolvedValueOnce({
        tournamentSlug: "bmsd-2026",
        stageSlug: "grand-finals",
        outcome: "failed",
        teamsCount: 0,
        matchesCompleted: 0,
        matchesTotal: 0,
        sourceRevision: null,
        warnings: [],
        error: "parse/validate failed: boom",
      });
    const response = await GET(
      new Request("https://example.com/api/ingest/bgmi-tournaments?tournament=bmsd-2026&stages=playoffs,grand-finals", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    const body = (await response.json()) as { ok: boolean; attempted: number; failed: number };
    expect(body.ok).toBe(false);
    expect(body.attempted).toBe(2);
    expect(body.failed).toBe(1);
  });

  it("dispatches bmps-2026 last-chance through the shared pipeline (BMPS Phase 1)", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    vi.mocked(ingestTournamentStage).mockResolvedValue({
      tournamentSlug: "bmps-2026",
      stageSlug: "last-chance",
      outcome: "unchanged",
      teamsCount: 16,
      matchesCompleted: 12,
      matchesTotal: 12,
      sourceRevision: 721389,
      warnings: [],
    });
    const response = await GET(
      new Request("https://example.com/api/ingest/bgmi-tournaments?tournament=bmps-2026&stage=last-chance", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; outcomes: Array<{ tournamentSlug: string; stageSlug: string }> };
    expect(body.ok).toBe(true);
    expect(body.outcomes[0]).toMatchObject({ tournamentSlug: "bmps-2026", stageSlug: "last-chance" });
  });

  it("rejects unregistered stage keys before ingestion (semi-finals is Phase 2)", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => undefined);
    const response = await GET(
      new Request("https://example.com/api/ingest/bgmi-tournaments?tournament=bmps-2026&stage=semi-finals", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(response.status).toBe(400);
    expect(vi.mocked(ingestTournamentStage)).not.toHaveBeenCalled();
  });
});
