# 06 — Validation Results (CURSOR-ENV-001)

**Date:** 2026-11-12  
**Constraint:** Connection tests that need UI OAuth or Cursor reload are reported as steps, not claimed success.

---

## 1. Configuration presence

| Check | Result |
| --- | --- |
| `.cursor/mcp.json` exists with supabase, stitch, playwright, browser-use | **PASS** |
| No JWT/secret literals in mcp.json | **PASS** (scan) |
| Esports `project_ref=knniommcyyhbyiwljisk` + `read_only=true` | **PASS** |
| LMS ref absent from mcp.json | **PASS** |
| Stitch uses `${env:STITCH_API_KEY}` | **PASS** |
| User env `STITCH_API_KEY` set | **PASS** (value not printed) |
| `.cursor/rules/micronest-platform.mdc` alwaysApply | **PASS** |
| `.cursor/rules/design-and-qa.mdc` UI globs | **PASS** |
| `AGENTS.md` unmodified content preserved | **PASS** (not overwritten) |
| OpenCode `opencode.jsonc` untouched | **PASS** |
| Vercel not duplicated in mcp.json | **PASS** (plugin retained) |

---

## 2. MCP recognition in this live agent session

| Server | Recognized now? | Notes |
| --- | --- | --- |
| plugin-vercel-vercel | Yes | `needsAuth` — run `mcp_auth` |
| plugin-neon-postgres-neon | Yes | `needsAuth` if used |
| cursor-ide-browser | Yes | Intact |
| cursor-computer-use | Yes | Intact |
| cursor-origin | Yes | Intact |
| **supabase** (new) | **Not yet in session catalog** | Requires Cursor MCP reload / window reload |
| **stitch** (new) | **Not yet** | Same |
| **playwright** (new) | **Not yet** | Same |
| **browser-use** (new) | **Not yet** | Same |

**Exact user step:** Command Palette → “MCP: Restart Servers” or reload Cursor window, then open **Customize → MCPs** and confirm each server shows connected/authenticated.

### Per-server post-reload checklist

1. **supabase** — Complete OAuth; verify tools target `knniommcyyhbyiwljisk` only.  
2. **stitch** — If header auth fails, restart Cursor from a login session that inherits User env (known Cursor caveat for desktop vs terminal env).  
3. **playwright** — Allow first `npx` download; check MCP logs on timeout.  
4. **browser-use** — Allow first `uvx` resolve (can exceed 60s).  
5. **vercel plugin** — Authenticate via `mcp_auth`; do not deploy.

---

## 3. Skills discoverability

| Skill root | Present | Notes |
| --- | --- | --- |
| Project `.agents/skills` | Yes | 15 SKILL.md dirs |
| Global `~\.agents\skills\unslop` | Yes | CC-BY-4.0 |
| `.agents/skills.md` Cursor mention | Yes | Edited this phase |
| OpenDesign / Hallmark / Graphify / Muse / Replica | Absent as installs | Documented accurately |

---

## 4. Duplicates / conflicts

| Risk | Status |
| --- | --- |
| Double Vercel MCP | Avoided |
| Double browser stacks | Intentional: IDE browser ≠ Playwright ≠ Browser Use |
| Skill tree copies under `.cursor/skills` | None created |
| Overwrote global `~\.cursor\mcp.json` | N/A (did not create global file) |

---

## 5. Worktree / source safety

| Check | Result |
| --- | --- |
| Staged legacy renames | **1299** preserved |
| Application `src/` modified by this task | **No** (pre-existing dirty tree unchanged by migration) |
| Supabase migrations modified | **No** |
| Commit / push / deploy | **None** |
| OpenCode uninstall | **None** |

---

## 6. Env resolution (no values)

| Variable | Resolved? |
| --- | --- |
| `STITCH_API_KEY` (User) | SET |
| `STITCH_API_KEY` (Machine) | UNSET |
| `uvx` / `npx` / `rea` on PATH | Present |
