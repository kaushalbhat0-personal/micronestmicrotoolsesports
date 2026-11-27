# 02 — Tools Audit

**Catalog source:** `src/features/tools/catalog.ts` (`TOOL_REGISTRY`)  
**Runners:** `src/app/tools/[slug]/_components/*-runner.tsx`  
**All three tools:** `availability: "available"` — **VERIFIED** (no placeholders in registry)

---

## Cross-tool findings

| Lens | Prize Pool | Roster | Tie-Break |
|---|---|---|---|
| Engine quality | VERIFIED | VERIFIED | VERIFIED |
| Validation UX | PARTIAL | VERIFIED | VERIFIED |
| Empty / invalid states | PARTIAL | VERIFIED | VERIFIED |
| Mobile layout | VERIFIED | VERIFIED | VERIFIED |
| Accessibility basics | VERIFIED | VERIFIED | VERIFIED |
| Persistence | None (session memory) | None | In-memory snapshots |
| Export | Clipboard text | Clipboard text | Clipboard text |
| PNG / public result URL | MISSING | MISSING | MISSING |
| Presets / templates | MISSING | MISSING | PARTIAL (snapshots) |

**Privacy (VERIFIED):** Tools compute in-browser. `src/app/tools/routes.test.ts` asserts no DB/fetch/server-action coupling for tool execution. Catalog copy states planning-only / no payments.

---

## 1. Prize Pool Splitter (`prize-pool-splitter`)

### Functionality — VERIFIED

Total pool + currency (INR/USD) + up to 32 position rows (fixed or %). Integer minor-unit distribution with largest-remainder rounding; unallocated remainder never silently absorbed.

### Inputs / outputs — VERIFIED

- **In:** total, currency, rows (position, fixed or percent).
- **Out:** per-position amounts, distributed/unallocated, `buildResultSummary` text.

### Correctness — VERIFIED (engine) / PARTIAL (edge UX)

Strong tests in `prize-pool/tests/distribution.test.ts`.  
**Gap:** fixed + percent-of-full can exceed total → `PrizePoolError` thrown; runner `calculate()` lacks try/catch → can surface route `error.tsx` instead of inline issues.

### Validation / states / mobile / a11y — PARTIAL → VERIFIED mix

Zod live errors; labelled controls; `aria-live` results; responsive grids. Default 50/30/20 rows reduce blank-slate friction. No dedicated pre-calc empty-result education beyond defaults.

### Persistence / export — VERIFIED none / PARTIAL clipboard

Clipboard copy only. No download, PNG, or state URL.

### Repeat-usage improvements (recommended, not inventing requirements)

| Improvement | Fit | Complexity | Risk |
|---|---|---|---|
| Catch over-allocation inline | High | Low | Low |
| Copy + download `.txt` | High | Low | Low |
| Branded PNG payout graphic | High (org announcements) | Medium | Low if client-only |
| Local presets (common BGMI splits) | Medium | Low | Low |
| Shareable result link | Medium | Medium–High | Needs privacy design (see `04`) |

**Finding — F-TOOL-01 (prize over-allocation UX)**  
- Evidence: `distribution.ts` throws; `prize-pool-runner.tsx` calculate path.  
- User impact: confusing crash vs guided fix.  
- Business impact: undermines trust in a “exact math” tool.  
- Complexity: low. Risk: low. Action: wrap calculate; surface Zod/domain issues.

---

## 2. Roster & Slot Builder (`roster-slot-builder`) — BGMI

### Functionality — VERIFIED

Plan team name, starter/sub slot counts, players (name/ID/role/notes), assign starter/sub/bench, completeness Empty/Partial/Complete, copyable summary.

### Correctness / validation — VERIFIED

Duplicate name/ID normalization; no silent slot overwrite; shrink blocked when occupied; strong unit tests.

### Export — PARTIAL

Clipboard summary. Feature also has `src/features/teams/roster/output.ts` (`buildCopyText` / `buildCsv`) — useful building block; not fully productized as PNG/share.

### Repeat-usage improvements

| Improvement | Fit | Complexity |
|---|---|---|
| BGMI 4+2 / 5+1 templates | High | Low |
| CSV download (existing helpers) | High | Low |
| Roster PNG card | High | Medium |
| Import paste from Discord lists | Medium | Medium |

---

## 3. Tie-Break & Qualification Simulator (`tiebreak-qualifier`)

### Functionality — VERIFIED

Custom criteria (weight, direction, priority), teams, integer scores, live standings, qualification cutoff, contested ties, in-session what-if snapshots, copyable summary.

### Correctness — VERIFIED

Competition ranking (“1224”), missing scores assumed 0 with disclosure, contested cutoff banner. Strong engine tests.

### Persistence — VERIFIED session-only

Snapshots via `structuredClone`; lost on refresh. Catalog honestly says browser session only.

### Repeat-usage improvements

| Improvement | Fit | Complexity | Notes |
|---|---|---|---|
| Restore last scenario from `localStorage` | High | Low | Still private |
| Named preset packs (generic formats) | High for PMGC education | Medium | **Do not** claim official PMGC rules without verification |
| Standings PNG | High | Medium | Watermark + explanation footer |
| Shareable scenario URL | Medium | High | Prefer encoded client state or opaque public tokens — never private DB |

---

## Catalog / directory shell — VERIFIED

- Filters: shareable GET query on `/tools` (`_lib/query.ts`).
- Coming-soon landing path exists but unused (registry has zero coming-soon tools).
- Category `planning` has no registered tool.

## Must not disturb

- Integer-pure engines and “planning not payment” wording.
- Client-only execution boundary.
- Honest availability labels.
