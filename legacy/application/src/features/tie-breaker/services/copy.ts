import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import { requireTieBreakerOwned } from "./tie-breaker-foundation";

/**
 * Tie-Breaker Resolver — Copy for next competition.
 * Creates an independent draft: name structure, selected teams, scoring,
 * rules, preset, description. Never: results, snapshot, record, share token.
 */

export interface CopyOptions {
  /** Team ids to carry over. Defaults to all teams. */
  teamIds?: string[];
}

export async function copyCompetitionForNext(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  competitionId: string,
  options: CopyOptions = {},
): Promise<{ competition: compRepo.TieBreakerCompetitionRow; teams: teamRepo.TieBreakerTeamRow[] }> {
  const source = requireTieBreakerOwned(
    await compRepo.findTieBreakerCompetitionById(supabase, competitionId),
    organizationId,
  );
  const sourceTeams = await teamRepo.listTieBreakerTeamsByCompetition(supabase, source.id);

  const wanted = options.teamIds ?? sourceTeams.map((t) => t.id);
  const picked = sourceTeams.filter((t) => wanted.includes(t.id));
  if (options.teamIds && picked.length !== options.teamIds.length) {
    throw validationError("Some selected teams do not belong to this competition");
  }

  const competition = await compRepo.createTieBreakerCompetition(supabase, {
    organization_id: organizationId,
    created_by: userId,
    name: `${source.name} (2)`,
    description: source.description,
    scoring_win: source.scoring_win,
    scoring_draw: source.scoring_draw,
    scoring_loss: source.scoring_loss,
    draws_enabled: source.draws_enabled,
    round_label: source.round_label,
    rule_order: [...source.rule_order],
    preset_ref: source.preset_ref,
    cloned_from: source.id,
  });

  const teams: teamRepo.TieBreakerTeamRow[] = [];
  for (const t of picked) {
    teams.push(
      await teamRepo.createTieBreakerTeam(supabase, {
        competition_id: competition.id,
        organization_id: organizationId,
        name: t.name,
        short_name: t.short_name,
        logo_url: t.logo_url,
      }),
    );
  }
  return { competition, teams };
}
