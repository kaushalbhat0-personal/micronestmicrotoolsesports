# 05 — Cursor Project Instructions (CURSOR-ENV-001)

**Live enforcement:** `.cursor/rules/micronest-platform.mdc` (always) + `.cursor/rules/design-and-qa.mdc` (UI globs).  
**Preserved:** root `AGENTS.md` (Next.js auto block) — not replaced.  
**Skills authority:** `.agents/skills.md`.

This document is the human-readable copy of the project instruction intent.

---

## Must communicate

1. New platform is authoritative; `legacy/` is reference-only.  
2. Never import legacy runtime code; never use legacy migrations.  
3. Preserve uncommitted work and staged legacy renames.  
4. No commits, pushes, or deployments without explicit authorization.  
5. No database mutations without explicit authorization.  
6. Never access the sibling LMS Supabase project; Esports ref `knniommcyyhbyiwljisk`.  
7. No Docker under the current workflow; use **npm**.  
8. Prefer existing architecture over broad rewrites; app routes stay orchestration-focused.  
9. Use Google Stitch for relevant one-screen design tasks (project `7199013429647347145`).  
10. Use available skills/MCPs when they materially help.  
11. Never claim a tool was used without actually using it.

---

## Stack note

`package.json` currently pins `next@16.4.6` with React 19 / TypeScript / Tailwind v4 / Supabase SSR.  
Always verify lockfile before assuming APIs. (`.agents/skills.md` version pins may lag — prefer package manifests.)

---

## Merge decision

| Existing artifact | Action |
| --- | --- |
| `AGENTS.md` | Kept intact |
| Prior `.cursor/rules` | None existed — created new |
| Prior `.cursor/mcp.json` | None existed — created new |
| Global Cursor plugins | Left intact (Vercel, Neon, browsers) |
