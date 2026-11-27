"use client";

import { ShareDownloadButton } from "@/components/shared/share-download-button";
import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import {
  buildPlayerShareSpec,
  toPlayerShareInput,
} from "@/features/player-profile/share/player-card-model";

export function PlayerShareCard({
  card,
  profileUrl,
  ownershipReviewed = false,
}: {
  card: PublicPlayerCard;
  profileUrl: string;
  /** From separate public ownership reader — never invent or client-supply. */
  ownershipReviewed?: boolean | undefined;
}) {
  const input = toPlayerShareInput(card, profileUrl);
  const spec =
    input === null
      ? null
      : buildPlayerShareSpec(input, { ownershipReviewed });

  return (
    <section
      aria-labelledby="player-share-heading"
      className="rounded-none border border-slate-deep/20 bg-steel-100 p-4 sm:p-5"
    >
      <h2
        id="player-share-heading"
        className="font-display text-lg font-extrabold tracking-tight uppercase"
      >
        Share card
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">
        Download a FRAGIX PNG from this public profile anytime — ownership review is not required to
        share. The ownership-reviewed badge appears on the card only when a current approval is
        valid.
      </p>
      <div className="mt-4">
        <ShareDownloadButton spec={spec} label="Download player profile PNG" />
      </div>
    </section>
  );
}
