# F-02 content integrity decision (per-field)

Recommendation: **adopt the strict default** — every field below is material;
editing any of them on a `published` row requires unpublish → edit →
resubmit → moderator review. A future non-material exception for any single
field requires explicit owner approval **plus a migration edit** (the
database is the allowlist; code cannot relax it).

| # | Field | Why material | Edit requires unpublish + resubmit? | User impact | Future exception safe? |
| - | ----- | ------------ | ----------------------------------- | ----------- | ---------------------- |
| 1 | `title` | Renaming misrepresents the reviewed listing | Yes | Typo fix costs a cycle | No — identity of the listing |
| 2 | `game_key` | Entire competitive context changes | Yes | Rarely legit post-publish | No |
| 3 | `region_code` | Changes who the listing is for | Yes | Rarely legit post-publish | No |
| 4 | `format` | Team/individual changes eligibility + fairness | Yes | Rarely legit post-publish | No |
| 5 | `starts_at` | Moves the commitment reviewed | Yes | Schedule slips hurt, but silent moves hurt more | No — time is the commitment |
| 6 | `ends_at` | Moves the commitment reviewed | Yes | Same as start | No |
| 7 | `timezone` | Reinterprets all event times | Yes | Display-only in theory; authority-relevant in practice | Marginal — reassess only with rendering proof |
| 8 | `entry_fee_minor` | Changes the financial commitment | Yes | Fee corrections cost a cycle | No — money is the classic switch |
| 9 | `prize_pool_minor` | Prize edits are the classic bait-and-switch | Yes | Same as fee | No |
| 10 | `currency` | Revalues fee + prize silently | Yes | Same as fee | No |
| 11 | `description` | Can rewrite rules after approval | Yes | Iterative refinement costs cycles | No — rules live here |
| 12 | `organizer_kind` | Reframes accountability | Yes | Rarely legit post-publish | No |
| 13 | `organizer_name` | Reframes accountability | Yes | Rarely legit post-publish | No |
| 14 | `organizer_slug` | Reframes accountability / link target | Yes | Rarely legit post-publish | No |
| 15 | `organizer_id` | Moves the listing between organizers; breaks isolation | Yes | Never legit post-publish (create a new listing) | No |
| 16 | `registration_url` | Redirects users off-platform post-approval | Yes | URL rotations cost a cycle | No — redirect target is trust |
| 17 | `contact_instructions` | Can smuggle scam URLs post-approval | Yes | Typo fixes cost a cycle | Marginal — reassess only with abuse evidence of safety |
| 18 | `registration_closes_at` | Changes who can still register | Yes | Deadline extensions cost a cycle | No — deadline is the gate |
| 19 | `eligibility` | Changes who may compete post-approval | Yes | Rule tuning costs a cycle | No |
| 20 | `published_at` | Live-history must survive unpublish | Frozen (not editable at all on published rows) | None — system-set at publish | No |

## Activation conditions

1. Owner approves D-12 (strict default) — silence counts as approval of the
   default; any exception must be named explicitly.
2. P11 file 02 is applied unchanged in the authorized replay (no clause
   removed, no field dropped from the freeze list — pinned by
   `f02-content-integrity.test.ts` against the applied text).
3. The P13 review UI surfaces the freeze honestly ("published listings are
   frozen; unpublish to edit") so organizers meet no surprise.

## What is NOT relaxed by activation

The activation migration (see `activation-migration-proposal.md`) replaces
the P9 lifecycle *transition* function to add moderator-gated paths; it does
not touch, narrow, or reorder the F-02 freeze trigger. Weakening F-02 is
impossible without a new migration file, which is itself gated on a new
owner decision — asserted in `clause-by-clause-security-review.md`.
