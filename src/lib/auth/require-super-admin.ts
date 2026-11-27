// Session-bound super-admin gate (P15-M2B.4).
// Authority: public.is_super_admin() — platform_admins ∩ active app_users.
// No caller-supplied user id. No client role flags.

import type { SupabaseClient } from "@supabase/supabase-js";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenSuperAdminError extends Error {
  constructor() {
    super("Not allowed.");
    this.name = "ForbiddenSuperAdminError";
  }
}

export interface SuperAdminContext {
  userId: string;
}

/**
 * Verifies authenticated session + is_super_admin() RPC.
 * Call at the start of every reviewer-sensitive server operation.
 */
export async function requireSuperAdmin(
  client: SupabaseClient,
): Promise<SuperAdminContext> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new UnauthenticatedError();
  }

  const { data, error: rpcError } = await client.rpc("is_super_admin");
  if (rpcError || data !== true) {
    throw new ForbiddenSuperAdminError();
  }

  return { userId: user.id };
}
