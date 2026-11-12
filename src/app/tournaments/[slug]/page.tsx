import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TournamentDirectoryOperationError,
  TournamentDirectoryValidationError,
} from "@/features/tournaments/domain/public-card";
import { getTournamentBySlug } from "@/features/tournaments/server/tournament-reader";
import { createClient } from "@/lib/supabase/server";
import { TournamentDetail } from "../_components/tournament-detail";
import {
  buildTournamentDetailMetadata,
  buildTournamentNotFoundMetadata,
  buildTournamentUnavailableMetadata,
  buildTournamentsCanonicalUrl,
} from "../_lib/query";

type SlugParams = { slug: string };

// Seconds-scale revalidation: unpublishing hides the row on the next query;
// short caching bounds stale public pages without revalidating on every
// request (same posture as the team detail route).
export const revalidate = 60;

// Public tournament listing (P3). Resolves the slug through
// getTournamentBySlug only (PROPOSED masked RPC, no migration exists): no
// base-table reads, no elevated database client, no new RPCs. Missing and
// unpublished slugs return the identical generic not-found
// (404-equivalence). Reader outages (including the proposed-RPC missing
// case) resolve to the intentional unavailable state — never a 500 with
// internal detail, never a misleading not-found (P3 correction).
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  try {
    const card = await getTournamentBySlug(client, slug);
    if (card === null) {
      const notFoundCopy = buildTournamentNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildTournamentDetailMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      robots: { index: false, follow: true },
      ...(buildTournamentsCanonicalUrl(`/tournaments/${card.slug}`) === undefined
        ? {}
        : { alternates: { canonical: buildTournamentsCanonicalUrl(`/tournaments/${card.slug}`) } }),
    };
  } catch (error) {
    if (error instanceof TournamentDirectoryOperationError) {
      const unavailableCopy = buildTournamentUnavailableMetadata();
      return {
        title: unavailableCopy.title,
        description: unavailableCopy.description,
        robots: { index: false, follow: true },
      };
    }
    // Invalid slug syntax exposes the generic not-found copy (no existence
    // oracle).
    const notFoundCopy = buildTournamentNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function TournamentDetailPage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getTournamentBySlug>>;
  try {
    card = await getTournamentBySlug(client, slug);
  } catch (error) {
    // Invalid syntax is indistinguishable from missing (no existence oracle);
    // reader outages render the intentional unavailable state inline (P3
    // correction: a valid slug with an unreachable database is NOT a 404 and
    // must not leak internal database errors).
    if (error instanceof TournamentDirectoryValidationError) {
      notFound();
    }
    if (error instanceof TournamentDirectoryOperationError) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <p className="mb-6 text-sm">
            <Link
              href="/tournaments"
              className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              ← Back to tournaments
            </Link>
          </p>
          <div
            role="alert"
            className="rounded-lg border border-slate-200 bg-white p-6 text-center"
          >
            <h1 className="text-lg font-semibold">Tournament unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              Could not load this tournament listing. Please try again.
            </p>
            <Link
              href="/tournaments"
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Back to tournaments
            </Link>
          </div>
        </div>
      );
    }
    throw error;
  }
  if (card === null) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/tournaments"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to tournaments
        </Link>
      </p>
      <TournamentDetail card={card} />
    </div>
  );
}
