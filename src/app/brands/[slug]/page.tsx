import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandDirectoryValidationError } from "@/features/brands/domain/brand";
import { getBrandBySlug } from "@/features/brands/server/brand-reader";
import { createClient } from "@/lib/supabase/server";
import { BrandProfileSections } from "../_components/brand-profile-sections";
import {
  buildBrandDetailMetadata,
  buildBrandNotFoundMetadata,
  buildBrandsCanonicalUrl,
} from "../_lib/query";

type SlugParams = { slug: string };

export const revalidate = 60;

// Public brand profile (P8). Resolves the slug through getBrandBySlug only
// (PROPOSED masked RPC, no migration exists): no base-table reads, no elevated
// client, no new RPCs. Missing and private slugs return the identical generic
// not-found (404-equivalence). A brand profile never proves representation.
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  try {
    const card = await getBrandBySlug(client, slug);
    if (card === null) {
      const notFoundCopy = buildBrandNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildBrandDetailMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      robots: { index: false, follow: true },
      ...(buildBrandsCanonicalUrl(`/brands/${card.slug}`) === undefined
        ? {}
        : { alternates: { canonical: buildBrandsCanonicalUrl(`/brands/${card.slug}`) } }),
    };
  } catch {
    const notFoundCopy = buildBrandNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function BrandProfilePage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getBrandBySlug>>;
  try {
    card = await getBrandBySlug(client, slug);
  } catch (error) {
    if (error instanceof BrandDirectoryValidationError) {
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
          href="/brands"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to brand directory
        </Link>
      </p>
      <BrandProfileSections card={card} />
    </div>
  );
}
