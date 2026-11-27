import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { recordCronRunComplete, recordCronRunStart } from "@/server/cron/run-ledger";
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
 * Observability mirrors meta-parser: every authenticated invocation writes
 * a best-effort `cron_run_ledger` row (`bgmi-tournaments-ingest`) so the
 * Superadmin health view can attribute last-attempt / last-failure even
 * when the failure happens before any per-stage `bgmi_ingestion_runs` row
 * exists. Scheduler/transport failures (no HTTP call reaches this route)
 * still leave no ledger row — those are visible in Actions run history.
 *
 * Query/body carry only the catalogued tournament + stage selectors.
 * No organization input (global catalogue) and no arbitrary URLs —
 * the adapter resolves selectors against TOURNAMENT_CATALOG.
 */
async function handler(request: Request) {
  const cronRunId = randomUUID();
  try {
    assertCronAuth(request);

    try {
      await recordCronRunStart(BGMI_TOURNAMENTS_JOB_ID, cronRunId);
    } catch {
      // ledger write failure is non-fatal
    }

    const url = new URL(request.url);
    const params = parseOrThrow(ingestQuerySchema, {
      tournament: url.searchParams.get("tournament") ?? undefined,
      stage: url.searchParams.get("stage") ?? undefined,
      stages: url.searchParams.get("stages") ?? undefined,
    });
    const stages = resolveStages(params.stage, params.stages);

    // Fail fast on unknown catalog entries before touching any store.
    if (!getCatalogEntry(params.tournament)) {
      try {
        await recordCronRunComplete(cronRunId, false, `Unknown tournament: ${params.tournament}`.slice(0, 500));
      } catch {
        // ledger write failure is non-fatal
      }
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
    try {
      // Per-stage failures carry an error summary so the ledger (and the
      // Superadmin health view) shows WHAT failed, not just that it failed.
      const failureSummary =
        failed.length === 0
          ? undefined
          : `${failed.length} stage(s) failed: ${failed
              .map((o) => `${o.tournamentSlug}/${o.stageSlug}`)
              .join(", ")}`.slice(0, 500);
      await recordCronRunComplete(cronRunId, failed.length === 0, failureSummary);
    } catch {
      // non-fatal
    }
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
    try {
      await recordCronRunComplete(cronRunId, false, error instanceof Error ? error.message : String(error));
    } catch {
      // non-fatal
    }
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
