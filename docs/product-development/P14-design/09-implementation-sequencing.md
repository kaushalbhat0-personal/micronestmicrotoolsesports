# 09 — Implementation Sequencing (B2+ proposal, no code in B1)

Order preserves tests/WIP; each step keeps `routes/query/components` tests green + e2e accessible locators.

1. **Tokens + primitives** — extend `@theme` (line/border/radius/spacing), `Button/Input/Select/Chip/Card/Table/Dialog/Skeleton`, `loading.tsx` reusing skeletons. Tests: existing `components.test.tsx` + new token contrast check.
2. **Header/footer/container** — unify to `DirectoryShell` widths; mobile panel polish. Tests: `home.spec.ts` roles unchanged.
3. **Homepage** — bind Stitch homepage composition to real `ArenaHero` copy; add OG. Tests: `marketing.test.tsx` static guard + e2e home.
4. **Player directory → profile** — filter bar + table + `[handle]` dossier. Tests: `players/*query/routes/components*` + integration directory reader.
5. **Tournament directory → detail** — same shell; status chips. Tests: `tournaments/*`.
6. **News listing → article** — `ArticleBody` 65ch + related. Tests: `news/*`.
7. **Tools directory → runners** — workbench + status regions. Tests: `tools/*` unit + 21 e2e.
8. **Teams/Orgs/Organizers/Brands** — roll out shell (already consistent). Tests: per-pillar suites.
9. **Workspace/moderation/articles/settings** — operations density (Direction C borrow). Tests: workspace `actions/boundary` + moderation snapshots.
10. **Motion pass** — add `motion` dep, central `motion.ts`, `layoutId` filters, dialog presence, reduced-motion hooks. Tests: e2e reduced-motion + overflow.
11. **Assets/fonts/OG** — procure/license, `CREDITS.md`, `next/font` (or link) + `opengraph-image`. Tests: no-broken-image check.

Gates: no DB migrations, no write-switch changes, no Mini Games, 67 WIP preserved/committed only by owner, visual approval before step 3.
