# MicroNest Design System — RCCF-UIUX-02

> "The quiet proof room." Warm cream + white + charcoal + terracotta. LIGHT ONLY.

This is the design contract for UIUX-03 onward. All screens must consume these tokens/primitives.

## Color Tokens (`src/styles/globals.css:1` @theme)

```
--background        hsl(40 33% 97%)   // page cream
--foreground        hsl(30 10% 15%)   // charcoal ink
--card              hsl(0 0% 100%)    // elevated
--card-foreground   hsl(30 10% 15%)
--muted             hsl(40 20% 96%)
--muted-foreground  hsl(30 6% 42%)    // AA on cream+white
--popover           hsl(0 0% 100%)
--border            hsl(40 12% 88%)
--border-strong     hsl(40 10% 80%)
--input             hsl(40 12% 88%)
--ring              hsl(24 85% 52%)   // terracotta
--primary           hsl(24 85% 52%)
--primary-fg        hsl(0 0% 98%)
--secondary         hsl(40 20% 96%)
--accent            hsl(40 30% 94%)
--success           hsl(158 35% 38%)  // muted teal
--success-soft      hsl(158 25% 94%)
--warning           hsl(36 80% 50%)
--warning-soft      hsl(36 100% 96%)
--destructive       hsl(8 75% 56%)
--destructive-soft  hsl(8 80% 96%)
--info              hsl(210 30% 45%)
--platform-youtube  hsl(0 72% 51%)
--platform-twitch   hsl(264 35% 48%)
--platform-kick     hsl(142 40% 42%)
--foreground-faint  hsl(30 5% 62%)
```

No `prefers-color-scheme: dark`. Light only.

## Typography (`src/app/layout.tsx:1`)

- UI: Geist Sans `var(--font-geist-sans)` — 14px body, 13px label, 12px meta
- Display: Instrument Serif `var(--font-display)` — 30/32px page title, 20px section
- Mono: Geist Mono — 12px ids/timestamps
- Card title 15px / 600 / -0.01em, Body 14px relaxed, Meta 12px muted
- Numeric hero 28px / 700 tabular (future Dashboard)

## Spacing

- Field: 16–24px (`space-y-4/6`)
- Section: 32–40px (`space-y-8`)
- Major: 40–48px (`space-y-10`)
- Page: `px-5 py-6` mobile → `px-8 py-10` desktop via `PageContainer`

## Radius

- sm 8px (badges inner, dropdown item)
- md 12px (inputs, secondary buttons)
- lg 16px (cards, table)
- xl 20px (hero, dialog)
- Primary Button: `rounded-full`, Badges: `rounded-full`

## Shadows (warm)

- sm: 0 1px 2px /0.06 + 1px 3px /0.04 — elevated cards
- md: 0 4px 12px /0.08 — popover
- lg: 0 12px 24px /0.10 — dialog
- Most cards: border only. Hero/elevated: shadow-sm.

## Buttons (`src/components/ui/button.tsx:1`)

- Variants: default (terracotta) / destructive (warm red) / outline (border+card) / secondary (muted) / ghost / link
- Sizes: default h-11 rounded-full, sm h-9, lg h-12, icon h-11
- Hover: terracotta darken 52%→48%, active 45%
- Focus: ring 2px terracotta + offset 2px background
- Disabled: opacity-50, no pointer

## Cards (`src/components/ui/card.tsx:1`)

- Variants: default (border+card), elevated (+shadow-sm), muted (surface-muted), ghost (transparent), hero (20px+shadow-sm)
- Title 15px semibold -0.01em, Description 14px muted relaxed
- Do not stack Card Card Card — use variant to signal hierarchy

## Badges (`src/components/ui/badge.tsx:1`)

- Variants: default(terracotta)/secondary/outline/success(teal)/warning/destructive/info/platform-*
- Pill rounded-full px-2.5 py-0.5 text-xs semibold
- Status uses Badge + Lucide 12px, aria-label

## StatusBadge (`src/components/ui/status-badge.tsx:1`)

- Maps: draft→Setup, active→Tracking, PASS→Confirmed etc. Uses Lucide not unicode: Check/X/Clock3/LoaderCircle/TriangleAlert/CircleCheck/CircleX/Minus
- LoaderCircle spins for running/PENDING
- Info/warning/success/control use semantic variants

## Input/Label (`src/components/ui/input.tsx:1`)

- h-11 rounded-[12px] border-input bg-card, hover border-strong, focus ring terracotta, invalid border-destructive, faint placeholder
- Label 13px medium -0.01em foreground

## Table (`src/components/ui/table.tsx:1`)

- Wrapper rounded-[16px] border + card, header bg-surface-muted/60, row hover muted/50, Head 12px semibold tracking-wide muted

## Dialog (`src/components/ui/dialog.tsx:1`)

- Scrim `hsl(30 10% 15% / 0.28)` blur 2px (warm), content rounded-[20px] border card shadow-lg, close rounded-full hover muted
- Esc + click scrim + body overflow lock

## Select (`src/components/ui/select.tsx:1`)

- Radix-based, trigger h-11 rounded-[12px] border-input card, content rounded-[12px] border popover shadow-md, item rounded-[8px] hover surface-muted, Check indicator

## PageContainer

- `src/components/ui/page-container.tsx:1` — max-w 80rem (7xl), px-5→6→8, py-6→8→10, center

## Icon Rules (`src/components/ui/icons.tsx:1`)

- Lucide only, 16px actions, 14-16 status, stroke 1.75, one per button/card header
- Nav: LayoutDashboard/ShieldCheck/History/Tv/Plug/Building2
- Actions: SearchCheck/Play/ExternalLink
- Requirements: Type/Hash/Gamepad2/Tag/Clock/Video
- Status: CheckCircle/CircleCheck/TriangleAlert/CircleX/LoaderCircle
- Platform: colored dot + letter, not icon sprawl

## Motion

- Micro 180ms, Nav 220ms, Reveal 260ms, Hero 360ms
- `prefers-reduced-motion: reduce` disables animation → opacity only
- No gradients, blobs, marquee, heavy spring

## Accessibility

- Contrast: foreground 30 10% 15% on 40 33% 97% ~16:1; muted 42% on cream ~4.6:1 (AA). Verify info/warning on soft combos.
- Focus: 2px ring terracotta + offset
- Touch: default 44px (h-11), sm 36px — bump primary to 44
- Keyboard: Dialog Esc, Dropdown Esc+outside click, Select arrow keys
- Screen reader: StatusBadge aria-label, Empty icon aria-hidden, Loading aria-live polite
