// D1 teams — pure search-param parsers (PORT from legacy player-search/team-search).
// Legacy:
// - legacy/application/src/features/finder/services/player-search.ts
// - legacy/application/src/features/finder/services/team-search.ts
// Adaptations: region param constrained to BGMI vocabulary codes (or ignored);
export interface TeamSearchFilters {
  readonly game: "bgmi";
  readonly regionCode?: string | undefined;
  readonly role?: string | undefined;
  readonly query?: string | undefined;
  readonly recruitingOnly: boolean;
  readonly limit: number;
}

export interface PlayerSearchFilters {
  readonly game: "bgmi";
  readonly regionCode?: string | undefined;
  readonly role?: string | undefined;
  readonly query?: string | undefined;
  readonly limit: number;
}

const BGMI_REGIONS = new Set(["india", "asia", "europe", "north-america", "south-america", "middle-east", "online"]);
const BGMI_ROLES = new Set(["IGL", "Assaulter", "Support", "Scout"]);

function cleanToken(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (t === "") return undefined;
  return t.slice(0, max);
}

export function parseTeamSearchParams(raw: Record<string, unknown>): TeamSearchFilters {
  const regionRaw = cleanToken(raw["region"], 40)?.toLowerCase();
  const roleRaw = cleanToken(raw["role"], 40);
  const query = cleanToken(raw["q"], 60);
  const recruitingRaw = raw["recruiting"];
  return {
    game: "bgmi",
    ...(regionRaw && BGMI_REGIONS.has(regionRaw) ? { regionCode: regionRaw } : {}),
    ...(roleRaw && BGMI_ROLES.has(roleRaw) ? { role: roleRaw } : {}),
    ...(query ? { query } : {}),
    recruitingOnly: recruitingRaw !== "0",
    limit: 60,
  };
}

export function parsePlayerSearchParams(raw: Record<string, unknown>): PlayerSearchFilters {
  const regionRaw = cleanToken(raw["region"], 40)?.toLowerCase();
  const roleRaw = cleanToken(raw["role"], 40);
  const query = cleanToken(raw["q"], 60);
  return {
    game: "bgmi",
    ...(regionRaw && BGMI_REGIONS.has(regionRaw) ? { regionCode: regionRaw } : {}),
    ...(roleRaw && BGMI_ROLES.has(roleRaw) ? { role: roleRaw } : {}),
    ...(query ? { query } : {}),
    limit: 60,
  };
}
