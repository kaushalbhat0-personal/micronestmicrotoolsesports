# 32 — Player Directory Accessibility (P14-B4 Phase 6)

Method: Playwright Chromium vs dev server (E2E spec `e2e/players.spec.ts`,
6 tests) + static unit assertions + computed DOM audit (same harness as
P14-B3 doc 25). No axe-core in toolchain; no full WCAG conformance claimed.

## Verified behavior

| Requirement | Evidence |
|---|---|
| Search submit + clear | GET submit navigates (`?query=…`), Reset/Clear links to `/players`; search input is `type=search` (native clear) |
| Filter application | Apply submits all four controls; values preserved from URL (unit + E2E) |
| Individual removal | Each chip links to directory-minus-one-filter; E2E clicks chip → param gone, chip row empty |
| Clear all | `/players` link in chip row + Reset button + empty-state Clear filters |
| Sort selection | N/A — no sort control ships (no approved contract; omitting beats a fake control) |
| Pagination | Prev/Next links preserve filters, `rel` prev/next, `aria-current="page"`, disabled ends `aria-disabled`; unit-covered |
| Mobile open/close | Disclosure button `aria-expanded`/`aria-controls`; Escape closes; focus moves into panel on open; E2E covers open→Escape |
| Profile navigation | Card title + View Profile links use `/players/${handle}` (unit); E2E asserts zero `href="#"` |
| Keyboard | All controls native (links/buttons/selects/input); 44px targets; visible `focus-visible` rings; chips are links, removable by keyboard |
| Labels | Every control labelled (`for`/`id` ×4, unit-asserted); chip links carry `Remove <Filter> <value>` labels; pagination nav labelled; results `role=status`; invalid notice `role=status`; unavailable `role=alert` |
| State announcements | Every filter/sort/page action is a full GET navigation (new document announced); regions use `role=status`/`alert`; skeleton carries an accessible loading label |
| Reduced motion | Only `animate-pulse` skeleton (respects the global `prefers-reduced-motion` guard that forces 0.01ms); no transitions/animation added |
| Touch targets | Buttons/links/selects/inputs `min-h-[44px]`; chips 44px rows; pagination 44px (computed audit: 0 violations pattern as B3) |

## Defects found and fixed during B4

1. Filter panel hidden on desktop (`hidden` attribute) — fixed to
   breakpoint-aware `hidden lg:block` / `block`; caught by E2E before merge.
2. Empty state lacked a live-region role — added `role="status"` to the
   empty panel for AT announcement parity with other states.

## Limitations

- Screen-reader pass not performed (same standing limitation as B3).
- Populated-card AT order (band → name → chips → bio → action) verified by
  DOM order only, not by live reader run (local DB empty; cards unit-tested
  with reader-shaped fixtures).
