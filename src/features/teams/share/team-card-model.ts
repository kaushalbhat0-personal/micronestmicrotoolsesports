// Team share card — public directory/detail fields only.
// Never includes roster identities, UUIDs, or invented open roles.

import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";
import { SELF_REPORTED_LEVEL_NOTE } from "@/features/teams/domain/levels";
import { getGameByKey } from "@/lib/game-catalog/catalog";
import type { ShareCardSpec } from "@/lib/share-kit";

export interface TeamShareInput {
  readonly name: string;
  readonly slug: string;
  readonly game_key: string;
  readonly region_code: string;
  readonly current_level: string;
  readonly target_level: string;
  readonly recruiting: boolean;
  readonly member_count: number;
  readonly description: string | null;
  readonly teamUrl: string;
}

const FORBIDDEN = new Set([
  "id",
  "owner_user_id",
  "created_by",
  "organization_id",
  "email",
  "members",
  "roster",
  "applicants",
]);

export function toTeamShareInput(card: PublicTeamDetail, teamUrl: string): TeamShareInput | null {
  if (teamUrl.trim() === "") {
    return null;
  }
  return {
    name: card.name,
    slug: card.slug,
    game_key: card.game_key,
    region_code: card.region_code,
    current_level: card.current_level,
    target_level: card.target_level,
    recruiting: card.recruiting,
    member_count: card.member_count,
    description: card.description,
    teamUrl,
  };
}

export function assertTeamShareHasNoPrivateKeys(payload: Record<string, unknown>): boolean {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN.has(key.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function buildTeamShareSpec(input: TeamShareInput): ShareCardSpec {
  const gameName = getGameByKey(input.game_key)?.name ?? input.game_key;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Game", value: gameName },
    { label: "Region", value: input.region_code },
    {
      label: "Level",
      value: `${input.current_level} → ${input.target_level} (self-reported)`,
    },
    {
      label: "Members",
      value: String(input.member_count),
    },
  ];
  if (input.recruiting) {
    rows.unshift({ label: "Status", value: "Open to Recruitment" });
  }

  const blocks: string[] = [];
  if (input.description !== null && input.description.trim() !== "") {
    blocks.push(input.description.trim().replace(/\s+/g, " ").slice(0, 160));
  }

  return {
    tone: "team",
    eyebrow: input.recruiting ? "Team · Open to Recruitment" : "Public Team",
    title: input.name,
    subtitle: `@${input.slug}`,
    rows,
    blocks: blocks.length > 0 ? blocks : undefined,
    disclaimer: `${SELF_REPORTED_LEVEL_NOTE} Roster identities are not shown on public cards. Generated with FRAGIX.`,
    destinationLabel: input.teamUrl.replace(/^https?:\/\//, ""),
    filenameBase: `team-${input.slug}`,
  };
}
