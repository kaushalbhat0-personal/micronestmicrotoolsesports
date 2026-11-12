# P3 Product Scope

## Pillar fit

Tournaments is the second competitive pillar after Teams & Discovery (P1)
and Team Management (P2): discover → manage → compete. The launch title is
BGMI; the domain is game-agnostic with BGMI-only validation boundaries
today (same posture as P1/P2).

## In scope (shipped)

- Tournament directory: name search, catalogue-driven game filter, region
  filter, status filter, Upcoming/Ongoing/Completed sections, entry-fee +
  prize-pool presentation, registration availability indicators, bounded
  pagination (24/page, 42 pages max), empty/unavailable/invalid-filter
  states.
- Tournament detail: CSS banner treatment, title + description, game +
  region + format, organizer identity (kind + name + unverified note),
  timezone-aware dates, fee + prize ("Not disclosed" when absent),
  eligibility + participation requirements, external registration handoff
  (verbatim https URL, `rel="noopener"`, leaves-site note) or contact
  instructions, trust + reporting notes.
- Publishing/editing/unpublishing validation contracts + disabled,
  unrouted form foundation (strict Zod, kill-switched writer).

## Out of scope (absent, no code)

Brackets, match scheduling, live scoring, payment collection, prize
distribution, tournament operations, automated competitive result
verification, organizer routes, moderator tooling.

## Non-goals enforced

- No invented tournaments, prize pools, organizers, registrations, media,
  testimonials, or partnerships.
- No verification badges (organizer `verified` frozen false, stated).
- No in-platform registration (reserved type only, never accepted).
- No organizer-is-organization assumption; no org authority anywhere.
