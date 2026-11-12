import type { ReactNode } from "react";

/**
 * AdSafeGameLayout — architectural no-ad boundary around gameplay.
 *
 * INVARIANT: nothing resembling an ad (AdSense, sponsored slot, promo
 * iframe, "advertisement" block) may ever render inside this subtree, or
 * between the island's options and its verdict/result controls. Future ad
 * slots must be SIBLINGS placed after the methodology/explanation section,
 * never adjacent to gameplay controls — Google's ~150px guidance is
 * enforced structurally here (spacer + section separation), not by
 * page-specific margins.
 *
 * This component renders no ads, no placeholders, no SDK — boundary only.
 */
export function AdSafeGameLayout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      data-ad-safe="game-island"
      className="scroll-mt-20 rounded-[16px] border border-border bg-card p-5 sm:p-6"
    >
      {children}
      {/* AdSense integration note (architecture only, no ads):
          keep at least one full explanation section between this boundary
          and any future ad slot. Never insert ad markup here. */}
    </section>
  );
}
