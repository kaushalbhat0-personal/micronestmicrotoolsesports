import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronLedgerSummaries, type CronJobLedgerSummary } from "@/server/cron/run-ledger";
import { META_PARSER_JOB_ID, metaParserJobIdForGame } from "@/features/meta-parser/services/job-id";
import { getPatch, listPatches } from "@/features/meta-parser/repositories/reads";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Meta-Parser ingestion health — read-only Superadmin observability.
 *
 * AUDIT SUMMARY (RCCF-SUPERADMIN-META-PARSER-HEALTH-01, Phase A):
 * - Scheduler: GitHub Actions `meta-parser-ingest.yml`, daily 07:00 UTC,
 *   matrix over dota-2/valorant/lol → POST /api/ingest/meta-parser?game=<slug>.
 *   NOT a Vercel cron (vercel.json has only sentinel jobs).
 * - Run state: `cron_run_ledger` keyed by job_id. The ingestion route wrote a
 *   SINGLE job id (`META_PARSER_JOB_ID`) for all three games, so per-game
 *   last-attempt / last-failure attribution did not exist.
 * - Failed attempts leave NO patch trace: `ingestOnePatch` failures produce
 *   report outcomes only (compensation deletes provisional rows; the
 *   `parse_failed` status is never written by the pipeline).
 * - Successful no-op runs (no new patch upstream) also leave no patch trace,
 *   so `meta_parser_patches.updated_at` measures last *mutation*, not last
 *   successful *run*. Health must therefore come from the ledger, not patches.
 * - Latest published patch + change count: `listPatches`/`getPatch` in
 *   repositories/reads.ts already enforce the publication gate
 *   (status='complete' AND content_hash<>'') and the exact indexed count.
 *   Reused here with the service-role client so the health view reports
 *   exactly what readers see. No duplicate queries, no new state.
 * - NO MIGRATION: per-game observability uses the existing `cron_run_ledger`
 *   table with the pre-existing `metaParserJobIdForGame` keys (the route now
 *   writes them; the ledger reader already aggregates arbitrary job ids).
 *
 * HEALTH RULES (documented, scheduler-derived — not arbitrary):
 * - The scheduler runs DAILY, so a healthy source shows a successful tracked
 *   run within META_PARSER_HEALTHY_WINDOW_HOURS (48h = one missed/skipped run
 *   + UTC-boundary timing headroom). Older than that → stale, never failed.
 * - `failed` ONLY when the latest tracked per-game attempt failed with no
 *   newer success. A stale success is stale, not failed.
 * - "No new patch" is NOT failure: health is driven by run freshness, never
 *   by whether the patch version changed. A game with an old patch and a
 *   recent successful (no-op) run is healthy.
 * - Bootstrap fallback: before per-game ledger rows exist, freshness falls
 *   back to the legacy single-id ledger success (continuous history). The
 *   legacy row is NEVER attributed per-game for run/failure display — that
 *   would be cross-game contamination.
 */

export const META_PARSER_HEALTH_GAMES = [
  { slug: "dota-2", name: "Dota 2" },
  { slug: "valorant", name: "VALORANT" },
  { slug: "lol", name: "League of Legends" },
] as const;

export type MetaParserGameSlug = (typeof META_PARSER_HEALTH_GAMES)[number]["slug"];

/** Daily scheduler → success expected within 48h (one miss + timing headroom). */
export const META_PARSER_HEALTHY_WINDOW_HOURS = 48;

export type MetaParserSourceStatus = "healthy" | "stale" | "failed" | "no-data";

export type MetaParserRunStatus = "running" | "succeeded" | "failed";

export interface MetaParserGameHealth {
  readonly slug: string;
  readonly name: string;
  readonly status: MetaParserSourceStatus;
  /** Machine-stable reason code; the UI maps it to human text. */
  readonly statusReason: string;
  readonly latestPatch: string | null;
  readonly latestPatchPublishedAt: string | null;
  readonly changeCount: number | null;
  /** Last successful tracked ingestion (per-game, else legacy scheduler row). */
  readonly lastSuccessAt: string | null;
  /** Latest per-game attempt only — legacy global rows are never attributed. */
  readonly lastRunAt: string | null;
  readonly lastRunStatus: MetaParserRunStatus | null;
  readonly lastFailureAt: string | null;
  readonly lastFailureSummary: string | null;
  readonly error?: string | undefined;
}

export interface MetaParserHealthResult {
  /** Deterministic scheduler-matrix order — never DB order. */
  readonly games: readonly MetaParserGameHealth[];
  readonly healthyCount: number;
  readonly totalSources: number;
}

export interface MetaParserStatusInput {
  readonly lastRunStatus: MetaParserRunStatus | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly hasPublishedPatch: boolean;
  readonly hasAnyRun: boolean;
  readonly nowMs: number;
}

/**
 * Pure health determination. Never throws; unparseable timestamps behave as
 * absent (no success evidence → stale/no-data, never healthy, never failed).
 */
export function determineMetaParserStatus(input: MetaParserStatusInput): {
  status: MetaParserSourceStatus;
  reason: string;
} {
  const successMs = input.lastSuccessAt !== null ? Date.parse(input.lastSuccessAt) : Number.NaN;
  const failureMs = input.lastFailureAt !== null ? Date.parse(input.lastFailureAt) : Number.NaN;
  const hasSuccess = Number.isFinite(successMs);
  const hasFailure = Number.isFinite(failureMs);

  // The latest tracked attempt failed and no newer success exists.
  if (input.lastRunStatus === "failed" && hasFailure && (!hasSuccess || failureMs >= successMs)) {
    return { status: "failed", reason: hasSuccess ? "last-run-failed" : "last-run-failed-no-success" };
  }
  // Nothing ever tracked and nothing published.
  if (!input.hasAnyRun && !input.hasPublishedPatch) {
    return { status: "no-data", reason: "no-runs-no-patch" };
  }
  // Tracked runs/patches exist but no successful run on record.
  if (!hasSuccess) {
    return { status: "no-data", reason: "no-success" };
  }
  const ageHours = (input.nowMs - successMs) / 3_600_000;
  if (ageHours <= META_PARSER_HEALTHY_WINDOW_HOURS) {
    return {
      status: "healthy",
      reason: input.lastRunStatus === "running" ? "run-in-progress" : "recent-success",
    };
  }
  return { status: "stale", reason: "success-too-old" };
}

interface GameLedgerView {
  lastRunAt: string | null;
  lastRunStatus: MetaParserRunStatus | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureSummary: string | null;
  hasAnyRun: boolean;
}

function toLedgerView(summary: CronJobLedgerSummary | null): GameLedgerView {
  const empty: GameLedgerView = {
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureSummary: null,
    hasAnyRun: false,
  };
  if (!summary) return empty;
  return {
    lastRunAt: summary.lastRun?.startedAt ?? null,
    lastRunStatus: (summary.lastRun?.status as MetaParserRunStatus | undefined) ?? null,
    lastSuccessAt: summary.lastSuccess?.startedAt ?? null,
    lastFailureAt: summary.lastFailure?.startedAt ?? null,
    lastFailureSummary: summary.lastFailure?.errorSummary ?? null,
    hasAnyRun: summary.lastRun !== null || (summary.totalRuns ?? 0) > 0,
  };
}

async function loadGameHealth(
  admin: SupabaseClient,
  game: (typeof META_PARSER_HEALTH_GAMES)[number],
  perGame: CronJobLedgerSummary | null,
  legacy: CronJobLedgerSummary | null,
  nowMs: number
): Promise<MetaParserGameHealth> {
  const view = toLedgerView(perGame);
  const legacySuccessAt = legacy?.lastSuccess?.startedAt ?? null;
  // Freshness fallback only — run/failure display stays strictly per-game.
  const lastSuccessAt = view.lastSuccessAt ?? legacySuccessAt;

  let latestPatch: string | null = null;
  let latestPatchPublishedAt: string | null = null;
  let changeCount: number | null = null;
  let patchError: string | undefined;
  try {
    const patches = await listPatches(admin, game.slug);
    const latest = patches[0] ?? null;
    if (latest) {
      const header = await getPatch(admin, game.slug, latest.patchVersion);
      if (header) {
        latestPatch = header.patchVersion;
        latestPatchPublishedAt = header.sourcePublishedAt;
        changeCount = header.changeCount;
      }
    }
  } catch {
    patchError = "Patch data unavailable.";
  }

  const { status, reason } = determineMetaParserStatus({
    lastRunStatus: view.lastRunStatus,
    lastSuccessAt,
    lastFailureAt: view.lastFailureAt,
    hasPublishedPatch: latestPatch !== null,
    hasAnyRun: view.hasAnyRun || legacySuccessAt !== null,
    nowMs,
  });

  return {
    slug: game.slug,
    name: game.name,
    status,
    statusReason: reason,
    latestPatch,
    latestPatchPublishedAt,
    changeCount,
    lastSuccessAt,
    lastRunAt: view.lastRunAt,
    lastRunStatus: view.lastRunStatus,
    lastFailureAt: view.lastFailureAt,
    lastFailureSummary: view.lastFailureSummary,
    ...(patchError !== undefined ? { error: patchError } : {}),
  };
}

/**
 * Read-only Meta-Parser health for Superadmin. requireSuperAdmin before
 * service_role; per-game failures are isolated so one game's outage never
 * masks the others. Bounded queries only: one ledger fetch for the fixed
 * game keys + one latest-patch row + one indexed change count per game.
 */
export async function getMetaParserHealth(nowIso?: string): Promise<MetaParserHealthResult> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const nowMs = nowIso !== undefined ? Date.parse(nowIso) : Date.now();

  const jobIds = [...META_PARSER_HEALTH_GAMES.map((game) => metaParserJobIdForGame(game.slug)), META_PARSER_JOB_ID];
  let summaries: CronJobLedgerSummary[] = [];
  try {
    summaries = await getCronLedgerSummaries(jobIds);
  } catch {
    summaries = [];
  }
  const byJob = new Map(summaries.map((summary) => [summary.jobId, summary] as const));
  const legacy = byJob.get(META_PARSER_JOB_ID) ?? null;

  const games: MetaParserGameHealth[] = [];
  for (const game of META_PARSER_HEALTH_GAMES) {
    try {
      games.push(await loadGameHealth(admin, game, byJob.get(metaParserJobIdForGame(game.slug)) ?? null, legacy, nowMs));
    } catch {
      games.push({
        slug: game.slug,
        name: game.name,
        status: "no-data",
        statusReason: "unavailable",
        latestPatch: null,
        latestPatchPublishedAt: null,
        changeCount: null,
        lastSuccessAt: null,
        lastRunAt: null,
        lastRunStatus: null,
        lastFailureAt: null,
        lastFailureSummary: null,
        error: "Health data unavailable.",
      });
    }
  }

  return {
    games,
    healthyCount: games.filter((game) => game.status === "healthy").length,
    totalSources: META_PARSER_HEALTH_GAMES.length,
  };
}
