---
name: tailwind
description: "Use for Tailwind CSS v4 styling — tokens in src/styles/globals.css, semantic tokens, mobile-first, and design-system reuse."
---

# Tailwind — v4 (4.1.11)

**When to use:** Styling, tokens, responsive, primitives, fixing visual inconsistency.

**When not to use:** Logic-only changes with no visual impact.

**Source:** Adapted from PyModel React Frontend Skills — `tailwind` skill (MIT). Project uses **Tailwind CSS v4** (`@tailwindcss/postcss` 4.1.11, `@theme` in `src/styles/globals.css:1`).

## Rules

**Rule: Tokens are source of truth**
Why: Consistency across microtools.
Good: `bg-primary`, `text-muted-foreground`, `border-input`, `rounded-xl`, `shadow-sm` from `src/styles/globals.css:1` `@theme` (`--color-primary`, `--radius-md`, etc., dark via `prefers-color-scheme`). `cn()` `src/lib/utils/cn.ts:1` merges.
Bad: `bg-[#7c3aed]` or `rounded-[13px]` scattered — add to `@theme` if needed, or use `bg-primary`.

**Rule: CSS-first config (v4)**
Why: v4 uses `@import "tailwindcss"` + `@theme`, not `tailwind.config.js`.
Good: `src/styles/globals.css:1` has `@import "tailwindcss"; @theme { --color-background: ... }`.
Bad: Creating `tailwind.config.ts` with `content` — v4 uses CSS, keep `postcss.config.mjs:1` with `@tailwindcss/postcss`.

**Rule: Mobile-first, no arbitrary values**
Why: Responsive by default.
Good: `src/components/layout/dashboard-shell.tsx:1` `hidden lg:block` sidebar, `flex-col sm:flex-row`, `p-4 lg:p-6`, `grid sm:grid-cols-2 lg:grid-cols-3` `src/app/(dashboard)/dashboard/page.tsx:73`.
Bad: `w-[432px]` fixed, `grid-cols-3` without `sm:` — breaks 375px.

**Rule: Design-system-first**
Why: No duplicate primitives between tools.
Good: Reuse `Button` `variant="secondary" size="sm"`, `Card`/`Badge`/`PageHeader` from `src/components/ui/index.ts:1`. Check `src/components/ui/` before `div className="..."`.
Bad: Copy-pasting `className="rounded-xl border bg-card …"` for every card — use `<Card>`.

**Rule: States accessible**
Why: A11y.
Good: `Button` `focus-visible:ring-2`, `disabled:opacity-50`, `LoadingState` `animate-spin` + `role="status"`.
Bad: `hover:` without `focus-visible:`, `bg-muted` with low contrast — check `ui-ux` skill (contrast 4.5:1).

## Checklist

- [ ] Did I reuse token (`bg-primary`) not raw hex?
- [ ] Mobile-first breakpoints, no horizontal scroll at 375px?
- [ ] Primitive reused, not duplicated?
- [ ] `prettier-plugin-tailwindcss` class order via `npm run format`?

See `src/styles/globals.css:1`, `ARCHITECTURE.md` §13.
