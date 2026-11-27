# 05 — Responsive and Accessibility Review (P14-D10)

## Desktop (`lg` and up)

- Single row: Brand | Discover ▾ + 4 links | Workspace/Account or Log in/Sign up.
- 9 crowded items → 5 top-level; no wrapping/clipping (flex + `min-w-0`, `max-w-6xl`).
- Active states: underline on hover; dropdown trigger underlines when open.
- No font-size squeezing; 44px targets throughout; focus-visible white rings on carbon.

## Mobile (below `lg`)

- Compact bar: brand + Menu/Close trigger (`aria-expanded`, `aria-controls`).
- Panel: grouped Discover / Explore sections with 11px eyebrow labels, full-width
  44px links, stacked auth (Sign up solid → Log in outline; authed: workspace links
  - Sign out form). No horizontal overflow; no desktop shrinking.
- Tested via static render: `aria-label="Mobile"`, panel ids, both auth states.

## Keyboard / screen reader

- Skip link preserved in layout. Dropdowns: `aria-expanded`/`aria-controls`,
  `role="menu"`/`menuitem`, Escape + outside-pointer close, labelled regions.
- Forms: explicit `<label for>`, `aria-label` on forms, `role="alert"` errors,
  `aria-live` confirmation screen, `aria-pressed` toggles, `aria-describedby`
  password requirements, `autocomplete` (email/current/new-password/name).

## Contrast (existing tokens, unchanged)

- White on carbon, crimson `#C8102E` on white (5.88), white on crimson (5.88),
  `accent-300` text on dark. Decorative crimson keyline only.
