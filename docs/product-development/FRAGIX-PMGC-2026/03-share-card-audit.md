# 03 — Share card audit

## What exists (confirmed)

| Attribute | Evidence |
| --- | --- |
| Format | Client-side **PNG** via canvas (`renderShareCardBlob`) |
| Dimensions | **1080×1080** (`SHARE_CARD_SIZE`) |
| Brand row | `siteConfig.name` + “M” mark |
| Watermark bar | Destination label (profile URL without scheme) + mark |
| Player fields | Allowlisted public projection subset only (`PLAYER_SHARE_FIELD_KEYS`) |
| Privacy | Forbids `game_user_id`, email, ids, fake `verified` keys |
| Mobile download | `<a download>` via `downloadBlob` (works on many mobile browsers; iOS share sheet not used) |
| Other formats | Tools also CSV (roster); player card is PNG-only |
| Visual proof | `docs/.../P15-M1-share-kit-v1/evidence/player-card.png` |

## Gaps vs FRAGIX / campaign

| Gap | Evidence | Priority | Reason |
| --- | --- | --- | --- |
| Brand still MicroNest | `siteConfig` + watermark text | P0 | Shared cards are the distribution unit |
| Mark is “M”, not FRAGIX | `drawMark` / `icon.svg` | P0 | Brand recognition on social |
| Ownership-reviewed **not on card** | `buildPlayerShareSpec` / `PlayerShareCard` ignore public status reader | P0 | Growth loop step 5–6 broken in creative |
| Copy says “not verified” | Player share UI + disclaimer strings | P0 | Conflicts with reviewed badge semantics (use truthful “ownership evidence reviewed”, never official BGMI) |
| No QR code | No QR dependency/code in repo | P1 | URL text exists; QR optional for offline/events |
| No Web Share API | No `navigator.share` | P1 | Improves mobile Instagram path |
| Filename fallback `micronest-share` | `sanitize-filename.ts` | P0 (with brand) | Residual MicroNest leak |
| Social “compelling” polish | Arena card is clean/minimal; avatar not drawn on canvas today | P1 | Avatar URL is in input model but render path is text-row based — check render: avatar not used in `renderShareCardBlob` |

### Avatar note

`PlayerShareInput` includes `avatar_url`, but `buildPlayerShareSpec` / canvas renderer do **not** paint the avatar. Cards are typography-led. For campaign virality, painting the public avatar is a **P1** enhancement without schema changes.

## Privacy acceptance (keep)

- Do not put BGMI Player ID or evidence on cards.
- Do not imply official PMGC/BGMI endorsement.
- Keep allowlist; do not widen frozen G1 projection — pass reviewed flag from the **separate** public reader into the share builder only.

## Verdict on share readiness

Technically shippable PNG pipeline: **yes**. FRAGIX campaign-ready identity card: **no** until brand + reviewed-status alignment.
