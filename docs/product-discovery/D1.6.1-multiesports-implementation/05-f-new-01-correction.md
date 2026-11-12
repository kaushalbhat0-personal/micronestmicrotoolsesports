# 05 — F-NEW-01 Correction (insert-time decision forgery → FIXED static)

## Defect (D1.5.2)

M2 applicant-insert policy constrained applicant/status/active but not
`decided_*`; M3's boundary trigger is UPDATE-only. An applicant could INSERT
`{status:'applied', decided_by:X, decided_at:Y}` — forged provenance on a
non-decided row (Medium: misleading, not an escalation).

## Correction (`20261112000004`, additive; existing files untouched)

Recreated `"applications applicant insert"` WITH CHECK adds
`decided_by IS NULL AND decided_at IS NULL` alongside the preserved
`applicant=auth.uid() + status='applied' + active` guards. Status behavior
unchanged; withdraw-only UPDATE path untouched; no captain workflow introduced
(no `accept/decide` identifiers in the file).

## Why this needs no D1-D12 semantics

Creation carrying no decision is entailed by the already-enforced withdraw
contract (UPDATE requires null `decided_*`); it assumes nothing about future
transitions, windows, or who decides.

## Interaction with future decision RPCs

- The M3 withdraw trigger stays UPDATE-only by design and keeps rejecting
  non-null `decided_*` from every role, including service-role/DEFINER writers.
  The future captain RPC must therefore own an explicit trigger revision
  (FWD-01): e.g. allow `decided_*` writes only on the decided transitions while
  keeping applicant writes null-bound — a change owned by the approved
  captain-decision migration, never by this correction.
- Service-role inserts bypass RLS (engine) but remain app-layer governed; no
  trigger change is made for privileged paths in this phase.

## Tests

`application-insert-boundary.test.ts` (static): nullness present, identity/
status/active preserved, no captain workflow, indexes additive-only, no
table/trigger/grant changes. Replay RT-04b still required (disposable env).
