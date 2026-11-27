# 06 — Decision Dependency Map

## Amendment D1.6.1 (2026-11-11) — approved context (history preserved)

The multi-esports architecture principle is APPROVED (wording in D1.6.1 `01`).
It sets direction for {D1-D2, D1-D4, D1-D5} — multi-title-ready, BGMI-first,
per-title vocabularies, future cross-game orgs under a separately approved
authority model — but approves none of their exact behaviors. The clusters
below stand unchanged; in particular D1-D2 (one-game team rows) still needs its
own approval, and D1-D5's vocabulary contract is not approved by the principle.

## Joint-approval clusters (approve together or defer together)

- **Authority core {D1-D3, D1-D10, D1-D12}:** who decides applications depends on
  the captain model; transfer changes who the owner-captain is; the lifecycle
  contract binds both. Approving one without the others leaves authorized actors
  undefined. The permission matrix (`02`) + lifecycle contract (`03`) are the
  joint artifact.
- **Org vs owner {D1-D4, D1-D10}:** if org ownership ever exists, owner and
  org-admin precedence must be decided at once — approving transfer mechanics
  without it strands future org teams.
- **Deletion × evidence {D1-D9 + deletion flows}:** report fate must match the
  account/team purge procedure line-for-line.
- **Contract × triggers {D1-D12 + F-NEW-01 + withdraw trigger}:** the insert
  `decided_*` fix and any trigger revision ship with the lifecycle contract,
  not separately.
- **Transfer × freeze {D1-D10 + immutable-team trigger}:** the transfer RPC
  must own its trigger revision (FWD-02); the freeze cannot be lifted by any
  smaller change.
- **Vocabulary × schema {D1-D5 + catalogue + team schema}:** new titles touch
  catalogue, CHECKs, and Zod together — one decision per title.

## Independently approvable

D1-D5 (BGMI set), D1-D6 (self-reported tiers), D1-D7 (defer verification),
D1-D11 (free D1), D1-D1 (multi-team), D1-D8 caps (b). Each takes effect without
the others; none unblocks or blocks the authority core alone.

## Blocking ranking (most blocking first)

1. D1-D12 lifecycle + privacy (recruitment cannot go live unspecified).
2. D1-D3/D1-D10 authority + transfer (no authorized writers otherwise).
3. D1-D9 retention (no live reports under undecided retention).
4. Remainder (safe defaults already fail closed).
