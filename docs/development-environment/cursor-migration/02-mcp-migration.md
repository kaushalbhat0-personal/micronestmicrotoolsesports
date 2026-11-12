# 02 — MCP Migration (CURSOR-ENV-001)

**Target file:** `.cursor/mcp.json` (project)  
**Policy:** No secret values in JSON; no duplicate of working Cursor plugins; OpenCode configs untouched.

---

## 1. Mapping

| OpenCode server | Cursor action | Transport | Auth |
| --- | --- | --- | --- |
| supabase | **Added** project MCP URL pinned to Esports | Remote HTTP | OAuth in Cursor UI |
| vercel | **Keep** `plugin-vercel-vercel` — do not duplicate in `mcp.json` | Plugin / OAuth | `mcp_auth` when needed |
| stitch | **Added** with `${env:STITCH_API_KEY}` header | Remote HTTP | API key env |
| playwright | **Added** stdio via `npx` | Local stdio | None |
| browser-use | **Added** stdio via `uvx` | Local stdio | Local browser-use profile |
| penpot | **Not migrated** | — | Backup had embedded token; rotate; re-add with env if needed |
| rea | **Not enabled by default** | Optional stdio | CLI `rea mcp` — enable recipe below |

Native Cursor (already working, not replaced):

- `cursor-ide-browser` — IDE-owned browser automation  
- `cursor-computer-use` — desktop control  
These are **not** substitutes for Playwright MCP or Browser Use MCP; capabilities overlap partially only.

---

## 2. Project `.cursor/mcp.json` (as written)

Servers: `supabase`, `stitch`, `playwright`, `browser-use`.

### Supabase special rules

```
https://mcp.supabase.com/mcp?project_ref=knniommcyyhbyiwljisk&read_only=true
```

- Primary MicroNest Esports project only.
- **Never** the sibling LMS project (`flhllvzzbtkfrcrajicq` was bound in OpenCode OAuth state — do not reuse).
- `read_only=true` default — DB mutations stay explicit (CLI/owner-authorized paths), not casual MCP writes.
- To temporarily allow writes: owner must change query param **and** authorize the session; prefer Supabase CLI for migrations.

### Stitch special rules

- Header `X-Goog-Api-Key: ${env:STITCH_API_KEY}` — User env already **SET** on this machine.
- Project refs to preserve in workflow docs/rules:
  - Project `7199013429647347145`
  - Systems `6707774341234228196`, `90baed1527db44968f7a931b98380bd0`
  - Screens `4b778e90b33a447a8221674bde14935e`, `a96714bf401a4c62ad6789136b3fbe5a`
- Use for one-screen-at-a-time design exploration.

### Playwright / Browser Use

- Playwright MCP: isolated browser for automation/QA scripts surface.
- Browser Use: `browser-use[cli]==0.13.11` via `uvx` — agentic browsing with its own profile under `~\.config\browseruse`.
- Do not assume identical feature sets.

---

## 3. Optional Rea enable (not default)

If reverse-engineering MCP tools are needed (large tool surface):

```json
"rea": {
  "command": "cmd.exe",
  "args": ["/d", "/c", "rea", "mcp"]
}
```

Verified: `rea` CLI **6.7.0** on PATH. Matches OpenCode backup; was removed from active OpenCode config intentionally.

---

## 4. Auth / connection steps (manual)

| Server | Required user step |
| --- | --- |
| supabase | Reload Cursor → Customize → MCPs → authenticate OAuth → confirm project `knniommcyyhbyiwljisk` |
| vercel | Call `mcp_auth` on `plugin-vercel-vercel` or sign in via Customize — **do not deploy** |
| stitch | Ensure User env `STITCH_API_KEY` visible to Cursor (restart Cursor from a session that inherits User env) |
| playwright | First run may download browsers via npx; allow network |
| browser-use | First `uvx` resolve may take >60s; allow |

---

## 5. Why Vercel was not duplicated

Cursor already exposes `plugin-vercel-vercel`. Adding `https://mcp.vercel.com` again would create duplicate tools and competing auth states. OpenCode’s Vercel MCP purpose is preserved via the plugin.

---

## 6. Neon note

`plugin-neon-postgres-neon` is a Cursor/plugin asset, **not** from OpenCode MCP inventory. Left intact; authenticate only if Neon work is in scope. Esports primary DB remains **Supabase** project `knniommcyyhbyiwljisk`.
