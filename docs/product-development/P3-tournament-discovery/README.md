# P3 — Tournament Discovery & Promotion

Status: implemented (discovery experience complete; data + publishing gated by design).

## What shipped

The tournament discovery and promotion vertical: public tournament
directory (`/tournaments`) with game/region/status search, status sections,
fee/prize and registration indicators; tournament detail
(`/tournaments/[slug]`) with CSS banner treatment, timezone-aware dates,
eligibility, external registration handoff, organizer identity, and trust
notes; plus validation-complete publishing contracts with a kill-switched
writer. No tournaments, prize pools, organizers, or registrations invented.

## Map

| Doc | Contents |
| --- | --- |
| `01-product-scope.md` | Product scope (in/out, pillar fit) |
| `02-routes-components.md` | Routes and components inventory |
| `03-domain-contracts.md` | Tournament domain contracts |
| `04-data-model.md` | Data model proposal (acceptance target) |
| `05-publishing-moderation.md` | Publishing and moderation boundaries |
| `06-security-report.md` | Security report |
| `07-test-evidence.md` | Test evidence (static vs runtime labelled) |
| `08-organizer-future.md` | Organizer integration requirements + next phase |

## Headline verdicts

- **Functional:** directory shell, filters, status sections, pagination,
  cards, detail, empty/invalid/unavailable states, static audits.
- **Presentation-only (explicitly disabled):** publishing form (unrouted
  foundation, no action, disabled submit).
- **Out of scope, absent:** brackets, scheduling, scoring, payments, prize
  distribution, operations, result verification, organizer routes.
- **Database integration:** contract-proposed, **no migration exists and
  none applied** — reads resolve to the honest unavailable state.
- **G1/P1/P2:** unchanged. Full suite green (541 passed).
