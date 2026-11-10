import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Finder — data access, one file for all Finder tables.
 *
 * Thin queries only: no auth checks, no business rules. Callers pass an
 * RLS-aware client (server client for user reads, admin client for review
 * flows after requireSuperAdmin). Never accept user_id from untrusted
 * input — derive it from auth.uid() at the service boundary.
 */

export interface FinderProfileRow {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  region: string;
  languages: string[];
  timezone: string | null;
  current_level: string;
  target_level: string;
  primary_role: string;
  secondary_roles: string[];
  availability: string[];
  looking_for: boolean;
  open_to_tryout: boolean;
  bio: string | null;
  allow_indexing: boolean;
  is_searchable: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinderGameProfileRow {
  id: string;
  user_id: string;
  game: string;
  ign: string;
  character_id: string;
  verification_status: string;
  verification_method: string | null;
  verified_at: string | null;
  evidence_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinderVerificationSubmissionRow {
  id: string;
  user_id: string;
  game_profile_id: string;
  evidence_path: string;
  status: string;
  reason_code: string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinderTeamRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  game: string;
  region: string;
  description: string | null;
  current_level: string;
  target_level: string;
  captain_user_id: string;
  recruiting: boolean;
  contact_mode: string;
  external_link: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinderTeamMemberRow {
  team_id: string;
  user_id: string;
  role: string;
  game_role: string | null;
  joined_at: string;
}

export interface FinderRecruitmentPostRow {
  id: string;
  team_id: string;
  game: string;
  role_needed: string;
  slots: number;
  current_level_min: string;
  target_level: string;
  region: string;
  availability_required: string[];
  experience_min: string | null;
  tryout_required: boolean;
  status: string;
  expires_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinderApplicationRow {
  id: string;
  post_id: string;
  applicant_user_id: string;
  note: string | null;
  status: string;
  decided_by: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface FinderReportRow {
  id: string;
  reporter_user_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
}

const PROFILE_COLUMNS =
  "user_id, handle, display_name, avatar_url, region, languages, timezone, current_level, target_level, primary_role, secondary_roles, availability, looking_for, open_to_tryout, bio, allow_indexing, is_searchable, created_at, updated_at";

const GAME_PROFILE_COLUMNS =
  "id, user_id, game, ign, character_id, verification_status, verification_method, verified_at, evidence_id, created_at, updated_at";

const SUBMISSION_COLUMNS =
  "id, user_id, game_profile_id, evidence_path, status, reason_code, reviewer, reviewed_at, created_at, updated_at";

const TEAM_COLUMNS =
  "id, slug, name, logo_url, game, region, description, current_level, target_level, captain_user_id, recruiting, contact_mode, external_link, is_public, created_by, created_at, updated_at";

const MEMBER_COLUMNS = "team_id, user_id, role, game_role, joined_at";

const POST_COLUMNS =
  "id, team_id, game, role_needed, slots, current_level_min, target_level, region, availability_required, experience_min, tryout_required, status, expires_at, created_by, created_at, updated_at";

const APPLICATION_COLUMNS =
  "id, post_id, applicant_user_id, note, status, decided_by, created_at, decided_at";

const REPORT_COLUMNS =
  "id, reporter_user_id, target_type, target_id, reason, status, created_at";

export async function findFinderProfileByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinderProfileRow | null> {
  const { data, error } = await supabase
    .from("finder_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as FinderProfileRow;
}

export async function findGameProfileByUserAndGame(
  supabase: SupabaseClient,
  userId: string,
  game: string,
): Promise<FinderGameProfileRow | null> {
  const { data, error } = await supabase
    .from("finder_game_profiles")
    .select(GAME_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .eq("game", game)
    .single();
  if (error) return null;
  return data as FinderGameProfileRow;
}

export async function listOpenRecruitmentPosts(
  supabase: SupabaseClient,
  filters: { game: string; roleNeeded?: string; region?: string },
): Promise<FinderRecruitmentPostRow[]> {
  let query = supabase
    .from("finder_recruitment_posts")
    .select(POST_COLUMNS)
    .eq("game", filters.game)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (filters.roleNeeded) query = query.eq("role_needed", filters.roleNeeded);
  if (filters.region) query = query.eq("region", filters.region);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FinderRecruitmentPostRow[];
}

export async function listApplicationsForPost(
  supabase: SupabaseClient,
  postId: string,
): Promise<FinderApplicationRow[]> {
  const { data, error } = await supabase
    .from("finder_applications")
    .select(APPLICATION_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinderApplicationRow[];
}

export async function listTeamMembers(
  supabase: SupabaseClient,
  teamId: string,
): Promise<FinderTeamMemberRow[]> {
  const { data, error } = await supabase
    .from("finder_team_members")
    .select(MEMBER_COLUMNS)
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinderTeamMemberRow[];
}

export async function listPendingVerificationSubmissions(
  supabase: SupabaseClient,
): Promise<FinderVerificationSubmissionRow[]> {
  const { data, error } = await supabase
    .from("finder_verification_submissions")
    .select(SUBMISSION_COLUMNS)
    .in("status", ["pending", "needs_review"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinderVerificationSubmissionRow[];
}

export async function listOpenReports(
  supabase: SupabaseClient,
): Promise<FinderReportRow[]> {
  const { data, error } = await supabase
    .from("finder_reports")
    .select(REPORT_COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinderReportRow[];
}

export async function findTeamBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<FinderTeamRow | null> {
  const { data, error } = await supabase
    .from("finder_teams")
    .select(TEAM_COLUMNS)
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data as FinderTeamRow;
}

// ─────────────────────────────────────────────────────────────
// Phase B — public directory projection (masked view) + owner writes.
// Reads below MUST use the masked views, never the base tables.
// ─────────────────────────────────────────────────────────────

export interface FinderPublicPlayerRow {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  region: string;
  languages: string[];
  timezone: string | null;
  bio: string | null;
  current_level: string;
  target_level: string;
  primary_role: string;
  secondary_roles: string[];
  availability: string[];
  looking_for: boolean;
  open_to_tryout: boolean;
  game: string;
  ign: string;
  character_id_masked: string;
  verification_status: string;
  bgmi_verified: boolean;
}

export const PUBLIC_PLAYER_COLUMNS =
  "handle, display_name, avatar_url, region, languages, timezone, bio, current_level, target_level, primary_role, secondary_roles, availability, looking_for, open_to_tryout, game, ign, character_id_masked, verification_status, bgmi_verified";

export interface PublicPlayerFilters {
  game?: string | undefined;
  query?: string | undefined;
  currentLevel?: string | undefined;
  targetLevel?: string | undefined;
  role?: string | undefined;
  region?: string | undefined;
  openToTryout?: boolean | undefined;
  limit?: number | undefined;
}

export async function searchPublicPlayers(
  supabase: SupabaseClient,
  filters: PublicPlayerFilters,
): Promise<FinderPublicPlayerRow[]> {
  let query = supabase
    .from("finder_public_players")
    .select(PUBLIC_PLAYER_COLUMNS)
    .eq("looking_for", true)
    .eq("game", filters.game ?? "bgmi")
    .order("handle", { ascending: true })
    .limit(filters.limit ?? 60);

  const q = filters.query?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`handle.ilike.${like},display_name.ilike.${like}`);
  }
  if (filters.currentLevel) query = query.eq("current_level", filters.currentLevel);
  if (filters.targetLevel) query = query.eq("target_level", filters.targetLevel);
  if (filters.role) {
    query = query.or(`primary_role.eq.${filters.role},secondary_roles.cs.{${filters.role}}`);
  }
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.openToTryout) query = query.eq("open_to_tryout", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FinderPublicPlayerRow[];
}

export async function findPublicPlayerByHandle(
  supabase: SupabaseClient,
  handle: string,
): Promise<FinderPublicPlayerRow | null> {
  const { data, error } = await supabase
    .from("finder_public_players")
    .select(PUBLIC_PLAYER_COLUMNS)
    .eq("handle", handle.toLowerCase())
    .eq("looking_for", true)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as FinderPublicPlayerRow | null;
}

export async function upsertFinderProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Omit<FinderProfileRow, "user_id" | "is_searchable" | "created_at" | "updated_at">,
): Promise<FinderProfileRow> {
  const { data, error } = await supabase
    .from("finder_profiles")
    .upsert({ ...patch, user_id: userId }, { onConflict: "user_id" })
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderProfileRow;
}

export async function upsertGameProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: { game: string; ign: string; character_id: string },
): Promise<FinderGameProfileRow> {
  const { data, error } = await supabase
    .from("finder_game_profiles")
    .upsert({ ...patch, user_id: userId }, { onConflict: "user_id,game" })
    .select(GAME_PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderGameProfileRow;
}

// ─────────────────────────────────────────────────────────────
// Phase C — team + recruitment + application data access.
// Reads of public surfaces MUST use the masked views, never the
// base tables. Writes take caller-derived ids (from requireUser /
// route params after a captain check) — never trust raw client
// authority; RLS is the security boundary.
// ─────────────────────────────────────────────────────────────

export interface FinderPublicTeamRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  game: string;
  region: string;
  description: string | null;
  current_level: string;
  target_level: string;
  recruiting: boolean;
  contact_mode: string;
  is_public: boolean;
  created_at: string;
}

export const PUBLIC_TEAM_COLUMNS =
  "id, slug, name, logo_url, game, region, description, current_level, target_level, recruiting, contact_mode, is_public, created_at";

export interface PublicTeamFilters {
  game?: string | undefined;
  query?: string | undefined;
  region?: string | undefined;
  currentLevel?: string | undefined;
  targetLevel?: string | undefined;
  recruitingOnly?: boolean | undefined;
  limit?: number | undefined;
}

export async function searchPublicTeams(
  supabase: SupabaseClient,
  filters: PublicTeamFilters,
): Promise<FinderPublicTeamRow[]> {
  let query = supabase
    .from("finder_public_teams")
    .select(PUBLIC_TEAM_COLUMNS)
    .eq("is_public", true)
    .eq("game", filters.game ?? "bgmi")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 60);

  const q = filters.query?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`slug.ilike.${like},name.ilike.${like}`);
  }
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.currentLevel) query = query.eq("current_level", filters.currentLevel);
  if (filters.targetLevel) query = query.eq("target_level", filters.targetLevel);
  if (filters.recruitingOnly) query = query.eq("recruiting", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FinderPublicTeamRow[];
}

export async function findPublicTeamBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<FinderPublicTeamRow | null> {
  const normalized = slug.trim().toLowerCase();
  const { data, error } = await supabase
    .from("finder_public_teams")
    .select(PUBLIC_TEAM_COLUMNS)
    .eq("slug", normalized)
    .eq("is_public", true)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as FinderPublicTeamRow | null;
}

export async function findTeamById(
  supabase: SupabaseClient,
  teamId: string,
): Promise<FinderTeamRow | null> {
  const { data, error } = await supabase
    .from("finder_teams")
    .select(TEAM_COLUMNS)
    .eq("id", teamId)
    .single();
  if (error) return null;
  return data as FinderTeamRow;
}

export async function listTeamsForCaptain(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinderTeamRow[]> {
  const { data, error } = await supabase
    .from("finder_teams")
    .select(TEAM_COLUMNS)
    .or(`captain_user_id.eq.${userId},created_by.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinderTeamRow[];
}

export async function listMyMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinderTeamMemberRow[]> {
  const { data, error } = await supabase
    .from("finder_team_members")
    .select(MEMBER_COLUMNS)
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinderTeamMemberRow[];
}

export interface TeamCreatePatch {
  slug: string;
  name: string;
  game: string;
  region: string;
  description?: string | undefined;
  current_level: string;
  target_level: string;
  recruiting: boolean;
  contact_mode: string;
  external_link?: string | undefined;
  is_public: boolean;
}

export async function createTeam(
  supabase: SupabaseClient,
  userId: string,
  patch: TeamCreatePatch,
): Promise<FinderTeamRow> {
  const { data, error } = await supabase
    .from("finder_teams")
    .insert({
      slug: patch.slug,
      name: patch.name,
      game: patch.game,
      region: patch.region,
      description: patch.description ?? null,
      current_level: patch.current_level,
      target_level: patch.target_level,
      captain_user_id: userId,
      recruiting: patch.recruiting,
      contact_mode: patch.contact_mode,
      external_link: patch.external_link ?? null,
      is_public: patch.is_public,
      created_by: userId,
    })
    .select(TEAM_COLUMNS)
    .single();
  if (error) throw error;
  const team = data as FinderTeamRow;
  // Creator becomes captain in the roster as well, so membership checks
  // (is_finder_team_captain covers both paths) work uniformly.
  const { error: memberError } = await supabase.from("finder_team_members").insert({
    team_id: team.id,
    user_id: userId,
    role: "captain",
    game_role: null,
  });
  if (memberError) throw memberError;
  return team;
}

export interface TeamUpdatePatch {
  name: string;
  region: string;
  description?: string | undefined;
  current_level: string;
  target_level: string;
  recruiting: boolean;
  contact_mode: string;
  external_link?: string | undefined;
  is_public: boolean;
}

export async function updateTeam(
  supabase: SupabaseClient,
  teamId: string,
  patch: TeamUpdatePatch,
): Promise<FinderTeamRow> {
  const { data, error } = await supabase
    .from("finder_teams")
    .update({
      name: patch.name,
      region: patch.region,
      description: patch.description ?? null,
      current_level: patch.current_level,
      target_level: patch.target_level,
      recruiting: patch.recruiting,
      contact_mode: patch.contact_mode,
      external_link: patch.external_link ?? null,
      is_public: patch.is_public,
    })
    .eq("id", teamId)
    .select(TEAM_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderTeamRow;
}

export async function updateTeamLogoUrl(
  supabase: SupabaseClient,
  teamId: string,
  logoUrl: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("finder_teams")
    .update({ logo_url: logoUrl })
    .eq("id", teamId);
  if (error) throw error;
}

export async function deleteTeam(supabase: SupabaseClient, teamId: string): Promise<void> {
  const { error } = await supabase.from("finder_teams").delete().eq("id", teamId);
  if (error) throw error;
}

export async function insertTeamMember(
  supabase: SupabaseClient,
  input: { team_id: string; user_id: string; role: string; game_role?: string | null | undefined },
): Promise<FinderTeamMemberRow> {
  const { data, error } = await supabase
    .from("finder_team_members")
    .insert({
      team_id: input.team_id,
      user_id: input.user_id,
      role: input.role,
      game_role: input.game_role ?? null,
    })
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderTeamMemberRow;
}

export async function updateTeamMemberRole(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  patch: { role: string; game_role?: string | null | undefined },
): Promise<FinderTeamMemberRow> {
  const { data, error } = await supabase
    .from("finder_team_members")
    .update({ role: patch.role, game_role: patch.game_role ?? null })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderTeamMemberRow;
}

export async function deleteTeamMember(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("finder_team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listRecruitmentPostsForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<FinderRecruitmentPostRow[]> {
  const { data, error } = await supabase
    .from("finder_recruitment_posts")
    .select(POST_COLUMNS)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinderRecruitmentPostRow[];
}

export async function listOpenPostsForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<FinderRecruitmentPostRow[]> {
  const { data, error } = await supabase
    .from("finder_recruitment_posts")
    .select(POST_COLUMNS)
    .eq("team_id", teamId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinderRecruitmentPostRow[];
}

export async function findRecruitmentPostById(
  supabase: SupabaseClient,
  postId: string,
): Promise<FinderRecruitmentPostRow | null> {
  const { data, error } = await supabase
    .from("finder_recruitment_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .single();
  if (error) return null;
  return data as FinderRecruitmentPostRow;
}

export interface RecruitmentPostCreatePatch {
  team_id: string;
  game: string;
  role_needed: string;
  slots: number;
  current_level_min: string;
  target_level: string;
  region: string;
  availability_required: string[];
  experience_min?: string | undefined;
  tryout_required: boolean;
  status: string;
  expires_at?: string | undefined;
}

export async function createRecruitmentPost(
  supabase: SupabaseClient,
  userId: string,
  patch: RecruitmentPostCreatePatch,
): Promise<FinderRecruitmentPostRow> {
  const { data, error } = await supabase
    .from("finder_recruitment_posts")
    .insert({
      team_id: patch.team_id,
      game: patch.game,
      role_needed: patch.role_needed,
      slots: patch.slots,
      current_level_min: patch.current_level_min,
      target_level: patch.target_level,
      region: patch.region,
      availability_required: patch.availability_required,
      experience_min: patch.experience_min ?? null,
      tryout_required: patch.tryout_required,
      status: patch.status,
      ...(patch.expires_at ? { expires_at: patch.expires_at } : {}),
      created_by: userId,
    })
    .select(POST_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderRecruitmentPostRow;
}

export interface RecruitmentPostUpdatePatch {
  role_needed: string;
  slots: number;
  current_level_min: string;
  target_level: string;
  region: string;
  availability_required: string[];
  experience_min?: string | undefined;
  tryout_required: boolean;
  status: string;
  expires_at?: string | undefined;
}

export async function updateRecruitmentPost(
  supabase: SupabaseClient,
  postId: string,
  patch: RecruitmentPostUpdatePatch,
): Promise<FinderRecruitmentPostRow> {
  const { data, error } = await supabase
    .from("finder_recruitment_posts")
    .update({
      role_needed: patch.role_needed,
      slots: patch.slots,
      current_level_min: patch.current_level_min,
      target_level: patch.target_level,
      region: patch.region,
      availability_required: patch.availability_required,
      experience_min: patch.experience_min ?? null,
      tryout_required: patch.tryout_required,
      status: patch.status,
      ...(patch.expires_at ? { expires_at: patch.expires_at } : {}),
    })
    .eq("id", postId)
    .select(POST_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderRecruitmentPostRow;
}

export async function deleteRecruitmentPost(
  supabase: SupabaseClient,
  postId: string,
): Promise<void> {
  const { error } = await supabase.from("finder_recruitment_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function listMyApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinderApplicationRow[]> {
  const { data, error } = await supabase
    .from("finder_applications")
    .select(APPLICATION_COLUMNS)
    .eq("applicant_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinderApplicationRow[];
}

export async function findApplicationById(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<FinderApplicationRow | null> {
  const { data, error } = await supabase
    .from("finder_applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", applicationId)
    .single();
  if (error) return null;
  return data as FinderApplicationRow;
}

export async function createApplication(
  supabase: SupabaseClient,
  userId: string,
  input: { post_id: string; note?: string | undefined },
): Promise<FinderApplicationRow> {
  const { data, error } = await supabase
    .from("finder_applications")
    .insert({
      post_id: input.post_id,
      applicant_user_id: userId,
      note: input.note ?? null,
      status: "applied",
      decided_by: null,
    })
    .select(APPLICATION_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderApplicationRow;
}

export async function withdrawApplication(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<FinderApplicationRow> {
  const { data, error } = await supabase
    .from("finder_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .select(APPLICATION_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderApplicationRow;
}

export async function decideApplication(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
  status: "shortlisted" | "accepted" | "declined",
): Promise<FinderApplicationRow> {
  const { data, error } = await supabase
    .from("finder_applications")
    .update({ status, decided_by: userId, decided_at: new Date().toISOString() })
    .eq("id", applicationId)
    .select(APPLICATION_COLUMNS)
    .single();
  if (error) throw error;
  return data as FinderApplicationRow;
}
