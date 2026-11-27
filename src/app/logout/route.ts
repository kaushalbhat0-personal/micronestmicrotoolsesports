import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clears the Supabase auth cookie session and returns to home.
export async function POST(request: Request) {
  const client = await createClient();
  await client.auth.signOut();
  const url = new URL("/", request.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  return POST(request);
}
