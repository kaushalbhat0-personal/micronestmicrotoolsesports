# 02 — Player journey audit

## Intended growth loop vs product

| Step | Intended | Actual route / capability | Status |
| --- | --- | --- | --- |
| 1 Discover FRAGIX | Campaign / social → brand home | Home `/` and `/campaigns/bgmi-season` are **MicroNest**; no FRAGIX destination | Gap (brand) |
| 2 Register + profile | Signup → onboarding | `/signup` → `/onboarding/profile` → `/settings/profile` | **Exists** |
| 3 BGMI ID | Save Player ID | Settings BGMI Player ID section (private `game_user_id`) | **Exists** |
| 4 Evidence | Private screenshots | Settings BGMI ownership verification (M2B.3C) | **Exists** |
| 5 Manual review | Super-admin queue | `/workspace/moderation/bgmi-ownership` (M2B.4) | **Exists**; durable admin ops gap (P15-E2E) |
| 6 Public badge | Reviewed indicator | Separate reader on `/players/[handle]` — not in G1 12-field projection | **Exists** |
| 7 Share card | PNG identity card | `PlayerShareCard` download on public profile | **Exists**; messaging/badge lag |
| 8 Repeat | Share → new players | Destination URL on watermark; no UTM/attribution | Partial |

## Journey friction (evidence-based)

1. **Hero CTA mismatch** — Primary CTAs are “Sign up free” + “Discover tournaments” (`arena-hero.tsx`). Campaign growth loop wants identity/share, not tournaments-first.
2. **“Nothing is verified”** — Hero copy undercuts ownership-reviewed badge credibility.
3. **Discoverability vs verification** — Correctly separate (`discoverability-section.tsx`); good for honesty, but campaign creative must explain both without implying official BGMI endorsement.
4. **Share card not in settings** — Download lives on **public** profile after discoverability; players who stay private cannot distribute a public card (by design). Campaign must teach “enable discoverability → share.”
5. **Review latency** — Manual only; no SLA UI. Campaign volume needs ops staffing + `platform_admins` grant.

## What must not be rebuilt

- Registration / Supabase Auth
- BGMI evidence Storage / RLS
- Decide RPC / audit / public status reader
- Frozen G1 projection

## Priority

| Item | Priority | Reason |
| --- | --- | --- |
| Align home/campaign CTAs to signup → profile → evidence → share | P0 | Converts traffic into the real loop |
| Fix “nothing is verified” vs ownership-reviewed wording | P0 | Trust / legal clarity |
| Operator `platform_admins` + review capacity | P0 | Without review, badge/share loop stalls |
| In-settings “preview public card” deep link | P1 | Reduces drop-off after approval |
| Multi-game expansion messaging | P2 | Long-term FRAGIX direction; BGMI-first now |
