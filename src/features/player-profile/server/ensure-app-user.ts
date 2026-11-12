// Lazy application-user bootstrap (G1-1 server operation).
// Authoritative: 02 §3, 07 §1 (`ensureAppUser`), 11 §3 (D-G1-01/D-G1-02).
//
// Security posture (frozen):
// - Server-side only. Call sites must be Route Handlers / Server Actions
//   holding the AUTHENTICATED OWNER client (never service-role, never the
//   browser client). Middleware never calls this; no automatic writes happen
//   merely because a page renders (onboarding wires it explicitly in G1-7).
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`). This function accepts NO user ID argument, so
//   a caller-supplied ID from body/query/state cannot override identity.
// - The INSERT + re-select run in ONE transaction inside the SECURITY
//   INVOKER function public.ensure_app_user() (see migration
//   20261110000003_g1_identity_anchor.sql). Concurrent calls serialize on the
//   PK and converge on exactly one row via ON CONFLICT DO NOTHING.
// - Suspended accounts never pass: a `suspended` row yields SuspendedError
//   with a generic message (no enumeration).
// - All failures are recoverable: UnauthenticatedError (sign in),
//   BootstrapError (retry), SuspendedError (support path). The missing-row
//   state simply means "onboarding required".

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppUser,
  BootstrapError,
  SuspendedError,
  UnauthenticatedError,
  isAppUserStatus,
} from "../domain/app-user";

interface EnsureAppUserRow {
  id: string;
  status: string;
}

export async function ensureAppUser(
  client: SupabaseClient,
): Promise<AppUser> {
  // 1. Verified session identity — the ONLY identity authority (02 §3).
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  // 2. Atomic lazy bootstrap: INSERT ... ON CONFLICT DO NOTHING + re-select
  // in one transaction. No identity parameter (auth.uid() inside).
  const { data, error } = await client.rpc("ensure_app_user");
  if (error) {
    throw new BootstrapError();
  }
  const rows = (data ?? []) as EnsureAppUserRow[];
  if (rows.length !== 1 || typeof rows[0]?.id !== "string") {
    // Empty or ambiguous result: initialization did not converge — retryable.
    throw new BootstrapError();
  }
  const row = rows[0] as EnsureAppUserRow;

  // 3. Defense in depth: the function can only return the caller's own row
  // via RLS, but a mismatch here fails closed instead of crossing identity.
  if (row.id !== user.id) {
    throw new BootstrapError();
  }

  // 4. Account-status gate (02 §2, 11 §3): suspended never passes.
  // Re-select already returned the fresh row, so a suspension that landed
  // between any two steps is still enforced here.
  if (!isAppUserStatus(row.status) || row.status !== "active") {
    throw new SuspendedError();
  }

  // 5. Minimal safe identity (no reason/timestamps/flags leave G1-1).
  return { id: row.id, status: "active" };
}
