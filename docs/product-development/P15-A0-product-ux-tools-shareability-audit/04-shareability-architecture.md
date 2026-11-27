# 04 — Shareability Architecture

## Current capability — PARTIAL / MISSING

| Output type | Status | Evidence |
|---|---|---|
| Tool clipboard summary | PARTIAL | Prize / roster / tiebreak runners |
| Tool CSV helpers | PARTIAL | `features/teams/roster/output.ts` (not primary UX) |
| Branded PNG (tools) | MISSING | No canvas/`html-to-image` dependency in `package.json` |
| Player LFT PNG | MISSING | — |
| Team LFP / roster PNG | MISSING | Public roster identities intentionally unavailable |
| Tournament standings graphics | MISSING | Tiebreak has standings UI only |
| Prize distribution graphics | MISSING | On-page list + text |
| Shareable result/profile deep links | PARTIAL | Profile/team URLs exist; tool *state* URLs do not |
| Open Graph images | MISSING | Home/about explicitly omit OG images; detail pages title/description only |
| QR codes | MISSING | — |
| Referral / attribution | MISSING | — |
| Rate limiting on share endpoints | MISSING | No share endpoints yet |

Legacy (`legacy/application/.../share/*`) historically had share routes — **reference only**; do not import.

---

## Design goals (aligned with operator preferences)

1. Growth via genuine utility + user-generated shares.
2. Minimal operator human interaction (self-serve create → download → post).
3. Never expose private DB fields through exports or public URLs.
4. Subtle persistent MicroNest watermark + branded URL as organic distribution.

---

## Recommended architecture (proposal only — not implemented)

### A. Client-generated assets (preferred for M1)

**Pattern:** Render a fixed-layout card in the browser (DOM or canvas) → `toBlob`/`toDataURL` → download PNG.

| Property | Guidance |
|---|---|
| Data source | Only fields already shown on public UI or tool session state |
| Watermark | Small MicroNest wordmark + `micronest…` short URL corner |
| Dimensions | Mobile story 1080×1920 optional; default square 1080×1080 + landscape 1920×1080 for announcements |
| Typography | Oswald display + Geist body (existing brand fonts) |
| Privacy | No emails, user UUIDs, game_user_id, owner IDs, undiscoverable profiles |
| Abuse | Client-only = no server cost; still add copy/download UX rate niceties later |

**Fits:** tool results, player LFT from public projection, team recruiting banner.

### B. Public share links (optional M2)

| Option | Pros | Cons / risks |
|---|---|---|
| Encode full tool state in URL hash/query | No DB | Size limits; ugly URLs; spoofable content |
| Opaque public token → server row of *public snapshot* | Clean URLs; revoke | **Requires migration + RLS + abuse limits** → authorization review |
| Link only to existing `/players/[handle]` or `/teams/[slug]` | Zero new surface | Less rich than result cards |

**Constraint:** Any server-stored snapshot must be an explicit public subset, never a passthrough of private tables. Design that needs new RPC/RLS = flagged in `07`.

### C. Open Graph previews

| Phase | Approach |
|---|---|
| Near-term | Static OG image for `/` and `/tools` marketing only |
| Profile OG | Dynamic OG **only** if indexing policy changes; today product routes are `noindex` — OG still helps chat unfurls when URLs are pasted |
| Dynamic image edge function | Higher complexity; defer until Share Kit proves demand |

### D. Attribution

Optional `?ref=share-lft` / `?ref=tool-prize` query on watermark URLs — analytics later; do not invent counts now. Keep privacy-preserving (no fingerprinting requirement).

### E. Abuse prevention (when server links exist)

- Rate limit create/read of share tokens.
- Expire or owner-revoke tokens.
- Content moderation for user-supplied names on public snapshots (already constrained by Zod lengths on tools).

---

## Asset-specific notes

### Player LFT PNG — FEASIBLE NOW (public fields)

Include only VERIFIED public fields (see `03`). Label availability honestly; do not print “Verified”. CTA: profile URL.

### Team LFP PNG — FEASIBLE NOW (recruiting banner only)

Use `recruiting` + public team fields. Do **not** invent open role text until posts exist. Roster identity PNG for *public* audiences is **BLOCKED** by current privacy design (count-only). Workspace-only roster PNG for captains is a separate, authenticated export.

### Tournament / qualification graphics

Prefer generating from Tie-Break session state (client) rather than claiming official standings. Watermark: “Simulated with MicroNest Tie-Break — not an official result.”

---

## Finding — F-SHARE-01

- Evidence: clipboard-only exports; no PNG deps; OG images omitted by design comments in `page.tsx`.
- User impact: cannot post identity/results to Discord/WhatsApp/Instagram cleanly.
- Business impact: blocks self-serve growth loop.
- Complexity: medium. Risk: low for client-only. Action: Share Kit v1.
