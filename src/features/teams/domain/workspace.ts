// Owner workspace contract (P2).
// The workspace is the authenticated counterpart to the public directory:
// it shows the caller the teams they own or are authorized to manage, and
// explains the permission basis for each. Nothing here carries applicant
// PII, ownership internals beyond the caller's own basis, or organization
// authority (D1-D4: org membership never implies team authority).
//
// Management basis (proposed matrix `02`, AWAITING approval):
// - "owner": session user matches team owner_user_id/created_by. Full
//   editable-field scope; appoint/revoke captain + transfer stay unavailable
//   (no RPC, D1-D3/D1-D10 pending).
// - "captain": member row role='captain'. Same editable-field scope;
//   co-captain has NO rights and never resolves to captain here.
// - "member": any other membership. Read-only overview + roster.

export interface WorkspaceActionState {
  ok: boolean;
  message: string;
}

/**
 * Teams write kill switch (P14-D6). Server-enforced in workspace-writer;
 * mirrored here so client UI can render the correct boundary without importing
 * server modules. Not env/client controllable — change this constant only.
 * Scope: team create + settings only.
 */
export const WORKSPACE_WRITES_ENABLED: boolean = true;

export const WORKSPACE_DISABLED_MESSAGE =
  "Team changes are disabled: writes are gated off. Nothing was saved.";

export const WORKSPACE_WRITES_HINT =
  "Slug, game and ownership stay locked after creation. Roster invites and ownership transfer are not available yet.";

export const WORKSPACE_ROLES = ["owner", "captain", "member"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export interface ManagedTeam {
  id: string;
  slug: string;
  name: string;
  game_key: string;
  region_code: string;
  description: string | null;
  current_level: string;
  target_level: string;
  recruiting: boolean;
  is_public: boolean;
  member_count: number;
  /** The caller's own management basis for this team. Never another user's. */
  role: WorkspaceRole;
}

export interface RosterMemberView {
  /** Opaque row key (server-derived user id, used as React key only — never rendered). */
  key: string;
  role: string;
  game_role: string | null;
  is_self: boolean;
}

// Domain errors: server operations throw these, never raw PostgREST detail.
// Messages are generic by design (no existence oracle, no enumeration).
export class WorkspaceValidationError extends Error {
  constructor() {
    super("Invalid workspace input.");
    this.name = "WorkspaceValidationError";
  }
}

export class WorkspaceOperationError extends Error {
  constructor() {
    super("Could not load your workspace. Please retry.");
    this.name = "WorkspaceOperationError";
  }
}

// Thrown BEFORE any database touch while persistent writes are gated
// (migration acceptance + D1-D3/D1-D10 pending). The message states the
// boundary instead of faking success.
export class WorkspaceDisabledError extends Error {
  constructor() {
    super("Team changes are disabled in this phase: the team database is awaiting acceptance and owner approval.");
    this.name = "WorkspaceDisabledError";
  }
}
