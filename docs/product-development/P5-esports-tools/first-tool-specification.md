# First Tool Specification — Prize Pool Splitter v1.0.0

## Why this tool

Evaluated against the brief's criteria and the archived legacy concepts:

- **Prize-pool distribution calculator** (brief's suggested default): clear
  value for BGMI organizers/teams (P3 already presents prize pools as
  display-only — organizers need planning math), no market data or APIs,
  deterministic, zero personal data, trivially testable. **Selected.**
- **Roster/slot parser** (legacy ADAPT-marked logic): real organizer value,
  but higher input complexity and a larger trust surface (pasted personal
  data). Deferred to a later phase with a privacy review.
- **Tie-breaker resolver**: needs competition-rule decisions not yet made.
  Deferred.
- **Qualification simulator**: prototype-grade, explicitly RETIRE-as-product.
  Rejected.

The legacy Prize-Splitter engine was **not** imported or ported; the idea
was reimplemented fresh under greenfield conventions (integer minor units,
Zod boundaries, static audit).

## Exact behavior

1. **Total:** decimal-major string, optional grouping commas, ≤2 decimals,
   0 ≤ total ≤ 1,000,000,000,000 minor units. Parsed without floating point.
2. **Currency:** INR or USD only (case-insensitive input, normalized).
   Formatted with `Intl` (`en-IN` / `en-US`), whole units without decimals.
3. **Rows:** 1–32 rows; `position` unique integer 1–64; each row `fixed`
   (amount string, same grammar as total) or `percent` (0–100, ≤2 decimals,
   stored as integer basis points).
4. **Coherence:** percentage sum ≤ 100%; fixed sum ≤ total; duplicates/out-of
   range rejected with field-level messages.
5. **Distribution (pure engine):** fixed amounts first; percentage shares are
   floored from the FULL total, then leftover minor units go to the largest
   fractional remainders (ties → better position). Shares sorted by position.
6. **Closure:** `distributed + unallocated === total` always (property-tested
   across 1-paise to 10^12-minor-unit totals).
7. **Unallocated:** reported explicitly, never silently absorbed.
8. **Outputs:** per-position table, distributed/unallocated line, copyable
   plain-text summary (clipboard API with silent fallback), Reset restores
   defaults, Recalculate re-validates.

## Explicit non-behavior

- Not a payment, transfer, escrow, or custody service (stated in UI + summary).
- No persistence, history, accounts, share links, or analytics.
- No fees, commissions, or platform cut — the engine has no such concept.
