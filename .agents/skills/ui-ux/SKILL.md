---
name: ui-ux
description: "Use for any UI change — enforces design-system-first, mobile-first, a11y, and consistency. Adapts the machine-level ui-ux-pro-max skill for this project."
---

# UI/UX — Project Adapter

**When to use:** Designing, building, reviewing, or fixing any interface: pages, components, design tokens, responsive, a11y, charts, navigation.

**When not to use:** Pure backend/API/DB without visual impact.

**Local source of truth:** `src/components/ui/` primitives, `src/styles/globals.css` tokens. Do not overwrite the machine-level skill at `~/.agents/skills/ui-ux-pro-max/SKILL.md` — adapt it.

## Machine Skill (do not copy, reference)

- **Location:** `~/.agents/skills/ui-ux-pro-max/SKILL.md` (and `design`, `ui-styling` siblings) — 79 styles, 192 palettes, 74 font pairings, 119 UX guidelines, 105 icons, GSAP presets. Full searchable data via `~/.agents/skills/ui-ux-pro-max/scripts/search.py` (requires Python).
- **Priority categories** (from `ui-ux-pro-max`): 1. Accessibility (contrast 4.5:1, alt, keyboard, aria), 2. Touch & Interaction (44px min, 8px spacing, loading), 3. Performance (WebP/AVIF, CLS <0.1), 4. Style Selection, 5. Layout & Responsive (mobile-first), etc. See `references/quick-reference.md` in that skill for full 119 guidelines.

**How to use:** Keep this file project-specific. For deep guidance, read or search the machine skill; do not duplicate its 16k lines here.

## Project Rules (override generic if conflict)

- **Design-system-first:** Reuse `src/components/ui/` — `Button` (6 variants), `Input`, `Label`, `Card`, `Badge`, `Table`, `Dialog`, `Dropdown`, `EmptyState`, `LoadingState`, `ErrorState`, `PageHeader` `src/components/ui/index.ts:1`. Do not create duplicated primitives. Check `src/styles/globals.css:1` `@theme` tokens (`background`, `primary`, `destructive`, `border`, `radius`, etc., dark via `prefers-color-scheme`) before adding new colors/spacing.
- **Mobile-first + responsive:** Default `flex-col`, `sm:`, `lg:` as in `DashboardShell`. Test 375px → 1280px. No horizontal scroll, no fixed `px` containers.
- **Semantic + a11y:** `PageHeader` uses `h1`, `CardTitle` `h3`, `Dialog` `role="dialog" aria-modal`, `Dropdown` `role="menu"/menuitem`, focus rings `focus-visible:ring-2`, keyboard: Escape closes Dialog/Dropdown, 44px touch targets, 4.5:1 contrast via tokens.
- **States:** Every interactive flow has loading/empty/error/success — use `LoadingState` `role="status"`, `EmptyState` dashed, `ErrorState` destructive. No placeholder-only labels.
- **Consistency between microtools:** Same spacing (`p-4`, `gap-4`, `space-y-8`), typography (`text-sm`, `font-semibold`), radius (`rounded-md`/`rounded-xl`), shadows (`shadow-sm`). No tool-specific token overrides without `design-system` skill review.

## Workflow

1. **Reuse first:** Search `src/components/ui/` and `src/styles/globals.css` — is a primitive/token already there?
2. **Search machine skill if needed:** `python ~/.agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux|style|typography|color|icons` (or `--design-system` for new page). Do not assume stack — detect from `package.json` (`next`/`react`/`tailwind`).
3. **Apply with project tokens:** Map generic advice to `bg-primary`, `text-muted-foreground`, `border-input`, etc., not raw hex.

## Checklist

- [ ] Did I reuse an existing primitive or justify a new one?
- [ ] Mobile-first, no duplicated styling, tokens not raw hex?
- [ ] Contrast, alt, keyboard (Tab/Escape), aria-labels, not removing focus rings?
- [ ] Loading/empty/error states present?

See `ARCHITECTURE.md` §13 and `src/components/ui/`.
