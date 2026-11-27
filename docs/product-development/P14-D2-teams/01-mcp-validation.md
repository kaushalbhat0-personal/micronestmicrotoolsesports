# 01 — Cursor MCP Validation (P14-D2)

**Mode:** read-only connection testing. No credentials printed. No LMS access. No deploys.

---

## 1. Configuration inspection

| Check | Result |
| --- | --- |
| `.cursor/mcp.json` present | Yes |
| Supabase URL | `https://mcp.supabase.com/mcp?project_ref=knniommcyyhbyiwljisk&read_only=true` |
| LMS project ref in config | **Absent** |
| Stitch header | `X-Goog-Api-Key: ${env:STITCH_API_KEY}` (no literal secret) |
| User `STITCH_API_KEY` | **SET** (value not printed) |
| Playwright command | `npx -y @playwright/mcp@latest --isolated` |
| Browser Use command | `uvx --from browser-use[cli]==0.13.11 browser-use --mcp` |
| Vercel in mcp.json | **No** (uses Cursor plugin to avoid duplicate) |

---

## 2. Live session results

| MCP | Config OK | Live in agent catalog | Connection evidence | Status |
| --- | --- | --- | --- | --- |
| **Supabase** (project mcp.json) | Yes — Esports + read_only | **No** | Not registered under `mcps/` cache this session | **BLOCKED — user must reload MCP / Cursor**, then OAuth |
| **Vercel** (`plugin-vercel-vercel`) | Yes (plugin) | Yes | `mcp_auth` succeeded; `list_projects` returned `micronestmicrotoolsesports` | **PASS** (authenticated, read-only list) |
| **Stitch** | Yes | **No** | Not in catalog | **BLOCKED — reload**; then verify project `7199013429647347145` |
| **Playwright** | Yes | **No** | CLI `npx @playwright/mcp@latest --help` works | **CLI ready; Cursor MCP handshake unproven** |
| **Browser Use** | Yes | **No** | CLI `browser-use --help` works via uvx | **CLI ready; Cursor MCP handshake unproven** |
| cursor-ide-browser | Native | Yes | Present | Intact |
| cursor-computer-use | Native | Yes | Present | Intact |
| Neon plugin | Present | needsAuth | Not required for Teams DB (Supabase primary) | Optional |

**Honest rule applied:** configuration ≠ working connection. Supabase/Stitch/Playwright/Browser Use are **not** claimed connected in this session.

### Required user actions

1. Command Palette → **MCP: Restart Servers** (or reload window).  
2. Customize → MCPs → enable/authenticate **supabase** (confirm project `knniommcyyhbyiwljisk` only).  
3. Confirm **stitch**, **playwright**, **browser-use** show connected.  
4. Do **not** point Supabase MCP at any LMS project.

---

## 3. Remote migration ledger via Supabase MCP

**Not performed** — Supabase MCP tools unavailable in this session.

**Fallback evidence (docs only, P13-C0):** remote `knniommcyyhbyiwljisk` has 9 ledger versions (foundation 01–02 + 7 G1 dashboard stamps); D1/P9/P11/P13 unapplied; G1 schema present. Live re-confirm after MCP reload.

---

## 4. Skills discoverability

| Root | Result |
| --- | --- |
| `.agents/skills/` (15 project skills) | Present |
| `~\.agents\skills\unslop` | Present |
| `.agents/skills.md` | Present (Cursor-aware) |

---

## 5. Safety

- No LMS project accessed.  
- No Vercel deploy.  
- No DB mutation.  
- No secrets logged.
