# Architecture (P5)

## Layout

```
src/features/tools/
  catalog.ts            # ToolCategory enum + labels, ToolDefinition, TOOL_REGISTRY,
                        # getToolBySlug, slug/game matching (pure)
  format.ts             # display-only currency formatting + summary builder (pure)
  prize-pool/
    schema.ts           # Zod: currency, major/percent parsing, row + form coherence
    distribution.ts     # pure integer minor-unit engine (largest remainder)
    tests/              # schema.test.ts, distribution.test.ts
  tests/
    catalog.test.ts
src/app/tools/
  page.tsx              # thin orchestration: parse query, shell, static results
  routes.test.ts        # static audit (no DB, no commerce, no tracking)
  _lib/query.ts         # pure query parsing, hrefs, metadata, canonical
  _lib/query.test.ts
  _components/          # tool-bits, tool-card, tools-filters, tools-results
  _components/components.test.tsx
  [slug]/
    page.tsx            # registry lookup → landing; runner inline when available
    not-found.tsx / error.tsx
    _components/prize-pool-runner.tsx   # client: local state + validation + results
```

## Contracts

- **Stable identifier:** `slug` (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 2–48 chars).
- **Definition:** name, tagline, description, audience, category, `gameKeys`
  (`null` = platform-wide), availability, semver `version`, inputs/outputs
  explained, usage guidance.
- **Input schema:** per-tool Zod module (form-friendly raw strings).
- **Output contract:** engine returns integer minor-unit shares +
  distributed/unallocated totals; the UI renders, never recomputes.
- **Validation boundary:** schema first (field issues), engine defensively
  re-validates (throws `PrizePoolError`, never NaN).
- **Versioning:** `version` per definition; breaking engine changes bump it.

## Extension process (adding a tool)

1. Append one `ToolDefinition` to `TOOL_REGISTRY` in `catalog.ts`.
2. Add `src/features/tools/<slug>/{schema,engine}.ts` + `tests/`
   (pure modules, no cross-feature imports).
3. Add a runner component under `src/app/tools/[slug]/_components/`
   (client, local state) and one branch in `RunnerForTool`.
4. Cover with schema/boundary/execution tests + extend the static audit if
   new capabilities (e.g. share links) appear.
5. No changes to existing tools, the directory shell, or navigation are needed.

## Avoided

- No giant conditional component: one small runner per tool, one branch each.
- No duplicated validation/formatting: shared `format.ts`, per-tool Zod once.
- No tool logic in global navigation: header/footer link only at `/tools`.
- No database tables, no plugin/workflow engine, no entitlement model.
