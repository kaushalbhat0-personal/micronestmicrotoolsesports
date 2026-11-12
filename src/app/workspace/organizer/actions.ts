// Organizer workspace server actions (P9) — VALIDATION + GATE ONLY.
// Thin orchestration: parse the untrusted form record with the pure
// _lib/forms parsers, confirm a verified session exists, then return the
// disabled-boundary state. The gated writer operations are NEVER called
// while ORGANIZER_WRITES_ENABLED is false — persistence awaits migration
// acceptance + moderation-boundary approval, and no fake success is
// returned: every path that would write resolves to { ok: false } with the
// boundary message.

"use server";

import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { createClient } from "@/lib/supabase/server";
import {
  parseCreateOrganizerForm,
  parseCreateTournamentForm,
  parseUpdateTournamentForm,
} from "./_lib/forms";
import { ORGANIZER_WORKSPACE_DISABLED_MESSAGE } from "./_lib/boundary";
import type { OrganizerWorkspaceActionState } from "./_lib/boundary";

async function requireSession(): Promise<boolean> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user !== null;
}

export async function createOrganizerAction(
  _prev: OrganizerWorkspaceActionState,
  formData: FormData
): Promise<OrganizerWorkspaceActionState> {
  if (!(await requireSession())) {
    return { ok: false, message: new UnauthenticatedError().message };
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    record[key] = value;
  }
  const parsed = parseCreateOrganizerForm(record);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message ?? "Check the highlighted fields and try again." };
  }
  // Validated — but persistence is gated. No writer call, no fake success.
  return { ok: false, message: ORGANIZER_WORKSPACE_DISABLED_MESSAGE };
}

export async function createTournamentDraftAction(
  _prev: OrganizerWorkspaceActionState,
  formData: FormData
): Promise<OrganizerWorkspaceActionState> {
  if (!(await requireSession())) {
    return { ok: false, message: new UnauthenticatedError().message };
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    record[key] = value;
  }
  const parsed = parseCreateTournamentForm(record);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message ?? "Check the highlighted fields and try again." };
  }
  return { ok: false, message: ORGANIZER_WORKSPACE_DISABLED_MESSAGE };
}

export async function updateTournamentDraftAction(
  _prev: OrganizerWorkspaceActionState,
  formData: FormData
): Promise<OrganizerWorkspaceActionState> {
  if (!(await requireSession())) {
    return { ok: false, message: new UnauthenticatedError().message };
  }
  const rawId = formData.get("tournament_id");
  if (typeof rawId !== "string" || rawId.trim() === "") {
    return { ok: false, message: "Missing tournament reference. Please retry." };
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    record[key] = value;
  }
  const parsed = parseUpdateTournamentForm(rawId, record);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message ?? "Check the highlighted fields and try again." };
  }
  return { ok: false, message: ORGANIZER_WORKSPACE_DISABLED_MESSAGE };
}
