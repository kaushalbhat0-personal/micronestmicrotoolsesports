import { createClient } from "@supabase/supabase-js";
import { listGames, listPatches } from "@/features/meta-parser/repositories/reads";

/**
 * Published Meta-Parser sitemap paths (RCCF-TOOLBOX-IA-02).
 *
 * Reuses the public read repository (`reads.ts`) — the same RLS-enforced
 * anon path as the pages. Only published games/patches are ever returned:
 * `listPatches` already filters `status = 'complete' AND content_hash <> ''`,
 * so staging/provisional/failed rows are excluded by construction.
 * Never emits query-string filter URLs.
 */

const MAX_PATCHES_PER_GAME = 100;

function encodePathSegment(value: string): string {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/** Pure path builder — deterministic, deduplicated, no query strings. */
export function buildMetaParserSitemapPaths(
  games: ReadonlyArray<{ slug: string }>,
  patchesByGame: Readonly<Record<string, ReadonlyArray<string>>>
): string[] {
  const paths = ["/meta-parser"];
  const seen = new Set(paths);
  const sortedGames = [...games].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const game of sortedGames) {
    const gamePath = `/meta-parser/${encodePathSegment(game.slug)}`;
    if (!seen.has(gamePath)) {
      seen.add(gamePath);
      paths.push(gamePath);
    }
    const versions = [...(patchesByGame[game.slug] ?? [])].sort();
    for (const version of versions.slice(0, MAX_PATCHES_PER_GAME)) {
      const patchPath = `${gamePath}/${encodePathSegment(version)}`;
      if (!seen.has(patchPath)) {
        seen.add(patchPath);
        paths.push(patchPath);
      }
    }
  }
  return paths;
}

/**
 * Lists published Meta-Parser sitemap paths via the public read repository.
 * Uses a no-cookie anon client (sitemap generation has no request cookies).
 * Fails closed to `["/meta-parser"]` when the database is unreachable so a
 * sitemap is always emitted and never blocks the build.
 */
export async function listPublishedMetaParserPaths(): Promise<string[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return ["/meta-parser"];
    const supabase = createClient(url, anonKey);
    const games = await listGames(supabase);
    const patchLists = await Promise.all(games.map((game) => listPatches(supabase, game.slug)));
    const patchesByGame: Record<string, string[]> = {};
    games.forEach((game, index) => {
      patchesByGame[game.slug] = (patchLists[index] ?? []).map((patch) => patch.patchVersion);
    });
    return buildMetaParserSitemapPaths(games, patchesByGame);
  } catch {
    return ["/meta-parser"];
  }
}
