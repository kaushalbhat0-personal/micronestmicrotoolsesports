---
name: reverse-engineering
description: "Use for read-only architectural reverse-engineering: map real runtime entrypoints, trace end-to-end flows with file evidence, separate confirmed flow from hypothesis. Produces evidence-backed reports, never refactors."
---

# Reverse Engineering — Evidence-First Investigation (adapted for OpenCode/MicroNest)

**Adaptation notice:** Methodology adapted from `kleytonsolinho/reverse-engineering`
(`https://github.com/kleytonsolinho/reverse-engineering`, MIT License,
Copyright (c) 2026 Kleyton Solinho) — specifically its `reverse-engineering` and
`codebase-reverse-engineering` skills plus their `investigation-checklist`,
`output-contract`, and `multilingual-export-pattern` references. The upstream
project is a **Codex plugin** (Codex plugin-UI install via `marketplace.json` /
`.codex-plugin/plugin.json`); that install path does **not** apply here. This
local version keeps only the portable investigation methodology, rewritten for
OpenCode discovery (`.agents/skills/<name>/SKILL.md`) and MicroNest project
rules. No upstream code, script, or binary is vendored — there are none; the
upstream is markdown-only. Full license text in `LICENSE-THIRD-PARTY.md`.

**When to use:** Architecture analysis, entrypoint mapping, "how does this tool/
flow actually work", onboarding docs, pre-change impact mapping, debugging
causal chains.

**When not to use:** When the task already knows the files to change (just read
them); as authorization to refactor, rename registries, migrate files, change
schemas, or introduce abstractions. This skill is **read-only investigation**
unless the task explicitly requests implementation afterwards.

**Precedence:** Project skills win on conflict. `security` > `architecture` >
task requirements > this skill. Never let this skill override tenant isolation,
folder authority, or RCCF verification.

## Core Rule

Do not assume. Do not fill gaps with intuition. Do not answer from generic
convention without reading the code. If something is not confirmed in the code,
say so explicitly:

- `confirmed flow` (with file + symbol evidence)
- `unconfirmed hypothesis` / `not confirmed in the code reviewed`

## Process

1. Identify the real operational question and scope (feature, route, incident).
2. Locate bootstrap/manifest/composition files first: `package.json`, framework
   config, route registries, `src/config/*`, `ARCHITECTURE.md`, composition
   points — before opening random files.
3. Map flow ownership: who receives input → validates → transforms →
   orchestrates → integrates externally → persists/renders/publishes.
4. Follow the real code via symbols, imports, calls, schemas, routes, handlers,
   config. Prefer `grep`/manifest/route/registry reads.
5. For each discovered rule, self-question before concluding: where does it
   originate, who depends on it, who breaks if it changes, where is it
   validated/transformed/bypassed, whole-system or flow-local, any
   contradiction/exception elsewhere, what data goes in/out and who translates.
6. Build an evidence map (file → responsibility → evidence) before concluding.
7. Separate framework detail from business logic; name layers, dependency
   direction, contracts, adapters, registries — only where the code shows them.
8. For bugs: trace symptom → intermediate state → boundary → root cause.

## MicroNest Scopes (check both when mapping a tool)

- **Public discovery flow:** public route → tool implementation → tool metadata/
  registry → marketing catalog → `/tools` page → homepage toolbox grouping →
  footer/navigation → sitemap/SEO → production route.
- **Workspace/entitled flow:** tool registry → organization entitlement →
  workspace/tool route → billing/access checks.
- Distinguish: public informational vs free vs paid-workspace vs public
  intelligence (Meta-Parser-style) tools; which belong in `TOOLS` vs marketing-
  only discovery.

## Guardrails

- Read-only: no refactors, renames, migrations, schema changes, or new
  abstractions to make the report cleaner.
- Do not call something a pattern without pointing at where it appears.
- Do not call a module dead without searching for references.
- Do not call a bug fixed without the causal chain.
- Keep reports inside the repository's existing reports/docs location named by
  the task — never create random root-level artifacts (upstream default
  `reports/<Project>/` does **not** apply unless the task says so).

## Minimum Report Format

1. `Summary` (direct answer, what is confirmed)
2. `How It Works` (ordered end-to-end flow with file/symbol cites)
3. `Why It Works This Way` (layers/boundaries/contracts from evidence)
4. `Patterns Found` (pattern → where → why, or `not confirmed`)
5. `Graph` (small ASCII flow map)
6. `Concrete Example` (one real path with a named file/snippet)
7. `Gaps Or Next Files To Read` (explicit unknowns + files that close them)
