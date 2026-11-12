# Accessibility Review (P7.1)

Method: full read of all three runners + both tool pages (two independent
passes), verified with grep and confirmed by the new interaction suite
(keyboard activation, focus, live-region assertions).

## Fixed in this phase (demonstrable gaps, no behavior change)

1. **Missing focus style** — prize Split-type `<select>` lacked all
   `focus-visible:*` classes. Added to match every other control.
2. **Unlinked row errors** — prize Position/Amount/Percent inputs set
   `aria-invalid` but had no `aria-describedby` to their `role=alert`
   messages (only the Total field linked correctly). Wired per-row.
3. **Unlinked add/edit errors** — roster and tiebreak `Labelled` rendered
   `role=alert` errors without associating the input. `Labelled` now
   injects `aria-describedby` + `aria-invalid` via `cloneElement` when an
   error is present (per-file, no shared abstraction; tiebreak cells already
   linked and untouched).
4. **One-step destructive reset** — prize Reset discarded the whole form
   immediately while roster/tiebreak require confirmation. Aligned to the
   two-step pattern (Reset → Confirm reset + Keep values), preserving the
   domain vocab ("Keep values" for a calculator).

## Verified as-is (PASS, no change)

Labels for every input; discernible button names (aria-labels on icon-only
actions); `role=alert` on all failures; `aria-live` standings/summaries;
`role=status` empty states; progressbar min/max/now; heading order
(h1 → h2 → h3); no keyboard traps (single Enter-to-submit on a text input,
no preventDefault, no div-click handlers); card layouts, no `<table>`;
summaries `overflow-x-auto + whitespace-pre-wrap`; contrast unchanged
(existing palette).

## Residual observations (not defects)

- Roster edit grid stays 2-column on small phones (short ID/role inputs;
  no overflow — asserted in the mobile test).
- `min-w-52` flex child in tiebreak teams section wraps safely (asserted).
- Dev-only React hydration note for module-level row-id counters in the
  prize runner (SSR/client id sequence); benign, pre-existing, no user
  impact — recorded, not changed.
