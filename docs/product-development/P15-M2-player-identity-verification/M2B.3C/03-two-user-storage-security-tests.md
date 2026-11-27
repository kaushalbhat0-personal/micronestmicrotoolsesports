# 03 — Two-User Storage Security Tests

## Suite

`src/features/player-profile/tests/bgmi-ownership-storage.integration.test.ts`

## Gate

```bash
G1_TEST_MODE=m2b3c npm run test:integration -- bgmi-ownership-storage.integration
```

Requires Esports `NEXT_PUBLIC_SUPABASE_URL`, anon key, and service role for **cleanup only**. Player boundaries use real user JWTs from `signUp` / `signInWithPassword`.

## Results (actual, 2026-11-28)

| # | Assertion | Result |
|---|---|---|
| 1–2 | A creates draft + uploads | Pass (setup) |
| 3–4 | B cannot read/download A’s object | **Pass** |
| 5–6 | B cannot overwrite/delete A’s object | **Pass** |
| 7 | A cannot read B’s evidence metadata | **Pass** |
| 8 | Anon denied Storage + table | **Pass** |
| 9–11 | Pending blocks direct delete; withdraw deletes via lifecycle | **Pass** |
| 12 | Team-owner JWT ≠ member access (no membership policy) | **Pass** |
| — | Client status spoof via UPDATE rejected | **Pass** |

**6/6 tests passed.** Credentials/tokens not logged.
