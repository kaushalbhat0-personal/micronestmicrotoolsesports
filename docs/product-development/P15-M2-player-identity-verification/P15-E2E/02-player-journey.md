# 02 — Player journey

## Method

Automated JWT path via `G1_TEST_MODE=m2b4` + `G1_TEST_MODE=m2b3c` services (real anon keys, separate player JWTs). UI presentational states via `bgmi-ownership-ui.test.tsx`. Anon surface via Playwright.

## Steps verified

| Step | Evidence | Result |
| --- | --- | --- |
| Login (session JWT) | Integration sign-up → access token | PASS |
| Complete profile | `createPlayerProfile` + game profile + bio | PASS |
| Discoverability requires completeness | `consent-completeness.test.ts` + M2B.1 RPC | PASS |
| Verification **not** required for discoverability | Completeness contract excludes ownership | PASS |
| Save BGMI Player ID | `createGameProfile` / `updateGameProfile` `game_user_id` | PASS |
| Upload 1–2 screenshots | `uploadBgmiOwnershipEvidence` | PASS |
| Confirm submission → `pending_review` | `submitBgmiOwnershipCase` | PASS |
| Player sees pending | UI State E “Pending manual review” | PASS |
| Public badge absent while pending | `getPlayerBgmiOwnershipPublicStatus` → `ownership_reviewed=false` | PASS |
| Anon cannot open verification upload | Playwright `settings-anon-gate.png` | PASS |

## Notes

- Full browser click-path with a durable human player account was not driven (no stored credentials). Service-layer JWT journey covers the same security and state transitions.
- Second screenshot optional path exists in product (max 2); acceptance exercised ≥1 valid image.
