# 05 — Campaign landing page recommendation

## Reuse first

Do **not** create a new product tool. Prefer evolving `/campaigns/bgmi-season` (or adding `/campaigns/pmgc-2026-community` as a thin twin) into an identity-first FRAGIX page that links to **existing** routes:

- `/signup`
- `/onboarding/profile` / `/settings/profile`
- `/players` (examples)
- `/workspace/moderation/bgmi-ownership` (ops only; do not promote publicly)

Keep tools pathways as a **secondary** “also useful” strip — not the hero.

## Recommended composition (first viewport)

Aligned with existing Arena visual language + FRAGIX brand (once applied):

1. **Brand:** FRAGIX (hero-level)
2. **Headline:** one competitive line (e.g. “Show up. Get reviewed. Share your card.”) — not overpowering brand
3. **Support:** unofficial PMGC 2026 **community** participation; independent of KRAFTON / official PMGC
4. **CTA group:** Sign up · Complete BGMI profile
5. **Dominant visual:** existing player share PNG / dossier specimen (reuse `player-card.png` evidence; regenerate after FRAGIX brand)

Avoid: fake standings, official logos, countdown-to-official-event claims, “verified by BGMI/PMGC.”

## Required legal strip (keep / strengthen)

Reuse current independence pattern from `bgmi-season/page.tsx`:

- BGMI trademark attribution
- FRAGIX independent; not affiliated/sponsored/endorsed by KRAFTON or official PMGC organizers
- Ownership badge = “BGMI ownership evidence reviewed” (manual), not official account validation

## Message hierarchy

| Order | Message |
| --- | --- |
| 1 | Create your FRAGIX player identity |
| 2 | Optional: submit ownership evidence for reviewed badge |
| 3 | Share your PNG card |
| 4 | Discover other players / tools |

## SEO / robots

Current campaign page is `robots: { index: false }`. For paid/organic social, that is fine if all traffic is deep-linked. If the page becomes the public FRAGIX campaign hub, revisit indexing **after** legal/brand sign-off (P1).

## Priority

| Work | Priority | Reason |
| --- | --- | --- |
| Identity-first campaign landing using existing routes | P0 | Distribution destination |
| FRAGIX naming + disclaimer update on that page | P0 | Brand + risk |
| Secondary tools strip retained | P1 | Reuse without new tools |
| Indexed public hub | P1/P2 | After content freeze |
