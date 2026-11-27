// Owner workspace writer (P14-D6) — VALIDATION + GATE + RPC contracts.
// WORKSPACE_WRITES_ENABLED gates Teams create/settings only (not organizer,
// tournament, moderation, or news). Below the gate, mutations go through
// SECURITY DEFINER RPCs only (create_team / update_team_settings) — never
// direct table INSERT/UPDATE from the browser client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAppUser } from "@/features/player-profile/server/ensure-app-user";
import {
  WORKSPACE_WRITES_ENABLED,
  WorkspaceDisabledError,
  WorkspaceOperationError,
  WorkspaceValidationError,
} from "../domain/workspace";
import {
  createTeamInputSchema,
  updateTeamSettingsSchema,
  type CreateTeamInput,
  type UpdateTeamSettingsInput,
} from "../schemas/workspace";

/** Re-export for existing imports; source of truth is domain/workspace.ts. */
export { WORKSPACE_WRITES_ENABLED };

function isDisabled(): boolean {
  return !WORKSPACE_WRITES_ENABLED;
}

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

function isPostgrestError(value: unknown): value is PostgrestErrorLike {
  return typeof value === "object" && value !== null && ("code" in value || "message" in value);
}

export function parseCreateTeamInput(input: unknown): CreateTeamInput {
  try {
    return createTeamInputSchema.parse(input);
  } catch {
    throw new WorkspaceValidationError();
  }
}

export function parseUpdateTeamSettingsInput(input: unknown): UpdateTeamSettingsInput {
  try {
    return updateTeamSettingsSchema.parse(input);
  } catch {
    throw new WorkspaceValidationError();
  }
}

export async function createTeamOp(
  client: SupabaseClient,
  input: unknown,
): Promise<{ id: string; slug: string }> {
  const parsed = parseCreateTeamInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new WorkspaceDisabledError();
  }
  // --- Below the gate (acceptance sequence only) ---
  const { data, error } = await client.rpc("create_team", {
    p_slug: parsed.slug,
    p_name: parsed.name,
    p_game_key: parsed.gameKey,
    p_region_code: parsed.regionCode,
    p_current_level: parsed.currentLevel,
    p_target_level: parsed.targetLevel,
    p_description: parsed.description ?? null,
    p_recruiting: parsed.recruiting,
    p_is_public: parsed.isPublic,
  });
  if (error) {
    if (isPostgrestError(error) && (error.code === "23505" || /slug conflict/i.test(error.message ?? ""))) {
      throw new WorkspaceValidationError();
    }
    throw new WorkspaceOperationError();
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof (row as { id?: unknown }).id !== "string" ||
    typeof (row as { slug?: unknown }).slug !== "string"
  ) {
    throw new WorkspaceOperationError();
  }
  return row as { id: string; slug: string };
}

export async function updateTeamSettingsOp(
  client: SupabaseClient,
  input: unknown,
): Promise<{ id: string }> {
  const parsed = parseUpdateTeamSettingsInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new WorkspaceDisabledError();
  }
  // --- Below the gate (acceptance sequence only) ---
  const { data, error } = await client.rpc("update_team_settings", {
    p_team_id: parsed.teamId,
    p_name: parsed.patch.name,
    p_region_code: parsed.patch.regionCode,
    p_current_level: parsed.patch.currentLevel,
    p_target_level: parsed.patch.targetLevel,
    p_description: parsed.patch.description ?? null,
    p_recruiting: parsed.patch.recruiting,
    p_is_public: parsed.patch.isPublic,
  });
  if (error || !data) {
    throw new WorkspaceOperationError();
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof (row as { id?: unknown }).id !== "string") {
    throw new WorkspaceOperationError();
  }
  return row as { id: string };
}
