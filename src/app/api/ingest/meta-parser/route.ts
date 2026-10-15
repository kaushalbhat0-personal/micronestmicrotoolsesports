import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { handleRouteError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCronRunComplete, recordCronRunStart } from "@/server/cron/run-ledger";
import {
  dota2Adapter,
} from "@/features/meta-parser/adapters/dota-2/adapter";
import { getAdapter, registerAdapter } from "@/features/meta-parser/adapters/registry";
import { createSupabaseMetaParserStore } from "@/features/meta-parser/repositories/store";
import { ingestGamePatches } from "@/features/meta-parser/services/ingest";

import { META_PARSER_JOB_ID } from "@/features/meta-parser/services/job-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKFILL_MAX = 5;

const ingestQuerySchema = z.object({
  game: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default("dota-2"),
  backfill: z.coerce.number().int().min(1).max(BACKFILL_MAX).optional(),
});

// Ensure the Dota adapter is registered exactly once per runtime.
registerAdapter(dota2Adapter);

/**
 * Meta-Parser ingestion — single entry point for every game adapter.
 * GitHub Actions → Bearer <CRON_SECRET> → discover/diff/fetch/parse/upsert.
 * Query/body carry only the game selector and bounded backfill depth.
 * No organization input is accepted (global catalog ingestion).
 */
async function handler(request: Request) {
  const cronRunId = randomUUID();
  try {
    assertCronAuth(request);

    try {
      await recordCronRunStart(META_PARSER_JOB_ID, cronRunId);
    } catch {
      // ledger write failure is non-fatal
    }

    const url = new URL(request.url);
    const params = parseOrThrow(ingestQuerySchema, {
      game: url.searchParams.get("game") ?? undefined,
      backfill: url.searchParams.get("backfill") ?? undefined,
    });

    const adapter = getAdapter(params.game);
    if (!adapter) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: `No adapter registered for game: ${params.game}` } },
        { status: 404 }
      );
    }

    const supabase = createAdminClient();
    const store = createSupabaseMetaParserStore(supabase);
    const report = await ingestGamePatches({
      adapter,
      store,
      gameSlug: params.game,
      ...(params.backfill !== undefined ? { backfillLatestN: params.backfill } : {}),
    });

    console.warn(
      JSON.stringify({
        event: "meta_parser_ingest_completed",
        cronRunId,
        game: params.game,
        attempted: report.attempted,
        inserted: report.inserted,
        revised: report.revised,
        failed: report.failed,
        parserVersion: report.parserVersion,
        adapterVersion: report.adapterVersion,
        viaFallback: report.viaFallback,
      })
    );

    try {
      await recordCronRunComplete(cronRunId, report.failed === 0);
    } catch {
      // non-fatal
    }

    return NextResponse.json(
      {
        ok: report.failed === 0,
        game: report.gameSlug,
        attempted: report.attempted,
        inserted: report.inserted,
        unchanged: report.unchanged,
        revised: report.revised,
        failed: report.failed,
        outcomes: report.outcomes,
        parserVersion: report.parserVersion,
        adapterVersion: report.adapterVersion,
        viaFallback: report.viaFallback,
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
