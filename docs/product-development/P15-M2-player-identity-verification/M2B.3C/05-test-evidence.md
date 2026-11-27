# 05 — Test Evidence

| Command | Result |
|---|---|
| `npm run typecheck` | **pass** |
| `npm run lint` | **pass** (0 errors) |
| `npm run test` | **115 files / 1082 tests passed** |
| `G1_TEST_MODE=m2b3c … bgmi-ownership-storage.integration` | **6/6 passed** |
| `npm run build` | **pass** |
| Playwright `e2e/p15m2b3c-verification-settings.spec.ts` | **1 passed** |

## Unit coverage highlights

- UI states A–G (`bgmi-ownership-ui.test.tsx`)
- Sanitize / lifecycle / privacy freezes
- Deletion calls ownership cleanup before profile row delete
