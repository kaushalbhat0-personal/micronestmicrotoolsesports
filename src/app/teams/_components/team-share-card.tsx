"use client";

import { ShareDownloadButton } from "@/components/shared/share-download-button";
import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";
import {
  buildTeamShareSpec,
  toTeamShareInput,
} from "@/features/teams/share/team-card-model";

export function TeamShareCard({
  card,
  teamUrl,
}: {
  card: PublicTeamDetail;
  teamUrl: string;
}) {
  const input = toTeamShareInput(card, teamUrl);
  const spec = input === null ? null : buildTeamShareSpec(input);

  return (
    <section
      aria-labelledby="team-share-heading"
      className="mt-8 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 id="team-share-heading" className="text-lg font-semibold">
        Share card
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Download a FRAGIX PNG from public team fields only. Roster identities and open-role
        vacancies are never invented.
      </p>
      <div className="mt-4">
        <ShareDownloadButton
          spec={spec}
          label={
            card.recruiting
              ? "Download recruitment PNG"
              : "Download team profile PNG"
          }
        />
      </div>
    </section>
  );
}
