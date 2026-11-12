import { createClient } from "@supabase/supabase-js";

/**
 * Published BGMI Tournament Hub sitemap paths (RCCF-BGMI-TOURNAMENTS-02).
 *
 * Reuses the public read path (`features/bgmi-tournaments`) — only
 * published tournaments/stages are ever returned. Never emits
 * query-string URLs. Fails closed to `["/bgmi-tournaments"]` when the
 * database is unreachable so a sitemap is always emitted.
 */

function encodePathSegment(value: string): string {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/** Pure path builder — deterministic, deduplicated, no query strings. */
export function buildBgmiTournamentSitemapPaths(
  tournaments: ReadonlyArray<{ slug: string; stages: ReadonlyArray<{ slug: string }> }>
): string[] {
  const paths = ["/bgmi-tournaments"];
  const seen = new Set(paths);
  const sorted = [...tournaments].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const tournament of sorted) {
    const tPath = `/bgmi-tournaments/${encodePathSegment(tournament.slug)}`;
    if (!seen.has(tPath)) {
      seen.add(tPath);
      paths.push(tPath);
    }
    const stages = [...tournament.stages].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    for (const stage of stages) {
      const sPath = `${tPath}/${encodePathSegment(stage.slug)}`;
      if (!seen.has(sPath)) {
        seen.add(sPath);
        paths.push(sPath);
      }
    }
  }
  return paths;
}

/** Lists published hub paths via an anon client (no request cookies). */
export async function listPublishedBgmiTournamentPaths(): Promise<string[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return ["/bgmi-tournaments"];
    const supabase = createClient(url, anonKey);
    const { data: tournaments, error } = await supabase
      .from("bgmi_tournaments")
      .select("slug")
      .eq("published", true);
    if (error || !tournaments) return ["/bgmi-tournaments"];
    const out: Array<{ slug: string; stages: Array<{ slug: string }> }> = [];
    for (const t of tournaments as Array<{ slug: string }>) {
      const { data: tournamentRow } = await supabase
        .from("bgmi_tournaments")
        .select("id")
        .eq("published", true)
        .eq("slug", t.slug)
        .maybeSingle();
      const tournamentId = (tournamentRow as { id: string } | null)?.id;
      if (!tournamentId) continue;
      const { data: stages } = await supabase
        .from("bgmi_stages")
        .select("slug")
        .eq("tournament_id", tournamentId)
        .eq("published", true);
      out.push({ slug: t.slug, stages: ((stages ?? []) as Array<{ slug: string }>).map((s) => ({ slug: s.slug })) });
    }
    return buildBgmiTournamentSitemapPaths(out);
  } catch {
    return ["/bgmi-tournaments"];
  }
}
