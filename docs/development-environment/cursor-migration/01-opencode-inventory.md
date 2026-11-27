# 01 — OpenCode Source Inventory (CURSOR-ENV-001)

**Scope:** Discover existing OpenCode MCP, skills, instructions, and workflows.  
**Secrets:** Never printed. Env var **names** only.  
**OpenCode config root:** `C:\Users\91866\.config\opencode`  
**OpenCode not deleted** by this migration.

---

## 1. Configuration sources

| Path | Type | Role | Migratable |
| --- | --- | --- | --- |
| `~\.config\opencode\opencode.jsonc` | MCP registry (active) | supabase, vercel, stitch, playwright, browser-use | Yes → Cursor `mcp.json` |
| `~\.config\opencode\opencode.jsonc.bak-manual` | MCP backup | Adds penpot (URL token — **do not copy**), rea; no stitch | Selective / manual |
| `~\.config\opencode\cli.json` | TUI prefs | Theme/sidebar | No Cursor equivalent |
| `~\.config\opencode\service.json` | Local service cred | OpenCode-only | No |
| `~\.local\share\opencode\mcp-auth.json` | OAuth state | Supabase tokens | Re-auth in Cursor (do not copy) |
| `~\.local\share\opencode\auth.json` | LLM providers | OpenCode models | No — Cursor subscription |
| `~\.agents\skills\` | Global skills | Unslop, design, Neon, REA, … | Already Cursor-discoverable |
| `~\.agents\.skill-lock.json` | Skill lock | Marketplace installs | Reference |
| Esports `.agents\skills\` + `skills.md` | Project skills | Architecture/security/… | Already Cursor-discoverable |
| Esports `AGENTS.md` | Next.js auto rules | Version guardrails | Keep (do not replace) |
| Esports project `opencode.json*` | — | **Absent** | N/A |

---

## 2. MCP inventory (active)

| Name | Type | Location | Functional (OpenCode logs) | Config source | Dependencies | Direct Cursor migrate? |
| --- | --- | --- | --- | --- | --- | --- |
| **supabase** | remote HTTP | `https://mcp.supabase.com/mcp` | Yes (OAuth) | `opencode.jsonc` | Supabase OAuth | Yes — **pin Esports project** |
| **vercel** | remote HTTP | `https://mcp.vercel.com` | Yes (OAuth) | `opencode.jsonc` | Vercel OAuth | Prefer existing Cursor **plugin** (avoid duplicate) |
| **stitch** | remote HTTP | `https://stitch.googleapis.com/mcp` | Yes (2026-11-12) | `opencode.jsonc` + `STITCH_API_KEY` | User env `STITCH_API_KEY` | Yes |
| **playwright** | local stdio | `npx -y @playwright/mcp@latest --isolated` | Flaky timeouts historically | `opencode.jsonc` | Node/npx | Yes |
| **browser-use** | local stdio | `uvx --from browser-use[cli]==0.13.11 … --mcp` | Yes | `opencode.jsonc` | `uvx`, browser-use profile | Yes (≠ Cursor IDE browser) |

### Backup / historical only

| Name | Status | Notes |
| --- | --- | --- |
| **penpot** | Backup only | Remote URL previously embedded a user token — **not migrated**; rotate token if still valid |
| **rea** | Backup only; CLI present | `rea` CLI **6.7.0** on PATH; removed from active OpenCode JSONC after ~2026-11-11 |

### Critical Supabase finding

OpenCode `mcp-auth.json` OAuth state referenced `project_ref=flhllvzzbtkfrcrajicq` (read_only), **not** Esports `knniommcyyhbyiwljisk`.  
Cursor migration must **not** reuse that binding blindly. Project MCP URL pins Esports + `read_only=true`.

---

## 3. Skills inventory

### Global (`~\.agents\skills`)

| Skill | Type | Functional | Migrate |
| --- | --- | --- | --- |
| unslop | Skill (CC-BY-4.0) | Yes | Already available to Cursor |
| banner-design, brand, design, design-system, slides, ui-styling, ui-ux-pro-max | Skills | Yes | Already available |
| find-skills | Skill | Yes | Already available |
| reverse-engineer-anything | Skill (REA method) | Yes | Already available (≠ Rea MCP) |
| developing-with-streamlit | Skill | Yes | Keep global; unused by Esports |
| neon* (8) | Skills | Yes | Available; Neon also via Cursor plugin |

### Project (Esports `.agents\skills`)

architecture, security, ui-ux, nextjs, react, typescript, tailwind, supabase, postgres-rls, testing, playwright, twitch, youtube, kick, reverse-engineering — all present; indexed by `.agents\skills.md`.

### Requested but not installed as skills

| Name | Finding |
| --- | --- |
| OpenDesign | Cached under OpenCode npm cache; plugin **failed to load**; not in `~\.agents\skills` |
| Replica | **Not found** as a skill |
| Hallmark | Methodology only in P14 docs — **not installed** |
| Graphify | **Not found** |
| Muse 1.3 Contributor | **Not found** on disk / OpenCode config |

---

## 4. Instructions / agents / hooks

| Item | Finding |
| --- | --- |
| Global OpenCode instructions file | None beyond MCP/TUI |
| Project instructions | `.agents\skills.md` (RCCF) + `AGENTS.md` (Next) |
| Custom agents | Unslop `agents/openai.yaml` display stub only |
| Hooks / reusable OpenCode commands | None in static config; runtime DB only |
| Tool permissions | Streamlit skill `allowed-tools` only |

---

## 5. Cursor baseline before migration

Already present in this workspace session:

- `plugin-vercel-vercel` (needsAuth)
- `plugin-neon-postgres-neon` (needsAuth)
- `cursor-ide-browser`
- `cursor-computer-use`
- `cursor-origin`

No project `.cursor/` existed before this migration.
