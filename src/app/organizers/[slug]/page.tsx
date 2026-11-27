import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OrganizerDirectoryOperationError,
  OrganizerDirectoryValidationError,
} from "@/features/organizers/domain/organizer";
import { getOrganizerBySlug } from "@/features/organizers/server/organizer-reader";
import { createClient } from "@/lib/supabase/server";
import { OrganizerDetail } from "../_components/organizer-detail";
import {
  buildOrganizerDetailMetadata,
  buildOrganizerNotFoundMetadata,
  buildOrganizersUnavailableMetadata,
  buildOrganizersCanonicalUrl,
} from "../_lib/query";

type SlugParams = { slug: string };

export const revalidate = 60;

// Public organizer profile (P9). Resolves the slug through
// getOrganizerBySlug only (PROPOSED masked RPC, local migration only): no
// base-table reads, no elevated database client, no new RPCs. Missing and
// unpublished slugs return the identical generic not-found
// (404-equivalence). Reader outages resolve to the intentional unavailable
// state — never a 500 with internal detail, never a misleading not-found.
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  try {
    const card = await getOrganizerBySlug(client, slug);
    if (card === null) {
      const notFoundCopy = buildOrganizerNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildOrganizerDetailMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      robots: { index: false, follow: true },
      ...(buildOrganizersCanonicalUrl(`/organizers/${card.slug}`) === undefined
        ? {}
        : { alternates: { canonical: buildOrganizersCanonicalUrl(`/organizers/${card.slug}`) } }),
    };
  } catch (error) {
    if (error instanceof OrganizerDirectoryOperationError) {
      const unavailableCopy = buildOrganizersUnavailableMetadata();
      return {
        title: unavailableCopy.title,
        description: unavailableCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const notFoundCopy = buildOrganizerNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function OrganizerDetailPage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getOrganizerBySlug>>;
  try {
    card = await getOrganizerBySlug(client, slug);
  } catch (error) {
    if (error instanceof OrganizerDirectoryValidationError) {
      notFound();
    }
    if (error instanceof OrganizerDirectoryOperationError) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <p className="mb-6 text-sm">
            <Link
              href="/organizers"
              className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              ← Back to organizers
            </Link>
          </p>
          <div role="alert" className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-lg font-semibold">Organizer unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              Could not load this organizer profile. Please try again.
            </p>
            <Link
              href="/organizers"
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Back to organizers
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
          href="/organizers"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to organizers
        </Link>
      </p>
      <OrganizerDetail card={card} />
    </div>
  );
}
