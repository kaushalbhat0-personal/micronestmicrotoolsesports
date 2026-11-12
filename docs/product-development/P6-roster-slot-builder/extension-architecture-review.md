# Extension Architecture Review (P6)

## Question

Does P5's documented extension process (architecture.md steps 1–5) support
a stateful, multi-operation tool — or does it hide a structural gap that
only a calculator could fit?

## Finding: the process held; no architecture change was needed

| P5 step | P6 execution |
|---------|--------------|
| 1. Append one `ToolDefinition` | `defineRosterSlotBuilder()` added; `TOOL_REGISTRY` now 2 entries. No existing definition edited. |
| 2. Add `features/tools/<slug>/{schema,engine} + tests/` | `roster/schema.ts`, `roster/roster.ts`, `roster/tests/`. Pure, no cross-feature imports (BGMI roles duplicated locally with rationale). |
| 3. Add runner + one `RunnerForTool` branch | `roster-builder-runner.tsx` + 3-line branch. |
| 4. Cover + extend static audit if needed | 43 tests; audit needed no extension (no share links / fetch / actions added). |
| 5. No changes to existing tools/directory/nav | Splitter byte-identical; directory shell, filters, query parsing untouched. |

## Why no generic roster framework was built

The brief forbids speculative generality. The domain exposes roster-shaped
primitives (`SlotKind`, `SlotRef`, assign/unassign) but no plugin system, no
per-game engine registry beyond a key check + vocabulary list, and no shared
form framework with the splitter (raw-string Zod per tool, as P5 prescribes).

## One real limitation noted (not fixed)

`RunnerForTool` is a growing if-chain (now 2 branches). At 4–5 tools it
should become a slug→component map; today that would be speculative
refactoring, so it is deferred with the trigger stated.
