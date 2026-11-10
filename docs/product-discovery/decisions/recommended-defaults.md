# Recommended Defaults (Fast Approval Table)

> Owner update (D-14 audit phase): D-01, D-02, D-11, D-14 are **APPROVED BY PRODUCT OWNER**. The owner accepted this table as the working product direction; all other rows remain **RECOMMENDED** pending per-phase approval. D-08 and D-09 remain **OPEN**. No other statuses changed.

| ID | Decision | Recommended default | Status |
|---|---|---|---|
| D-01 | Title strategy | BGMI data, multi-title-ready schema | APPROVED BY PRODUCT OWNER |
| D-02 | Recruiter mechanism | Distinct least-privilege role | APPROVED BY PRODUCT OWNER |
| D-03 | Stranger contact | Vacancy-pointer only, no DMs | RECOMMENDED |
| D-04 | Notifications | In-app queue MVP, email later | RECOMMENDED |
| D-05 | Tournament organizers | Editorial listing only | RECOMMENDED |
| D-06 | Staff shape | Single generic staff type first | RECOMMENDED |
| D-07 | Compensation disclosure | Required framing (explicit unpaid allowed) | RECOMMENDED |
| D-08 | SLA + strikes | — (owner must set numbers) | OPEN |
| D-09 | Caps/note length | Principle agreed; numbers at build time | OPEN (numbers) |
| D-10 | Paywall | Never gate discovery/applications | RECOMMENDED |
| D-11 | Domain tables | Fresh tables, legacy patterns reused | APPROVED BY PRODUCT OWNER |
| D-12 | Legacy tables fate | Dormant indefinitely, revisit post-MVP | RECOMMENDED |
| D-13 | Legacy seed | Fresh minimal seed for new envs | RECOMMENDED |
| D-14 | Parity check | Authorize read-only inspection | APPROVED BY PRODUCT OWNER (read-only only) |
| D-15 | Auth hardening | Build now, harden pre-launch | RECOMMENDED |
| D-16 | Stale redirects | Remove at first routing pass | RECOMMENDED |
| D-17 | Billing deps | Keep until billing scoped | RECOMMENDED |
| D-18 | `db:types` fix | Fix with first backend change | RECOMMENDED |
| D-19 | Expiry automation | Vercel Cron daily sweep (fallback: enforce-on-read) | RECOMMENDED |

## Product principles validation (25 items checked against the package)

Principles 1–19 hold with two clarifications and one gap:

- **Consistent:** 1 (one identity), 2–3 (player + game profiles), 4–5 (independent/org teams, divisions), 7 (verified reps), 8–9 (shared engine, one lifecycle with two intensities — Interest vs Application share the lifecycle, so no contradiction), 10–11 (consent + masked projections), 12–13 (no DMs; interactions originate from opportunities), 14 (brand verification before publish), 15 (no fake scores/claims), 16 (no paywall), 17–19 (editorial news, discovery-only tournaments, secondary mini games).
- **Clarified:** Principle 6 (independent recruitment permissions) is the *capability*; D-02 decides the *mechanism* (recommended: distinct role). Principle 9's "one lifecycle" explicitly permits two entry intensities sharing it.
- **[Gap / missing definition]:** "Verified" needs per-badge method+date display rules; "hiring-now / active-opportunity" needs derivation rules; compensation-framing enum values need freezing (D-07); brand claim flow (name-squatting) is referenced but not specified — added as implicit sub-item of D-08.
- **No contradictions found** between journeys, finders, opportunities, trust, domain, RLS, architecture, and roadmap documents.
