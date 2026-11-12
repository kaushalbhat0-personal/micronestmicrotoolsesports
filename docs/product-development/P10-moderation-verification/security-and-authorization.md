# P10 security and authorization

> Evidence, not claims. Runtime PostgreSQL/RLS verification is blocked (see
> `runtime-verification.md`); everything below is static review + simulated
> authorization tests. Behaviors that require a live database are labeled
> **[needs runtime]**.

## RLS matrix (static; policies in 05/06 read in full)

| Table | anon SELECT | authenticated SELECT | INSERT | UPDATE | DELETE |
| ----- | ----------- | -------------------- | ------ | ------ | ------ |
| `organizers` | none (RPC-only) **[needs runtime]** | own-organizer rows (membership + active) | active account, `created_by = auth.uid()` | owner/admin of row's organizer + active | none |
| `organizer_members` | none | own rows (`user_id = auth.uid()` + active) | none (invitation workflow pending) | none | none |
| `tournaments` | none (RPC-only) **[needs runtime]** | rows of own organizer (membership + active) | active + member of target organizer, `created_by` session-bound | member of row's organizer + active | none |

No anon policy exists on any operation. Public reads resolve through the four
masked SECURITY DEFINER RPCs (empty search path, revoked-from-public,
`EXECUTE` to `anon, authenticated`) **[needs runtime]**.

## Grant matrix (static; revoke/grant statements read in full)

- `organizers`: authenticated `select/insert/update`; anon/public revoked
  (incl. `delete, truncate, references, trigger`).
- `organizer_members`: authenticated `select` only.
- `tournaments`: authenticated `select/insert/update` (06, after 05's full
  revoke); `delete/truncate/references/trigger` revoked.
- Functions: helpers revoked from all; the four masked RPCs granted to
  `anon, authenticated`; `is_super_admin()` executable by `authenticated`
  (D1), never referenced by P9/P10 SQL.

## Role boundaries (tested, simulated)

- Owner/admin/editor matrix: permission unit tests green (P9 suites +
  `src/features/moderation/tests/`).
- `canTouchVerification()` = false for every role including moderator.
- `assertModerationTransitionAllowed()` / `assertModeratorActionAllowed()`
  throw unconditionally (no database touch).
- Forged `trust_state`/`lifecycle`/identity values rejected at parse
  (strict schemas, protected-key rejection).
- Cross-organizer isolation: RLS joins on the row's own `organizer_id`;
  update schemas omit `organizer_id/slug/gameKey`; workspace readers scope
  by session membership. **[needs runtime]** for the RLS half.

## Load-bearing gaps (from `migration-review.md`, binding)

- **F-01:** `trust_state` not column-protected (application boundary only).
  Required fix before any `confirmed` indicator is authoritative.
- **F-02:** same-state edits to `published` rows need no re-review.
  Required fix (strict freeze or reviewed-diff rule) before publication.
- **F-03:** no founding-owner INSERT path exists; the kill switch alone
  cannot enable writes. A narrow self-insert migration must precede any flip.

## What P10 does NOT claim

No moderator authority exercised, no verification approved, no queue listed,
no reporter identity handled (intake disabled), no remote write performed,
no service-role usage in any request path (static audits green).
