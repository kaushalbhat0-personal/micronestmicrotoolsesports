/**
 * BGMI Tournament Hub — public readers (server-only).
 *
 * The ONLY production read path. Uses the normal server Supabase client
 * (anon key, RLS-enforced) — never the service-role admin client, never
 * from client components. Readers only ever see `published = true` rows.
 *
 * Standings are derived here via `deriveStandings` — the single source of
 * truth (starting points + match totals). No stored totals are read.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BgmiMatch,
  BgmiStage,
  BgmiStageEntry,
  BgmiStandingRow,
  BgmiTeam,
  BgmiTournament,
} from "../types";
import { deriveStandings } from "../services/standings";

const TOURNAMENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isTournamentSlug(value: string): boolean {
  return TOURNAMENT_SLUG_PATTERN.test(value);
}

type Status = "upcoming" | "ongoing" | "completed";

function toStatus(value: string): Status {
  return value === "ongoing" ? "ongoing" : value === "upcoming" ? "upcoming" : "completed";
}

export interface PublishedTournament extends BgmiTournament {
  readonly stages: readonly PublishedStageSummary[];
}

export interface PublishedStageSummary {
  readonly slug: string;
  readonly name: string;
  readonly status: Status;
  readonly smashRule: boolean;
  readonly publishedAt: string | null;
  readonly completedMatches: number;
  readonly totalMatches: number;
  readonly teamsCount: number;
}

export interface PublishedStageDetail {
  readonly tournament: BgmiTournament;
  readonly stage: BgmiStage;
  readonly standings: readonly BgmiStandingRow[];
  readonly matches: readonly PublishedMatch[];
}

export interface PublishedMatch {
  readonly matchNumber: number;
  readonly mapName: string | null;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "completed";
  readonly vodUrl: string | null;
  readonly results: readonly {
    readonly rank: number;
    readonly teamCanonical: string;
    readonly displayName: string;
    readonly placement: number;
    readonly finishes: number;
    readonly totalPoints: number;
  }[];
}

/** List published tournaments, ongoing first, then by end date desc. */
export async function listTournaments(supabase: SupabaseClient): Promise<PublishedTournament[]> {
  const { data, error } = await supabase
    .from("bgmi_tournaments")
    .select(
      "id, slug, name, short_name, season_year, organizer, starts_on, ends_on, rulebook_url, source_url, source_page, source_revision, source_last_updated_at, status"
    )
    .eq("published", true)
    .order("status", { ascending: true })
    .order("ends_on", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to list BGMI tournaments: ${error.message}`);
  const rows = (data ?? []) as Array<Record<string, string | number | boolean | null>>;
  const tournaments: PublishedTournament[] = [];
  for (const row of rows) {
    const tournament = toTournament(row);
    const stages = await listStages(supabase, tournament.slug);
    tournaments.push({ ...tournament, stages });
  }
  // Ongoing first (status collation already approximates this); enforce.
  const rank = (status: Status): number => (status === "ongoing" ? 0 : status === "upcoming" ? 1 : 2);
  tournaments.sort((a, b) => rank(a.status) - rank(b.status) || (b.endsOn ?? "").localeCompare(a.endsOn ?? ""));
  return tournaments;
}

export async function getTournament(supabase: SupabaseClient, slug: string): Promise<PublishedTournament | null> {
  if (!isTournamentSlug(slug)) return null;
  const { data, error } = await supabase
    .from("bgmi_tournaments")
    .select(
      "id, slug, name, short_name, season_year, organizer, starts_on, ends_on, rulebook_url, source_url, source_page, source_revision, source_last_updated_at, status"
    )
    .eq("published", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load BGMI tournament: ${error.message}`);
  if (!data) return null;
  const tournament = toTournament(data as Record<string, string | number | boolean | null>);
  const stages = await listStages(supabase, slug);
  return { ...tournament, stages };
}

export async function listStages(supabase: SupabaseClient, tournamentSlug: string): Promise<PublishedStageSummary[]> {
  const { data: tournament, error: tournamentError } = await supabase
    .from("bgmi_tournaments")
    .select("id")
    .eq("published", true)
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (tournamentError) throw new Error(`Failed to load BGMI tournament: ${tournamentError.message}`);
  if (!tournament) return [];
  const tournamentId = (tournament as { id: string }).id;
  const { data, error } = await supabase
    .from("bgmi_stages")
    .select("id, slug, name, status, smash_rule, published_at")
    .eq("tournament_id", tournamentId)
    .eq("published", true)
    .order("slug", { ascending: true });
  if (error) throw new Error(`Failed to list BGMI stages: ${error.message}`);
  const out: PublishedStageSummary[] = [];
  for (const row of (data ?? []) as Array<{ id: string; slug: string; name: string; status: string; smash_rule: boolean; published_at: string | null }>) {
    const { data: matches } = await supabase
      .from("bgmi_matches")
      .select("status")
      .eq("stage_id", row.id)
      .eq("published", true);
    const list = (matches ?? []) as Array<{ status: string }>;
    const { count } = await supabase
      .from("bgmi_stage_entries")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", row.id)
      .eq("published", true);
    out.push({
      slug: row.slug,
      name: row.name,
      status: toStatus(row.status),
      smashRule: row.smash_rule,
      publishedAt: row.published_at,
      completedMatches: list.filter((m) => m.status === "completed").length,
      totalMatches: list.length,
      teamsCount: count ?? 0,
    });
  }
  return out;
}

export async function getStageDetail(
  supabase: SupabaseClient,
  tournamentSlug: string,
  stageSlug: string
): Promise<PublishedStageDetail | null> {
  if (!isTournamentSlug(tournamentSlug) || !isTournamentSlug(stageSlug)) return null;
  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("bgmi_tournaments")
    .select(
      "id, slug, name, short_name, season_year, organizer, starts_on, ends_on, rulebook_url, source_url, source_page, source_revision, source_last_updated_at, status"
    )
    .eq("published", true)
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (tournamentError) throw new Error(`Failed to load BGMI tournament: ${tournamentError.message}`);
  if (!tournamentRow) return null;
  const tournament = toTournament(tournamentRow as Record<string, string | number | boolean | null>);
  const tournamentId = (tournamentRow as { id: string }).id;

  const { data: stageRow, error: stageError } = await supabase
    .from("bgmi_stages")
    .select("id, slug, name, format_note, status, smash_rule, match_point_threshold, source_url, source_revision, published_at")
    .eq("tournament_id", tournamentId)
    .eq("slug", stageSlug)
    .eq("published", true)
    .maybeSingle();
  if (stageError) throw new Error(`Failed to load BGMI stage: ${stageError.message}`);
  if (!stageRow) return null;
  const stage = stageRow as {
    id: string;
    slug: string;
    name: string;
    format_note: string | null;
    status: string;
    smash_rule: boolean;
    match_point_threshold: number | null;
    source_url: string | null;
    source_revision: number | null;
    published_at: string | null;
  };
  const stageId = stage.id;

  const { data: entryRows, error: entryError } = await supabase
    .from("bgmi_stage_entries")
    .select("starting_points, bgmi_teams!inner(id, canonical_name, display_name, short_name, logo_url)")
    .eq("stage_id", stageId)
    .eq("published", true);
  if (entryError) throw new Error(`Failed to load BGMI entries: ${entryError.message}`);

  const teams: BgmiTeam[] = [];
  const entries: BgmiStageEntry[] = [];
  const displayByCanonical = new Map<string, string>();
  for (const row of ((entryRows ?? []) as unknown as Array<{
    starting_points: number;
    bgmi_teams:
      | { canonical_name: string; display_name: string; short_name: string; logo_url: string | null }
      | Array<{ canonical_name: string; display_name: string; short_name: string; logo_url: string | null }>;
  }>)) {
    const joined = row.bgmi_teams;
    const team = Array.isArray(joined) ? joined[0] : joined;
    if (!team) continue;
    teams.push({
      canonicalName: team.canonical_name,
      displayName: team.display_name,
      shortName: team.short_name,
      logoUrl: team.logo_url,
    });
    entries.push({ teamCanonical: team.canonical_name, startingPoints: row.starting_points, sourcePlacement: null });
    displayByCanonical.set(team.canonical_name, team.display_name);
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("bgmi_matches")
    .select("id, match_number, map_name, scheduled_at, status, vod_url")
    .eq("stage_id", stageId)
    .eq("published", true)
    .order("match_number", { ascending: true });
  if (matchError) throw new Error(`Failed to load BGMI matches: ${matchError.message}`);

  const matches: BgmiMatch[] = [];
  const publishedMatches: PublishedMatch[] = [];
  for (const match of (matchRows ?? []) as Array<{
    id: string;
    match_number: number;
    map_name: string | null;
    scheduled_at: string | null;
    status: string;
    vod_url: string | null;
  }>) {
    const { data: resultRows, error: resultError } = await supabase
      .from("bgmi_match_results")
      .select("placement, finishes, placement_points, finish_points, total_points, bgmi_teams!inner(canonical_name, display_name)")
      .eq("match_id", match.id)
      .eq("published", true)
      .order("placement", { ascending: true });
    if (resultError) throw new Error(`Failed to load BGMI results: ${resultError.message}`);
    const results = ((resultRows ?? []) as unknown as Array<{
      placement: number;
      finishes: number;
      placement_points: number;
      finish_points: number;
      total_points: number;
      bgmi_teams:
        | { canonical_name: string; display_name: string }
        | Array<{ canonical_name: string; display_name: string }>;
    }>)
      .map((r) => ({ ...r, team: Array.isArray(r.bgmi_teams) ? r.bgmi_teams[0] : r.bgmi_teams }))
      .filter((r): r is typeof r & { team: { canonical_name: string; display_name: string } } => r.team !== undefined)
      .map((r, index) => ({
        teamCanonical: r.team.canonical_name,
        placement: r.placement,
        finishes: r.finishes,
        placementPoints: r.placement_points,
        finishPoints: r.finish_points,
        totalPoints: r.total_points,
        rank: index + 1,
        displayName: r.team.display_name,
      }));
    matches.push({
      matchNumber: match.match_number,
      mapName: match.map_name,
      scheduledAt: match.scheduled_at,
      status: match.status === "completed" ? "completed" : "scheduled",
      vodUrl: match.vod_url,
      results: results.map((r) => ({
        teamCanonical: r.teamCanonical,
        placement: r.placement,
        finishes: r.finishes,
        placementPoints: r.placementPoints,
        finishPoints: r.finishPoints,
        totalPoints: r.totalPoints,
      })),
    });
    publishedMatches.push({
      matchNumber: match.match_number,
      mapName: match.map_name,
      scheduledAt: match.scheduled_at,
      status: match.status === "completed" ? "completed" : "scheduled",
      vodUrl: match.vod_url,
      results: results.map((r) => ({
        rank: r.rank,
        teamCanonical: r.teamCanonical,
        displayName: displayByCanonical.get(r.teamCanonical) ?? r.displayName,
        placement: r.placement,
        finishes: r.finishes,
        totalPoints: r.totalPoints,
      })),
    });
  }

  const standings = deriveStandings(teams, entries, matches);

  return {
    tournament,
    stage: {
      slug: stage.slug,
      name: stage.name,
      formatNote: stage.format_note,
      status: toStatus(stage.status),
      smashRule: stage.smash_rule,
      matchPointThreshold: stage.match_point_threshold,
      sourceUrl: stage.source_url,
      sourceRevision: stage.source_revision,
      publishedAt: stage.published_at,
    },
    standings,
    matches: publishedMatches,
  };
}

function toTournament(row: Record<string, string | number | boolean | null>): BgmiTournament {
  return {
    slug: String(row["slug"] ?? ""),
    name: String(row["name"] ?? ""),
    shortName: String(row["short_name"] ?? ""),
    seasonYear: typeof row["season_year"] === "number" ? row["season_year"] : null,
    organizer: typeof row["organizer"] === "string" ? row["organizer"] : null,
    startsOn: typeof row["starts_on"] === "string" ? row["starts_on"] : null,
    endsOn: typeof row["ends_on"] === "string" ? row["ends_on"] : null,
    rulebookUrl: typeof row["rulebook_url"] === "string" ? row["rulebook_url"] : null,
    sourceUrl: String(row["source_url"] ?? ""),
    sourcePage: String(row["source_page"] ?? ""),
    sourceRevision: typeof row["source_revision"] === "number" ? row["source_revision"] : null,
    sourceLastUpdatedAt: typeof row["source_last_updated_at"] === "string" ? row["source_last_updated_at"] : null,
    status: toStatus(String(row["status"] ?? "completed")),
  };
}
