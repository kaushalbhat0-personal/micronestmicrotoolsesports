// Organizer workspace boundary copy (P9). Imported by the gated server
// actions AND by client components. Lives outside actions.ts because
// "use server" modules may only export async functions.

export interface OrganizerWorkspaceActionState {
  ok: boolean;
  message: string;
}

export const ORGANIZER_WORKSPACE_DISABLED_MESSAGE =
  "Organizer publishing is disabled in this phase: organizer ownership, verification and tournament moderation boundaries are awaiting decisions. Nothing was saved.";
