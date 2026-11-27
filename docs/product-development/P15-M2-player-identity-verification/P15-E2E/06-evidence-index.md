# 06 — Evidence index

## Roles (no secrets)

| Role | Representation |
| --- | --- |
| Player A | Ephemeral JWT (`m2b4_*` / `m2b3c_*` test users) |
| Player B | Second ephemeral JWT |
| Reviewer | Ephemeral JWT + temporary `platform_admins` (deleted after suite) |
| Operator super-admin | **Not provisioned** (`platform_admins` count 0) |
| Anonymous | Playwright unauthenticated browser |

## Screenshots (no passwords / JWTs / signed URL query / BGMI IDs)

| File | Shows |
| --- | --- |
| `evidence/moderation-anon-denied.png` | Review page requires sign-in; no approve |
| `evidence/moderation-index-anon.png` | Moderation index sign-in gate |
| `evidence/settings-anon-gate.png` | Settings without verification upload |

## Automated run logs (commands)

```text
G1_TEST_MODE=m2b4 npm run test:integration -- bgmi-ownership-review.integration
→ 8 passed

G1_TEST_MODE=m2b3c npm run test:integration -- bgmi-ownership-storage.integration
→ 6 passed

npx vitest run … public-projection … bgmi-ownership-review … ui …
→ 20 passed

npx playwright test e2e/p15-e2e-acceptance.spec.ts
→ 3 passed
```

## DB observations (no PII)

- Pre-cleanup: 2 leftover `pending_review` cases from prior incomplete test auth deletes — cleaned by deleting cases for `m2b4_%` / `m2b3c_%@example.com` only.
- Post-cleanup: `pending_review = 0`, durable `platform_admins = 0`.
- `bgmi_ownership.*` audit rows may remain (append-only); expected.
