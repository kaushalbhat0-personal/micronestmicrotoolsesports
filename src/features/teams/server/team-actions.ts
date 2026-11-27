// Teams server actions (P14-D3) — validate + call gated writer.
// "use server" files may only export async functions.
"use server";

import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import {
  WORKSPACE_DISABLED_MESSAGE,
  WorkspaceDisabledError,
  WorkspaceOperationError,
  WorkspaceValidationError,
  type WorkspaceActionState,
} from "@/features/teams/domain/workspace";
import {
  parseCreateTeamForm,
  parseUpdateTeamSettingsForm,
} from "@/features/teams/server/form-parsers";
import { createTeamOp, updateTeamSettingsOp } from "@/features/teams/server/workspace-writer";
import { createClient } from "@/lib/supabase/server";

export async function createTeamAction(
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { ok: false, message: new UnauthenticatedError().message };
  }

  const record: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    record[key] = value;
  }
  const parsed = parseCreateTeamForm(record);
  if (!parsed.ok || parsed.value === undefined) {
    return { ok: false, message: parsed.message ?? "Check the highlighted fields and try again." };
  }

  try {
    await createTeamOp(client, parsed.value);
    return { ok: true, message: "Team created." };
  } catch (error) {
    if (error instanceof WorkspaceDisabledError) {
      return { ok: false, message: WORKSPACE_DISABLED_MESSAGE };
    }
    if (error instanceof WorkspaceValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    if (error instanceof WorkspaceOperationError) {
      return { ok: false, message: "Could not save team changes. Please retry." };
    }
    return { ok: false, message: "Could not save team changes. Please retry." };
  }
}

export async function updateTeamSettingsAction(
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { ok: false, message: new UnauthenticatedError().message };
  }

  const rawId = formData.get("team_id");
  if (typeof rawId !== "string" || rawId.trim() === "") {
    return { ok: false, message: "Missing team reference. Please retry." };
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    record[key] = value;
  }
  const parsed = parseUpdateTeamSettingsForm(rawId, record);
  if (!parsed.ok || parsed.value === undefined) {
    return { ok: false, message: parsed.message ?? "Check the highlighted fields and try again." };
  }

  try {
    await updateTeamSettingsOp(client, parsed.value);
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    if (error instanceof WorkspaceDisabledError) {
      return { ok: false, message: WORKSPACE_DISABLED_MESSAGE };
    }
    if (error instanceof WorkspaceValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    if (error instanceof WorkspaceOperationError) {
      return { ok: false, message: "Could not save team changes. Please retry." };
    }
    return { ok: false, message: "Could not save team changes. Please retry." };
  }
}
