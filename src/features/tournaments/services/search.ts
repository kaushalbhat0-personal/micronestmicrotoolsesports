// P3 tournaments — pure search-param parsers (mirrors the teams P1 port).
// Region vocabulary is BGMI-only (matches G1 seed + game catalogue);
// unknown regions/roles pass through unparsed here and fail closed at the
// reader/RPC (zero rows, explained empty state).

export interface TournamentSearchFilters {
  readonly game: "bgmi";
  readonly regionCode?: string | undefined;
  readonly status?: string | undefined;
  readonly query?: string | undefined;
  readonly limit: number;
}

const BGMI_REGIONS = new Set([
  "india",
  "asia",
  "europe",
  "north-america",
  "south-america",
  "middle-east",
  "online",
]);

const TOURNAMENT_STATUSES = new Set(["upcoming", "ongoing", "completed"]);

function cleanToken(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (t === "") return undefined;
  return t.slice(0, max);
}

export function parseTournamentSearchParams(raw: Record<string, unknown>): TournamentSearchFilters {
  const regionRaw = cleanToken(raw["region"], 40)?.toLowerCase();
  const statusRaw = cleanToken(raw["status"], 20)?.toLowerCase();
  const query = cleanToken(raw["q"], 120);
  return {
    game: "bgmi",
    ...(regionRaw && BGMI_REGIONS.has(regionRaw) ? { regionCode: regionRaw } : {}),
    ...(statusRaw && TOURNAMENT_STATUSES.has(statusRaw) ? { status: statusRaw } : {}),
    ...(query ? { query } : {}),
    limit: 60,
  };
}
