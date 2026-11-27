# Route and Component Map (P5)

## Routes

| Route | File | Behavior |
|---|---|---|
| `/tools` | `src/app/tools/page.tsx` | Shell (arena banner + filters + invalid notice) + static `ToolsResults`. `robots: noindex, follow`. |
| `/tools/[slug]` | `src/app/tools/[slug]/page.tsx` | Registry lookup (`getToolBySlug`); invalid/unknown → `notFound()` (404-equivalence). Landing sections + inline runner when `available`, honest coming-soon otherwise. `revalidate = 60`. |
| `/tools/[slug]/not-found.tsx` | route 404 | Generic "Tool not found". |
| `/tools/[slug]/error.tsx` | route boundary | Honest retry state (unexpected throwables only). |

## Route-boundary library

- `src/app/tools/_lib/query.ts` — pure `parseToolsQuery` (fail-soft +
  `invalid[]`), `buildToolsHref`, metadata builders (directory / detail /
  not-found), canonical via `NEXT_PUBLIC_APP_URL` only. No pagination: the
  static registry is small and bounded by construction.

## Components

- `tool-bits.tsx` — availability/category badges, compatibility label.
- `tool-card.tsx` — registry-only card (name/slug link, tagline, badges).
- `tools-filters.tsx` — GET form (search + game always; category only when
  ≥2 populated categories exist in the registry).
- `tools-results.tsx` — static filtering (game → platform-wide always
  matches; category; substring search), empty/reset states.
- `[slug]/page.tsx` — landing (value, audience, compatibility, inputs/
  outputs, usage, availability) + `RunnerForTool` branch.
- `[slug]/_components/prize-pool-runner.tsx` — client execution: labelled
  inputs, dynamic rows (add/remove ≤32), field errors (`role="alert"` list),
  `aria-live="polite"` results, table + totals + `<pre>` summary + copy +
  reset. Mobile-first grid (`sm:` breakpoints), full keyboard operability.

## Navigation

- `SiteHeader` + `SiteFooter` gain the `Tools` link (header convention
  allows shipped routes only — `/tools` ships). Footer availability line now
  includes tools discovery routes as live.
