import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamDirectoryValidationError } from "@/features/teams/domain/team-directory";
import { getTeamBySlug } from "@/features/teams/server/team-directory-reader";
import { createClient } from "@/lib/supabase/server";
import { TeamProfileSections } from "../_components/team-profile-sections";
import {
  buildTeamDetailMetadata,
  buildTeamNotFoundMetadata,
  buildTeamsCanonicalUrl,
} from "../_lib/query";

type SlugParams = { slug: string };

// Seconds-scale revalidation: visibility withdrawal hides the row on the next
// query; short caching bounds stale public pages without revalidating on
// every request (same posture as the player profile route).
export const revalidate = 60;

// Public team profile (P1). Resolves the slug through getTeamBySlug only
// (D1 masked RPC, UNAPPLIED): no base-table reads, no elevated database
// client, no new RPCs. Missing and private slugs return the identical generic
// not-found (404-equivalence). Public information only: no applicant PII, no
// private membership data, no administrative metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  try {
    const card = await getTeamBySlug(client, slug);
    if (card === null) {
      const notFoundCopy = buildTeamNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildTeamDetailMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      robots: { index: false, follow: true },
      ...(buildTeamsCanonicalUrl(`/teams/${card.slug}`) === undefined
        ? {}
        : { alternates: { canonical: buildTeamsCanonicalUrl(`/teams/${card.slug}`) } }),
    };
  } catch {
    // Invalid slug syntax and reader failures expose the same generic copy.
    const notFoundCopy = buildTeamNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function TeamProfilePage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getTeamBySlug>>;
  try {
    card = await getTeamBySlug(client, slug);
  } catch (error) {
    // Invalid syntax is indistinguishable from missing (no existence oracle);
    // transport failures surface through the route error boundary.
    if (error instanceof TeamDirectoryValidationError) {
      notFound();
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
          href="/teams"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to team directory
        </Link>
      </p>
      <TeamProfileSections card={card} />
    </div>
  );
}
