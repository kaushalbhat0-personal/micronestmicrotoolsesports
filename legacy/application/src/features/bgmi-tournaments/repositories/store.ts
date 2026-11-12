/**
 * Supabase-backed BGMI store (service-role writes only).
 *
 * Used exclusively by the authenticated ingestion route. Never imported
 * by client components. All writes are idempotent upserts on stable
 * natural keys, so re-runs and retries converge instead of duplicating.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BgmiStageDataset } from "../types";

export interface BgmiStoredTournament {
  readonly id: string;
  readonly slug: string;
  readonly sourceRevision: number | null;
}

export interface BgmiStoredStage {
  readonly id: string;
  readonly sourceRevision: number | null;
}

export interface BgmiStore {
  getTournament(slug: string): Promise<BgmiStoredTournament | null>;
  getStage(tournamentId: string, stageSlug: string): Promise<BgmiStoredStage | null>;
  publishDataset(dataset: BgmiStageDataset): Promise<{ tournamentId: string; stageId: string }>;
  recordRun(input: {
    runId: string;
    tournamentSlug: string;
    stageSlug: string;
    status: "running" | "succeeded" | "failed";
    errorSummary?: string | undefined;
    sourceRevision?: number | null;
    publishedRevision?: number | null;
    matchesCompleted?: number | null;
    teamsCount?: number | null;
  }): Promise<void>;
  completeRun(runId: string, status: "succeeded" | "failed", errorSummary?: string): Promise<void>;
}

export function createSupabaseBgmiStore(supabase: SupabaseClient): BgmiStore {
  return {
    async getTournament(slug: string): Promise<BgmiStoredTournament | null> {
      const { data, error } = await supabase
        .from("bgmi_tournaments")
        .select("id, slug, source_revision")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`Failed to load BGMI tournament: ${error.message}`);
      if (!data) return null;
      const row = data as { id: string; slug: string; source_revision: number | null };
      return { id: row.id, slug: row.slug, sourceRevision: row.source_revision };
    },

    async getStage(tournamentId: string, stageSlug: string): Promise<BgmiStoredStage | null> {
      const { data, error } = await supabase
        .from("bgmi_stages")
        .select("id, source_revision")
        .eq("tournament_id", tournamentId)
        .eq("slug", stageSlug)
        .maybeSingle();
      if (error) throw new Error(`Failed to load BGMI stage: ${error.message}`);
      if (!data) return null;
      const row = data as { id: string; source_revision: number | null };
      return { id: row.id, sourceRevision: row.source_revision };
    },

    async publishDataset(dataset: BgmiStageDataset): Promise<{ tournamentId: string; stageId: string }> {
      const t = dataset.tournament;
      const { data: tournamentRow, error: tournamentError } = await supabase
        .from("bgmi_tournaments")
        .upsert(
          {
            slug: t.slug,
            name: t.name,
            short_name: t.shortName,
            season_year: t.seasonYear,
            organizer: t.organizer,
            starts_on: t.startsOn,
            ends_on: t.endsOn,
            rulebook_url: t.rulebookUrl,
            source_url: t.sourceUrl,
            source_page: t.sourcePage,
            source_revision: t.sourceRevision,
            source_last_updated_at: t.sourceLastUpdatedAt,
            status: t.status,
            published: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();
      if (tournamentError || !tournamentRow) {
        throw new Error(`Failed to upsert BGMI tournament: ${tournamentError?.message ?? "unknown"}`);
      }
      const tournamentId = (tournamentRow as { id: string }).id;

      const s = dataset.stage;
      const { data: stageRow, error: stageError } = await supabase
        .from("bgmi_stages")
        .upsert(
          {
            tournament_id: tournamentId,
            slug: s.slug,
            name: s.name,
            format_note: s.formatNote,
            status: s.status,
            smash_rule: s.smashRule,
            match_point_threshold: s.matchPointThreshold,
            source_url: s.sourceUrl,
            source_revision: s.sourceRevision,
            published: true,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tournament_id,slug" }
        )
        .select("id")
        .single();
      if (stageError || !stageRow) {
        throw new Error(`Failed to upsert BGMI stage: ${stageError?.message ?? "unknown"}`);
      }
      const stageId = (stageRow as { id: string }).id;

      const teamIdByCanonical = new Map<string, string>();
      for (const team of dataset.teams) {
        const { data: teamRow, error: teamError } = await supabase
          .from("bgmi_teams")
          .upsert(
            {
              canonical_name: team.canonicalName,
              display_name: team.displayName,
              short_name: team.shortName,
              logo_url: team.logoUrl,
            },
            { onConflict: "canonical_name" }
          )
          .select("id")
          .single();
        if (teamError || !teamRow) throw new Error(`Failed to upsert BGMI team: ${teamError?.message ?? "unknown"}`);
        teamIdByCanonical.set(team.canonicalName, (teamRow as { id: string }).id);
      }

      for (const entry of dataset.entries) {
        const teamId = teamIdByCanonical.get(entry.teamCanonical);
        if (!teamId) throw new Error(`Missing team id for entry ${entry.teamCanonical}`);
        const { error: entryError } = await supabase.from("bgmi_stage_entries").upsert(
          { stage_id: stageId, team_id: teamId, starting_points: entry.startingPoints, published: true },
          { onConflict: "stage_id,team_id" }
        );
        if (entryError) throw new Error(`Failed to upsert BGMI entry: ${entryError.message}`);
      }

      for (const match of dataset.matches) {
        const { data: matchRow, error: matchError } = await supabase
          .from("bgmi_matches")
          .upsert(
            {
              stage_id: stageId,
              match_number: match.matchNumber,
              map_name: match.mapName,
              scheduled_at: match.scheduledAt,
              status: match.status,
              vod_url: match.vodUrl,
              source_ref: `${t.sourcePage}#${s.slug}-m${match.matchNumber}`,
              published: true,
            },
            { onConflict: "stage_id,match_number" }
          )
          .select("id")
          .single();
        if (matchError || !matchRow) {
          throw new Error(`Failed to upsert BGMI match ${match.matchNumber}: ${matchError?.message ?? "unknown"}`);
        }
        const matchId = (matchRow as { id: string }).id;
        for (const result of match.results) {
          const teamId = teamIdByCanonical.get(result.teamCanonical);
          if (!teamId) throw new Error(`Missing team id for result ${result.teamCanonical}`);
          const { error: resultError } = await supabase.from("bgmi_match_results").upsert(
            {
              match_id: matchId,
              team_id: teamId,
              placement: result.placement,
              finishes: result.finishes,
              placement_points: result.placementPoints,
              finish_points: result.finishPoints,
              total_points: result.totalPoints,
              published: true,
            },
            { onConflict: "match_id,team_id" }
          );
          if (resultError) throw new Error(`Failed to upsert BGMI result: ${resultError.message}`);
        }
      }

      return { tournamentId, stageId };
    },

    async recordRun(input): Promise<void> {
      const { error } = await supabase.from("bgmi_ingestion_runs").insert({
        run_id: input.runId,
        tournament_slug: input.tournamentSlug,
        stage_slug: input.stageSlug,
        status: input.status,
        error_summary: input.errorSummary ?? null,
        source_revision: input.sourceRevision ?? null,
        published_revision: input.publishedRevision ?? null,
        matches_completed: input.matchesCompleted ?? null,
        teams_count: input.teamsCount ?? null,
      });
      if (error) throw new Error(`Failed to record BGMI run: ${error.message}`);
    },

    async completeRun(runId: string, status: "succeeded" | "failed", errorSummary?: string): Promise<void> {
      const { error } = await supabase
        .from("bgmi_ingestion_runs")
        .update({
          status,
          completed_at: new Date().toISOString(),
          error_summary: status === "failed" ? (errorSummary ?? "failed").slice(0, 500) : null,
        })
        .eq("run_id", runId);
      if (error) throw new Error(`Failed to complete BGMI run: ${error.message}`);
    },
  };
}
