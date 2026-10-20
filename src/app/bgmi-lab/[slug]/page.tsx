import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePageShell } from "@/components/marketing/bgmi-lab/game-page-shell";
import { resolveLabGame } from "@/features/bgmi-lab/games";
import {
  buildLabMetadata,
  getLabTool,
  getRoutableLabTools,
  isLabRoutableSlug,
} from "@/lib/marketing/public-tool-content";

/**
 * BGMI Lab detail — server-rendered content shell + one dynamic client island.
 * Only routable registry tools ("available", plus "experimental" when a game
 * island exists) resolve; planned/archived/unknown slugs 404 (no thin pages).
 * The island resolves through the loader map so /bgmi-lab stays lightweight
 * and new games need no route changes.
 */
export async function generateStaticParams() {
  return getRoutableLabTools().map((t) => ({ slug: t.slug }));
}

// Planned drills have no pages: unknown slugs 404 at routing level.
//
// Known framework behavior (Next 15, accepted noise): each such 404 logs
// one server-side `NoFallbackError` from the route module even though the
// client correctly receives HTTP 404 with the not-found page. There is no
// narrow supported suppression — `instrumentation.onRequestError` filtering
// would be global error swallowing, and removing this flag would regress
// unknown slugs to HTTP 200. Correct status takes precedence over log
// silence; hits here are bots/typos only (no links or sitemap entries).
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getLabTool(slug);
  if (!tool || !isLabRoutableSlug(slug)) return {};
  return buildLabMetadata(tool);
}

export default async function BgmiLabDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getLabTool(slug);
  const GameIsland = resolveLabGame(slug);
  if (!tool || !isLabRoutableSlug(slug) || !GameIsland) notFound();

  return <GamePageShell tool={tool} island={<GameIsland />} />;
}
