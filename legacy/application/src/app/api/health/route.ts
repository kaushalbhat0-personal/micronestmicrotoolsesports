import { NextResponse } from "next/server";

/**
 * Health check — no auth, no DB dependency.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString(), service: "micronest" },
    { status: 200 }
  );
}
