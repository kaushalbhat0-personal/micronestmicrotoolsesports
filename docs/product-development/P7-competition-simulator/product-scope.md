# Product Scope (P7)

## The tool

Tie-Break & Qualification Simulator v1.0.0 (`tiebreak-qualifier`) — a
planning simulator for organizers and teams. Users build a scenario (teams
+ self-defined scoring criteria), configure weights/directions/priority and
a qualification cutoff, and get standings with plain-language explanations.

## In scope (shipped)

- Scenario setup: optional name, cutoff 0 (off) – 24.
- Team management: add / rename / remove (two-step confirm), 24 max.
- Criteria management: add / edit / remove (two-step confirm), reorder
  priority, weight −1000…1000, higher-wins / lower-wins direction, 8 max.
- Per-team whole-number scores (−10⁶…10⁶); blanks allowed (missing policy).
- Live standings: exact totals, per-team breakdowns, tie explanations,
  qualification badges.
- What-if snapshots: save / restore (two-step) / delete, in memory.
- Copyable plain-text summary; two-step reset.

## Explicitly out of scope

- Official BGMI or any tournament scoring rules (none assumed, none shipped).
- Placement/kill point tables, formats, eligibility rulings.
- Live tournament data, integrations, imports, player lookups.
- Persistence, share links, accounts, analytics, payments.
- Any claim that output is official, approved, or universally applicable.

## Non-goals carried from P5/P6

No database, no auth, no entitlements, no network calls from tool routes
(static audit passes unmodified with the new runner included).
