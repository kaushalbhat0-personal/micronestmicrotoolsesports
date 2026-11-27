// Organizer identity card (P3 + P9 integration). Presents the public
// organizer reference — kind label, name, and an explicit unverified note.
// Verification does not exist: no badge, no checkmark, no implied trust.
// Independent organizers and organizations render identically apart from the
// kind label, because neither carries authority in this phase.
//
// P9: when the organizer reference carries a public slug (an organizer
// profile exists in the registry), the name links to /organizers/[slug].
// A null slug (unlisted organizer) renders plain text — never a broken
// link, never a fabricated profile. The denormalized name here is display
// only and is never treated as proof of identity.

import Link from "next/link";
import { ORGANIZER_TRUST_NOTE, organizerKindLabel } from "@/features/tournaments/domain/organizer";
import type { PublicTournamentCard } from "@/features/tournaments/domain/public-card";

export function OrganizerCard({ organizer }: { organizer: PublicTournamentCard["organizer"] }) {
  return (
    <section
      aria-labelledby="tournament-organizer-heading"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="tournament-organizer-heading" className="text-lg font-semibold">
        Organizer
      </h2>
      <p className="mt-2 text-sm font-medium">
        {organizer.slug !== null ? (
          <Link
            href={`/organizers/${organizer.slug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {organizer.name}
          </Link>
        ) : (
          organizer.name
        )}{" "}
        <span className="font-normal text-slate-500">({organizerKindLabel(organizer.kind)})</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{ORGANIZER_TRUST_NOTE}</p>
    </section>
  );
}
