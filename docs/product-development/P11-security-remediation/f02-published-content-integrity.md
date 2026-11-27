# F-02 published-content integrity

## Finding restated

The P9 lifecycle trigger passes through every same-state update while the
member update policy covers all roles — a member could edit a live listing's
prize, dates, fee, or registration URL without re-review, bypassing
moderation intent while keeping `Published` status.

## Fix: `20261113000002_p11_f02_published_integrity.sql` (proposal, unapplied)

`public.freeze_published_tournament_content()` (`BEFORE UPDATE`,
`security invoker`, empty search path, revoked from API roles): when
`OLD.lifecycle = 'published'`, any change to a content column raises with
`published tournament content is frozen: unpublish before editing`. The only
permitted change to a published row is the `published → unpublished`
lifecycle transition itself (system columns `updated_by`/`updated_at` ride
along; `published_at` history is preserved, never cleared). Complements the
P9 lifecycle trigger (transitions vs content — disjoint concerns; alphabetical
firing order cannot affect correctness).

## Material field table (strictest safe default — zero non-material fields)

| Field | Why material |
| ----- | ------------ |
| `title` | Renaming misrepresents what was approved |
| `game_key` | Changes the entire competitive context |
| `region_code` | Changes who the listing is for |
| `format` | Changes eligibility and fairness |
| `starts_at` / `ends_at` / `timezone` | Change the commitment / actual attendance |
| `entry_fee_minor` / `prize_pool_minor` / `currency` | Change the financial commitment; prize edits are the classic bait-and-switch |
| `description` | Can rewrite rules after approval |
| `organizer_kind` / `organizer_name` / `organizer_slug` / `organizer_id` | Reframe accountability; moves break the isolation boundary |
| `registration_url` | Redirects users off-platform |
| `contact_instructions` | Can smuggle scam URLs after approval |
| `registration_closes_at` | Changes who can still register |
| `eligibility` | Changes who may compete after approval |
| `published_at` | Live-history must survive unpublish |

System columns (`id`, `slug`, `created_by`, `created_at`, `updated_by`,
`updated_at`, `lifecycle`) are excluded: lifecycle transitions stay governed
by the P9 trigger, system columns by writers. Mirrored in code as
`MATERIAL_TOURNAMENT_FIELDS` + `MATERIAL_FIELD_RATIONALE`
(`src/features/moderation/domain/material-fields.ts`), pinned 1:1 against
the migration text by `f02-content-integrity.test.ts`.

## Lifecycle consequences

- No silent content changes while `Published` (any of 20 columns).
- No direct publication bypass (`draft → published` has no path for any
  role, moderator included).
- No cross-organizer editing (update contracts omit
  `organizer_id/slug/gameKey`; RLS joins on the row's own organizer; the
  freeze additionally locks `organizer_id` on published rows).
- Unpublish stays explicitly authorized (owner/admin/moderator; editors
  excluded); republication stays moderator-only and disabled.
- New submission required before republication: edit as `unpublished` →
  `draft → submitted` → moderator review. History is never rewritten
  (no delete path anywhere).

## Relaxation path (requires approval)

Individual safe fields (if owners ever want one, e.g. a typo fix in contact
text without full resubmission) require owner approval **plus a migration
edit** removing the column from the freeze list. A code-only allowlist is
impossible by construction — the database is the allowlist.

## Evidence

`src/features/moderation/tests/f02-content-integrity.test.ts` (13 tests):
per-field freeze clauses, published-only firing, lifecycle/system-column
separation, hardened convention, full rationale coverage, bypass/republish
matrix.
