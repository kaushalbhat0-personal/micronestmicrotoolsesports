import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { handleRouteError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseBgmiStore } from "@/features/bgmi-tournaments/repositories/store";
import {
  SUPPORTED_STAGE_KEYS,
  TOURNAMENT_CATALOG,
  getCatalogEntry,
  ingestTournamentStage,
  type SupportedStageKey,
} from "@/features/bgmi-tournaments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BGMI_TOURNAMENTS_JOB_ID = "bgmi-tournaments-ingest";

const ingestQuerySchema = z.object({
  tournament: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default("bmsd-2026"),
  stage: z.enum(SUPPORTED_STAGE_KEYS).default("grand-finals"),
  /**
   * Comma-separated stage override for manual backfill, e.g.
   * `?tournament=bmsd-2026&stages=playoffs,grand-finals`.
   * Each value is still restricted to the adapter's supported keys.
   */
  stages: z.string().optional(),
});

function resolveStages(single: SupportedStageKey, csv: string | undefined): SupportedStageKey[] {
  if (!csv) return [single];
  const keys = csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (SUPPORTED_STAGE_KEYS as readonly string[]).includes(s));
  const unique = [...new Set(keys)] as SupportedStageKey[];
  return unique.length > 0 ? unique : [single];
}

/**
 * BGMI Tournament Hub ingestion — one entry point per catalogued stage.
 * GitHub Actions (daily) → Bearer <CRON_SECRET> → Liquipedia API →
 * parse → validate (all-or-nothing) → publish → ledger.
 *
 * Query/body carry only the catalogued tournament + stage selectors.
 * No organization input (global catalogue) and no arbitrary URLs —
 * the adapter resolves selectors against TOURNAMENT_CATALOG.
 */
async function handler(request: Request) {
  const cronRunId = randomUUID();
  try {
    assertCronAuth(request);

    const url = new URL(request.url);
    const params = parseOrThrow(ingestQuerySchema, {
      tournament: url.searchParams.get("tournament") ?? undefined,
      stage: url.searchParams.get("stage") ?? undefined,
      stages: url.searchParams.get("stages") ?? undefined,
    });
    const stages = resolveStages(params.stage, params.stages);

    // Fail fast on unknown catalog entries before touching any store.
    if (!getCatalogEntry(params.tournament)) {
      return NextResponse.json(
        {
          ok: false,
          job: BGMI_TOURNAMENTS_JOB_ID,
          tournament: params.tournament,
          catalog: TOURNAMENT_CATALOG.map((e) => ({ slug: e.slug, stages: [...e.stages] })),
          attempted: 0,
          failed: 1,
          outcomes: [
            {
              tournamentSlug: params.tournament,
              stageSlug: params.stage,
              outcome: "failed",
              error: `Unknown tournament: ${params.tournament}`,
            },
          ],
        },
        { status: 200 }
      );
    }

    const supabase = createAdminClient();
    const store = createSupabaseBgmiStore(supabase);

    const outcomes = [];
    for (const stageKey of stages) {
      const report = await ingestTournamentStage({
        store,
        tournamentSlug: params.tournament,
        stageKey,
        runId: `${cronRunId}:${stageKey}`,
      });
      outcomes.push(report);
      console.warn(
        JSON.stringify({
          event: "bgmi_tournaments_ingest_completed",
          cronRunId,
          tournament: report.tournamentSlug,
          stage: report.stageSlug,
          outcome: report.outcome,
          teams: report.teamsCount,
          completed: report.matchesCompleted,
          sourceRevision: report.sourceRevision,
        })
      );
    }

    const failed = outcomes.filter((o) => o.outcome === "failed");
    return NextResponse.json(
      {
        ok: failed.length === 0,
        job: BGMI_TOURNAMENTS_JOB_ID,
        tournament: params.tournament,
        catalog: TOURNAMENT_CATALOG.map((e) => ({ slug: e.slug, stages: [...e.stages] })),
        attempted: outcomes.length,
        failed: failed.length,
        outcomes,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
