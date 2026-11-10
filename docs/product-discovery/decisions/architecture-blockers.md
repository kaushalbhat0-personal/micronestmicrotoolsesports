# Architecture Blockers and Minimum Freeze

## P0 — Must be decided before architecture lock (4)

- **D-01** title strategy → fixes `GameTitle`/`GameProfile` shape.
- **D-02** recruiter mechanism → fixes membership roles + RLS helpers.
- **D-11** fresh vs migrate tables → fixes migration strategy and whether legacy finder constrains the model.
- **D-14** parity-check authorization → process gate; no backend work (not even typegen) starts without it.

Without these four, foundation schema and authorization cannot be drawn.

## P1 — Before the relevant feature phase (12)

Foundation-adjacent: D-13 (seed), D-18 (`db:types`). Discovery: D-03, D-04 (in-app part), D-09 (principle), D-19 (rule now, mechanism at build). Org/brand: D-06, D-07, D-08 (fields now, numbers pre-launch). Commercial: D-10. Launch: D-15. Tournaments: D-05.

## P2 — Safely deferred (3)

D-12 (dormant tables harmless), D-16 (cosmetic redirects), D-17 (unused deps harmless).

## Minimum freeze per milestone

- **Domain model approval:** D-01, D-02, D-11 (+ D-07 field shape, since it constrains the opportunity entity).
- **Backend foundation:** above + D-14 authorized, D-13, D-18.
- **Player/Team discovery:** + D-03, D-04, D-09, D-19.
- **Org recruitment:** + D-06, D-08 (fields; numbers pre-launch).
- **Brand discovery/opportunities:** D-07 + D-08 enforced; D-10 confirmed if billing ever discussed.
- **News/tournaments:** + D-05; D-15 hardening on the launch checklist, not the build path.

## What stays configurable (no freeze needed)

Filter sets per finder, sort orders, SEO index toggles per entity, note-length and cap numbers (within agreed maxima), SLA/strike numbers (within agreed policy), email provider choice, cron schedule, seed content rows. These live in constants/config plus admin-editable rows — never schema changes.
