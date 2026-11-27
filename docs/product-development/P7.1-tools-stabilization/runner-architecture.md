# Runner Architecture (P7.1)

## Change

`src/app/tools/[slug]/page.tsx`: the three-branch if-chain became an
explicit map — no dynamic imports, no plugin framework, no behavior change:

```tsx
const TOOL_RUNNERS: Record<string, React.ComponentType> = {
  "prize-pool-splitter": PrizePoolRunner,
  "roster-slot-builder": RosterBuilderRunner,
  "tiebreak-qualifier": TiebreakRunner,
};

function RunnerForTool({ slug }: { slug: string }): React.ReactNode {
  const Runner = TOOL_RUNNERS[slug];
  return Runner ? <Runner /> : null;
}
```

Unknown/unavailable tools render exactly as before (map miss → null;
`availability !== "available"` → coming-soon block). Public route behavior
unchanged: same slugs, same landing, same 404-equivalence.

## Why this is safe

- Typing: `Record<string, React.ComponentType>` accepts any runner
  component; a missing import or misspelled key is a type error at the
  literal, and rendering parity is enforced at test time (below).
- No indirection: static imports, no `next/dynamic`, no slug-derived paths
  (the parity test asserts the absence of `dynamic(`/`next/dynamic`).

## Drift protection

`routes.test.ts` gained a static parity test: it parses the `TOOL_RUNNERS`
literal and requires (a) every `availability: "available"` registry slug to
have an entry, and (b) every entry to name a real registry slug. Tool four
fails this test until its entry is added — no silent coming-soon
regressions, no orphan runners.

## Extension procedure for tool four

1. Add the runner component under `[slug]/_components/`.
2. Import it in `[slug]/page.tsx` and add one `"new-slug": NewRunner` entry.
3. Done — the parity test, directory, landing, and 404 handling adapt with
   no further edits. (If a fifth tool arrives, re-evaluate; the map scales
   without structural change.)
