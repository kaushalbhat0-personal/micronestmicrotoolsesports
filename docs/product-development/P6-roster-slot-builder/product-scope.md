# Product Scope (P6)

## The tool

Roster & Slot Builder v1.0.0 (`roster-slot-builder`) — a roster composition
utility for team managers, coaches and tournament organizers planning BGMI
lineups. It answers three questions: who is on my plan, where does each
person sit, and what is still missing.

## In scope (shipped)

- Manual player entry: display name (required), optional player ID, role,
  slot target, short note.
- Player list with edit and two-step-confirmed remove.
- Starter slots (1–6, default 4) and substitute slots (0–6, default 2),
  both user-configurable per plan.
- Assign / unassign via per-player slot control; occupied slots are never
  overwritten.
- Completeness model: Empty / Partial / Complete with an itemized
  needs-attention list (empty starter slots, unassigned players).
- Copyable plain-text roster summary generated locally.

## Explicitly out of scope (not shipped, per brief)

- CSV/spreadsheet, image or document uploads; OCR or roster extraction.
- External player lookups, identity verification, account linking.
- Database persistence, server-generated share links.
- Recruitment, tournament registration, or eligibility rulings.
- Any claim of official BGMI, tournament or organizer validation.

## Non-goals carried from P5

No database, no auth, no billing/entitlements, no analytics, no network
calls from tool routes (static audit still passes unmodified).
