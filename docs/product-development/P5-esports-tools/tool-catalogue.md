# Tool Catalogue (P5)

## Categories (frozen enum)

| Key | Label | Populated |
|---|---|---|
| `tournament-operations` | Tournament operations | Yes — Prize Pool Splitter |
| `team-management` | Team management | No (reserved) |
| `scoring` | Scoring | No (reserved) |
| `planning` | Planning | No (reserved) |

The directory filter lists only categories present in the registry, so
reserved categories never render as empty promises.

## Registry entries

### prize-pool-splitter — Prize Pool Splitter (v1.0.0, available)

- **Tagline:** Split a tournament prize pool into exact per-position payouts.
- **Audience:** Tournament organizers, team managers, community admins (BGMI-first).
- **Compatibility:** platform-wide (`gameKeys: null`).
- **Inputs:** total pool (INR/USD, ≤2 decimals), 1–32 rows, positions 1–64
  unique, each row fixed amount or percentage of the total.
- **Outputs:** per-position minor-unit payouts, distributed total,
  unallocated remainder, copyable plain-text summary.
- **Guidance:** percentages ≤ 100%; fixed ≤ total; remainder goes to largest
  fractional shares; unallocated is reported, never absorbed; planning aid
  only — not a payment.

## Availability states

- `available` — runs locally today (Prize Pool Splitter).
- `coming-soon` — landing live, execution not yet (no registry entries yet;
  the landing renders this state and component tests pin it with a
  test-only fixture — no invented roadmap in production).

## Free/paid display

None. No prices, tiers, or entitlement markers exist anywhere in the
catalogue. A future free/paid flag may be added to the contract only when
monetization is explicitly approved — and it is documented here as NOT
approved.
