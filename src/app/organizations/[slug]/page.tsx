import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationDirectoryValidationError } from "@/features/organizations/domain/organization";
import { getOrganizationBySlug } from "@/features/organizations/server/organization-reader";
import { createClient } from "@/lib/supabase/server";
import { OrganizationProfileSections } from "../_components/organization-profile-sections";
import {
  buildOrganizationDetailMetadata,
  buildOrganizationNotFoundMetadata,
  buildOrganizationsCanonicalUrl,
} from "../_lib/query";

type SlugParams = { slug: string };

export const revalidate = 60;

// Public organization profile (P8). Resolves the slug through
// getOrganizationBySlug only (PROPOSED masked RPC, no migration exists): no
// base-table reads, no elevated client, no new RPCs. Missing and private slugs
// return the identical generic not-found (404-equivalence). Public information
// only: no ownership, representative or evidence internals.
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  try {
    const card = await getOrganizationBySlug(client, slug);
    if (card === null) {
      const notFoundCopy = buildOrganizationNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildOrganizationDetailMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      robots: { index: false, follow: true },
      ...(buildOrganizationsCanonicalUrl(`/organizations/${card.slug}`) === undefined
        ? {}
        : { alternates: { canonical: buildOrganizationsCanonicalUrl(`/organizations/${card.slug}`) } }),
    };
  } catch {
    const notFoundCopy = buildOrganizationNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function OrganizationProfilePage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getOrganizationBySlug>>;
  try {
    card = await getOrganizationBySlug(client, slug);
  } catch (error) {
    if (error instanceof OrganizationDirectoryValidationError) {
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
          href="/organizations"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to organization directory
        </Link>
      </p>
      <OrganizationProfileSections card={card} />
    </div>
  );
}
