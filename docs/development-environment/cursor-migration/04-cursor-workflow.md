# 04 — Cursor Development Workflow (CURSOR-ENV-001)

Replaces the useful OpenCode workflow inside Cursor without claiming tools that are not installed.

---

## 1. Architecture & code quality

| Practice | How in Cursor |
| --- | --- |
| SOLID / DRY / KISS | Project `architecture` skill + rule `micronest-platform` |
| Feature-driven modular monolith | `src/features/<slug>/`; no cross-feature internals |
| Clean boundaries | app → services → repositories; Zod at edges |
| Strict TypeScript | `typescript` skill; no `any` / smuggled casts |
| Security-first Supabase | `security` + `postgres-rls` + `supabase` skills **before** schema/auth work |
| Mobile-first + WCAG AA | `ui-ux` skill; Playwright/a11y checks |

Load order (from `.agents/skills.md`): security → architecture → task → DB/RLS → framework → polish.

---

## 2. Design workflow

1. Identify **one screen**.  
2. Use **Google Stitch MCP** (`stitch`) with project `7199013429647347145` and known system/screen refs.  
3. Screenshot / review (Stitch and/or browser tools).  
4. Implement into existing Next.js + Competitive Arena tokens — no full redesign.  
5. CSS-first animation; Motion only when meaningful; no GSAP/Anime by default.  
6. If the UI looks generic/AI-slop → run **unslop**.

---

## 3. Codebase understanding

| Tool | Status |
| --- | --- |
| Graphify | **Not installed** — do not claim usage |
| Explore / Task agents | Use for dependency and feature-boundary maps |
| Architecture skill | Required before broad changes |
| Route files | Orchestration only |

---

## 4. Testing & browser QA

| Capability | Tool |
| --- | --- |
| Unit / integration | Vitest via `testing` skill (`npm run test`, `test:integration`) |
| E2E / responsive | Project Playwright skill + **Playwright MCP** |
| Agentic browse / multi-step web | **Browser Use MCP** |
| In-IDE page snapshots | `cursor-ide-browser` |
| Desktop OS control | `cursor-computer-use` |

Automated ≠ manual a11y sign-off.

---

## 5. AI contributor workflow (Muse)

Muse 1.3 Contributor was **not found** in OpenCode config or skill trees.

**Preserved intent inside Cursor (without Muse binary):**

- Prefer contributor-style discipline: inspect repo → load skills → plan → implement → verify typecheck/lint/test → no silent commits.
- RCCF from `.agents/skills.md` remains the checkpoint model.
- Cursor Auto mode + project rules replace the OpenCode+Muse pairing for this workspace.

**Do not claim Muse is integrated with Cursor.**

---

## 6. Supabase / Vercel operational workflow

- Supabase MCP: Esports-only, read-only default.  
- Schema changes: owner-authorized migrations via CLI — not casual MCP writes.  
- Vercel plugin: inspect deployments/env; **never deploy** unless user authorizes.  
- No Docker; use npm.
