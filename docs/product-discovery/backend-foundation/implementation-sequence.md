# Implementation Sequence **[Proposed]**

Each stage lists migration dependencies, objects, RLS, code boundaries, tests, acceptance. Stages are sequential; nothing starts until the migration-baseline approach + P0 freeze are owner-confirmed.

## Stage 0 — Environment & tooling baseline

- PG major alignment (17), `db:types` local-first fix, staging replay proof of the 58 files (post duplicate-version fix), advisor baseline snapshot.
- Acceptance: clean reset + catalog diff vs live inventory (schema objects only) + working typegen. No production interaction.

## Stage 1 — Baseline marker (first and only history-touching step)

- No-op marker migration citing the parity audit; establishes forward lineage. No backfill of the 47 rows.
- Acceptance: `list_migrations` shows the marker onward; live schema otherwise byte-identical.

## Stage 2 — Identity & game foundation

- `game_titles` (+BGMI seed per D-13 minimal-seed decision), role CHECK widening prep (no recruiter yet).
- RLS: catalogue reads; admin writes. Tests: unit (validation) + replay.

## Stage 3 — Player & game profiles + verification queue

- Tables, masked views, submission flow, reviewer reads. Tests: mandated cases 1 & 7 + leakage suite.

## Stage 4 — Teams & memberships

- Teams, memberships, captain guards, last-admin protection. Tests: mandated case 2 + transfer suite.

## Stage 5 — Org adaptation (D-02 approved)

- Role CHECK widening owner|admin|recruiter|member, `is_org_recruiter()`, divisions link, recruiter policies. Tests: mandated case 3 + isolation suite.

## Stage 6 — Opportunity + application engine

- Opportunities, applications, partial uniques, sweep function (mechanism per D-19), publisher gates. Needs D-07/D-09 values at build. Tests: mandated case 5 + lifecycle + publishing-gate suites.

## Stage 7 — Brands & verification-before-publish

- Brands, representatives, triple-gate enforcement. Tests: mandated cases 4 & 6.

## Stage 8 — Trust hardening + notifications + content

- Reports/strikes, moderation queues, notification queue, news, tournaments. Needs D-08 numbers pre-launch (fields now).

## Stage 9 — Storage & hardening pass

- Prefixes, bucket limits, signed-URL flows, search_path hardening on the 8 flagged functions, anon-RPC necessity review, advisor-clean sign-off.
