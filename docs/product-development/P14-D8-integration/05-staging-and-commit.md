# 05 — Staging and Commit (P14-D8)

## Staging

| Check | Result |
| --- | --- |
| Method | `git add -A` after classification (respects `.gitignore`) |
| Legacy renames preserved | **1299** staged before and after |
| Staged total | **2142** paths |
| Unstaged / untracked after stage | **0 / 0** |
| `.env` / secrets | Not staged (gitignored) |
| `test-results/` / `playwright-report/` | Not staged (gitignored) |
| Legacy `.env.example` | Included as archive rename only (placeholder file) |

## Commit

| Field | Value |
| --- | --- |
| SHA | `3f4cc7b123de43e993a8e8f4dfa8f42da63c51e1` |
| Short | `3f4cc7b` |
| Message | `feat(esports): integrate Teams platform and authenticated workspace` |
| Parent | `376df8f` |
| Amend | No |

## Included in commit

- Teams + login/logout + directories + workspace surfaces
- Active migration chain (including grant hardening)
- Tests + e2e specs
- P14 evidence docs (D1–D7 + D8 preflight/gates)
- Cursor rules / AGENTS / `.vercelignore`
- Complete `legacy/` archive move (1299 renames)
