# Decision Register — README

**Status:** All decisions below are **OPEN** or **RECOMMENDED**. Nothing is approved.
**Scope:** Covers all 19 items from `../open-decisions.md` (D-01–D-19). No decision omitted.
**Authority:** Only the product owner can mark a decision APPROVED. The architect recommends; the owner disposes.

## Files

- `decision-register.md` — full register: question, why it matters, alternatives, impact, dependencies, blocking scope, deferrability.
- `recommended-defaults.md` — the recommended default per decision in one table, for fast approval.
- `architecture-blockers.md` — P0 items that gate the architecture lock + minimum freeze per milestone.
- `scope-freeze-proposal.md` — proposed frozen scope per phase and what stays configurable.

## Status values

- **OPEN** — awaiting product-owner input; no recommendation stated (rare; used where input is genuinely required, e.g. SLA numbers).
- **RECOMMENDED** — architect's proposed default; becomes the plan only after owner approval.
- **APPROVED BY PRODUCT OWNER** — never set by the architect. Reserved for explicit owner authorization.
- **DEFERRED** — consciously parked to a named later point; not forgotten.

## Note on live-backend access

A request was made to use a Supabase access key from the environment. This was **not** done: this phase is documentation-only, environment values are never read or printed, and live-project inspection is itself open decision **D-14**, which requires explicit authorization (what may be inspected, by whom, read-only). Proceeding without that approval would pre-empt the owner's decision. See D-14.
