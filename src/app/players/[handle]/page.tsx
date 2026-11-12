import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectoryValidationError } from "@/features/player-profile/domain/directory";
import { getPlayerByHandle } from "@/features/player-profile/server/directory-reader";
import { createClient } from "@/lib/supabase/server";
import { ProfileSections } from "../_components/profile-sections";
import { buildCanonicalUrl, buildNotFoundMetadata, buildProfileMetadata } from "../_lib/query";

type HandleParams = { handle: string };

// Seconds-scale revalidation: consent withdrawal hides the row on the next
// query (04 section 4); short caching bounds stale public pages without
// revalidating on every request.
export const revalidate = 60;

// Public player profile (G1-6). Resolves the handle through
// getPlayerByHandle only (APPROVED D-G1-03 RPC-only): no base-table reads, no
// elevated database client, no new RPCs. Missing, private, suspended and inactive handles
// return the identical generic not-found (404-equivalence, 08 T5/T8).
export async function generateMetadata({
  params,
}: {
  params: Promise<HandleParams>;
}): Promise<Metadata> {
  const { handle } = await params;
  const client = await createClient();
  try {
    const card = await getPlayerByHandle(client, handle);
    if (card === null) {
      const notFoundCopy = buildNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildProfileMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      // No indexing opt-in exists in the frozen projection (04 section 4),
      // so profiles default to noindex.
      robots: { index: false, follow: true },
      ...(buildCanonicalUrl(`/players/${card.handle}`) === undefined
        ? {}
        : { alternates: { canonical: buildCanonicalUrl(`/players/${card.handle}`) } }),
    };
  } catch {
    // Invalid handle syntax and reader failures expose the same generic copy.
    const notFoundCopy = buildNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function PlayerProfilePage({ params }: { params: Promise<HandleParams> }) {
  const { handle } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getPlayerByHandle>>;
  try {
    card = await getPlayerByHandle(client, handle);
  } catch (error) {
    // Invalid syntax is indistinguishable from missing (no existence oracle);
    // transport failures surface through the route error boundary.
    if (error instanceof DirectoryValidationError) {
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
          href="/players"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to player directory
        </Link>
      </p>
      <ProfileSections card={card} />
    </div>
  );
}
