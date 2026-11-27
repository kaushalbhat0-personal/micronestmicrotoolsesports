// Organizer workspace reader (P9).
// Session-bound reads for the authenticated organizer workspace. Unlike the
// public directory reader (identity-free, RPC-only), these operations derive
// the caller from the verified session and read the caller's own rows through
// base-table RLS policies (owner/member select — local, UNAPPLIED). No RPC
// pair exists for managed reads; no new RPC is invented.
//
// Security posture (mirrors P2 teams workspace):
// - Server-side only. Call-site injects the authenticated session client
//   (never service-role). No `next/headers` import here.
// - Identity comes EXCLUSIVELY from `client.auth.getUser()` via
//   ensureAppUser. No function accepts a user ID argument.
// - Explicit column lists (no `select *`). Other users' owner identity never
//   leaves this boundary: outputs carry only the caller's own management
//   basis (`role`) plus organizer/tournament fields.
// - Suspended callers fail via SuspendedError (generic message). Missing or
//   invisible organizers/tournaments resolve to null (404-equivalence).
// - Errors are generic domain errors (never raw PostgREST detail to UI).

import type { SupabaseClient } from "@supabase/supabase-js";
import { SuspendedError, UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { ensureAppUser } from "@/features/player-profile/server/ensure-app-user";
import {
  OrganizerDirectoryOperationError,
  OrganizerDirectoryValidationError,
} from "../domain/organizer";
import {
  isOrganizerRole,
  isOrganizerTournamentLifecycle,
  type OrganizerRole,
  type OrganizerTournamentLifecycle,
} from "../domain/permissions";
import { managedTournamentIdSchema } from "../schemas/manage";
import { organizerSlugSchema } from "../schemas/directory";

export interface ManagedOrganizer {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly regionCode: string;
  readonly organizerType: string;
  readonly gameKeys: string[];
  readonly trustState: string;
  readonly role: OrganizerRole;
}

export interface ManagedTournament {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly organizerId: string;
  readonly lifecycle: OrganizerTournamentLifecycle;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly role: OrganizerRole;
}

const MANAGED_ORGANIZER_COLUMNS = "id,slug,name,region_code,organizer_type,game_keys,trust_state";

const MANAGED_TOURNAMENT_COLUMNS = "id,slug,title,organizer_id,lifecycle,starts_at,ends_at";

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

async function requireActiveSessionUserId(client: SupabaseClient): Promise<string> {
  const appUser = await ensureAppUser(client).catch((error: unknown) => {
    throw error;
  });
  return appUser.id;
}

interface MembershipRow {
  organizer_id: unknown;
  role: unknown;
}

async function readMembership(
  client: SupabaseClient,
  organizerId: string,
  sessionUserId: string
): Promise<MembershipRow | undefined> {
  const { data, error } = await client
    .from("organizer_members")
    .select("organizer_id,role")
    .eq("organizer_id", organizerId)
    .eq("user_id", sessionUserId)
    .limit(1);
  if (error) {
    throw new OrganizerDirectoryOperationError();
  }
  const rows = (data ?? []) as MembershipRow[];
  return rows[0];
}

// List the organizer profiles the caller owns or administers (RLS-scoped).
// Bounded: at most 50 rows.
export async function listManagedOrganizers(client: SupabaseClient): Promise<ManagedOrganizer[]> {
  const sessionUserId = await requireActiveSessionUserId(client);

  const { data, error } = await client
    .from("organizers")
    .select(MANAGED_ORGANIZER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new OrganizerDirectoryOperationError();
  }
  const rows = ((data ?? []) as Array<Record<string, unknown>>).slice();
  const managed: ManagedOrganizer[] = [];
  for (const row of rows) {
    if (
      !isUuid(row["id"]) ||
      typeof row["slug"] !== "string" ||
      typeof row["name"] !== "string" ||
      typeof row["region_code"] !== "string" ||
      typeof row["organizer_type"] !== "string" ||
      !Array.isArray(row["game_keys"]) ||
      typeof row["trust_state"] !== "string"
    ) {
      throw new OrganizerDirectoryOperationError();
    }
    const organizerId = row["id"] as string;
    const membership = await readMembership(client, organizerId, sessionUserId);
    const role = membership?.role;
    if (!isOrganizerRole(role)) {
      continue;
    }
    managed.push({
      id: organizerId,
      slug: row["slug"] as string,
      name: row["name"] as string,
      regionCode: row["region_code"] as string,
      organizerType: row["organizer_type"] as string,
      gameKeys: (row["game_keys"] as string[]).slice(),
      trustState: row["trust_state"] as string,
      role,
    });
  }
  return managed;
}

// List tournaments the caller may manage across their organizers (RLS-scoped).
export async function listManagedTournaments(
  client: SupabaseClient,
  organizerId: unknown
): Promise<ManagedTournament[]> {
  if (typeof organizerId !== "string" || !isUuid(organizerId)) {
    throw new OrganizerDirectoryValidationError();
  }
  const parsedId: string = organizerId;
  const sessionUserId = await requireActiveSessionUserId(client);
  const membership = await readMembership(client, parsedId, sessionUserId);
  if (!isOrganizerRole(membership?.role)) {
    return [];
  }
  const role = membership?.role as OrganizerRole;

  const { data, error } = await client
    .from("tournaments")
    .select(MANAGED_TOURNAMENT_COLUMNS)
    .eq("organizer_id", parsedId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new OrganizerDirectoryOperationError();
  }
  const rows = ((data ?? []) as Array<Record<string, unknown>>).slice();
  const managed: ManagedTournament[] = [];
  for (const row of rows) {
    if (
      !isUuid(row["id"]) ||
      typeof row["slug"] !== "string" ||
      typeof row["title"] !== "string" ||
      typeof row["organizer_id"] !== "string" ||
      !isOrganizerTournamentLifecycle(row["lifecycle"]) ||
      typeof row["starts_at"] !== "string" ||
      typeof row["ends_at"] !== "string"
    ) {
      throw new OrganizerDirectoryOperationError();
    }
    managed.push({
      id: row["id"] as string,
      slug: row["slug"] as string,
      title: row["title"] as string,
      organizerId: row["organizer_id"] as string,
      lifecycle: row["lifecycle"] as OrganizerTournamentLifecycle,
      startsAt: row["starts_at"] as string,
      endsAt: row["ends_at"] as string,
      role,
    });
  }
  return managed;
}

// Load one managed tournament by id. Invisible tournaments resolve to null.
export async function getManagedTournament(
  client: SupabaseClient,
  input: unknown
): Promise<ManagedTournament | null> {
  let tournamentId: string;
  try {
    tournamentId = managedTournamentIdSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
  const sessionUserId = await requireActiveSessionUserId(client);
  const { data, error } = await client
    .from("tournaments")
    .select(MANAGED_TOURNAMENT_COLUMNS)
    .eq("id", tournamentId)
    .limit(1);
  if (error) {
    throw new OrganizerDirectoryOperationError();
  }
  const rows = ((data ?? []) as Array<Record<string, unknown>>).slice();
  if (rows.length !== 1) {
    return null;
  }
  const row = rows[0] as Record<string, unknown>;
  if (typeof row["organizer_id"] !== "string" || !isUuid(row["organizer_id"])) {
    throw new OrganizerDirectoryOperationError();
  }
  const membership = await readMembership(client, row["organizer_id"] as string, sessionUserId);
  if (!isOrganizerRole(membership?.role)) {
    return null;
  }
  if (
    !isUuid(row["id"]) ||
    typeof row["slug"] !== "string" ||
    typeof row["title"] !== "string" ||
    !isOrganizerTournamentLifecycle(row["lifecycle"]) ||
    typeof row["starts_at"] !== "string" ||
    typeof row["ends_at"] !== "string"
  ) {
    throw new OrganizerDirectoryOperationError();
  }
  return {
    id: row["id"] as string,
    slug: row["slug"] as string,
    title: row["title"] as string,
    organizerId: row["organizer_id"] as string,
    lifecycle: row["lifecycle"] as OrganizerTournamentLifecycle,
    startsAt: row["starts_at"] as string,
    endsAt: row["ends_at"] as string,
    role: membership?.role as OrganizerRole,
  };
}

export function parseOrganizerSlugInput(input: unknown): string {
  try {
    return organizerSlugSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
}

export { SuspendedError, UnauthenticatedError };
