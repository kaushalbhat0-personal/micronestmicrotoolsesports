import { NextResponse } from "next/server";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { handleRouteError } from "@/lib/errors";

/**
 * Example cron job — demonstrates pattern for future jobs.
 * - Route: /api/cron/example-job
 * - Auth: Bearer CRON_SECRET
 * - Idempotent, structured logging, safe failure
 *
 * Vercel Cron: add to vercel.json -> { "path": "/api/cron/example-job", "schedule": "0 * * * *" }
 */

export async function GET(request: Request) {
  try {
    assertCronAuth(request);

    // TODO: Replace with real job logic — delegate to server/services/* or server/integrations/*
    const startedAt = Date.now();
    console.warn("[cron:example-job] started", { at: new Date().toISOString() });

    // Simulated idempotent work
    const result = { processed: 0, skipped: 0 };

    console.warn("[cron:example-job] completed", { durationMs: Date.now() - startedAt, result });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Also allow POST for manual triggers (same auth)
export async function POST(request: Request) {
  return GET(request);
}
