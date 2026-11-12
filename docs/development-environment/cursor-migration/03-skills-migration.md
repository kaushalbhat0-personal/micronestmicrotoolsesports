# 03 — Skills Migration (CURSOR-ENV-001)

**Policy:** Do not duplicate working skill trees. Adapt OpenCode-specific wording only where needed. OpenCode skill installs remain.

---

## 1. How Cursor discovers skills (this machine)

| Alias / root | Path | Status |
| --- | --- | --- |
| Cursor built-in | `~\.cursor\skills-cursor\` | Present (do not modify) |
| Personal agents | `~\.agents\skills\` | Watched / listed in agent skills |
| Project | `d:\Projects\MicroNest MicroTools - Esports\.agents\skills\` | Authoritative for MicroNest |
| Index | `.agents\skills.md` | Updated to name Cursor explicitly |

No copy into `~\.cursor\skills\` was required — trees are already discoverable.

---

## 2. Migrated / verified skills

| Skill | Source | License | Cursor compatible | Action taken |
| --- | --- | --- | --- | --- |
| **unslop** | `~\.agents\skills\unslop` | CC-BY-4.0 | Yes | Verified; keep attribution |
| Project architecture/security/ui-ux/… | Esports `.agents\skills` | Project / MIT per file | Yes | Index note for Cursor |
| reverse-engineer-anything | `~\.agents\skills\…` | Skill docs | Yes | Available; pair with optional Rea MCP |
| ui-ux-pro-max / design / brand / … | `~\.agents\skills` | MIT / upstream | Yes | No change |
| neon-* | `~\.agents\skills` | Neon upstream | Yes | Available alongside Neon plugin |
| Playwright / testing / supabase (project) | Esports `.agents` | MIT adapt | Yes | Prefer project versions for this repo |

---

## 3. Unavailable or incompatible

| Item | Status | Guidance |
| --- | --- | --- |
| **OpenDesign** | Plugin failed in OpenCode; skills only in OpenCode npm cache | Do not claim installed. Use Stitch + unslop + project ui-ux instead, or reinstall later under Cursor skills if desired |
| **Replica** | Not found | N/A |
| **Hallmark** | Methodology in P14 docs only | Use as reference; not an installed skill |
| **Graphify** | Not found | Codebase mapping via explore/Task + architecture skill; install Graphify later if owner chooses |
| **Muse 1.3 Contributor** | Not found on disk | Workflow ideas can be mirrored in Cursor rules; **no Muse↔Cursor integration verified** |

---

## 4. Adaptation notes

- OpenCode-only plugin loaders / `$unslop` slash stubs are not required in Cursor — load the `unslop` skill by reading `SKILL.md` when polishing UI.
- Project skills that say “OpenCode” in prose remain valid; `.agents\skills.md` now states Cursor + OpenCode.
- Do not copy OpenDesign’s `handoff-to-claude-code` skill as-is.

---

## 5. Verification checklist

- [x] `unslop\SKILL.md` present with CC-BY-4.0 credit  
- [x] Project `.agents\skills\*\SKILL.md` present (15 skills)  
- [x] `.agents\skills.md` references Cursor  
- [x] No duplicate install under `.cursor\skills\`  
- [ ] Agent session reload may be needed for brand-new personal skill folders (N/A — none added)
