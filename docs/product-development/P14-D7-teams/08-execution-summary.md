# 08 — Execution Summary (P14-D7)

## Verdict

**PASS — PREVIEW DEPLOYED AND COOKIE-SESSION E2E PASSED**

**Production remains unchanged.**

## Preview

| Field | Value |
| --- | --- |
| URL | `https://micronestmicrotoolsesports-5brlpjze9-kaushal-bhats-projects.vercel.app` |
| Deployment ID | `dpl_Dg6uV5ib84rjBdeMiaavHuxzt5hC` |
| Worktree basis | Dirty `new-platform` + untracked Teams/login (meta SHA `376df8f`) |
| Target | Preview only |

## Browser E2E highlights

- Cookie login/logout via `/login` + `/logout`
- Public team create on `/teams/new` with discovery + one `team.created` audit
- Owner settings save + `team.settings_updated`
- Captain allowed / cocap·player·sub·outsider denied (RPC); player settings UI read-only
- Private team undiscoverable; public roster identities withheld
- G1 `/players` functional; 12-column projection unchanged
- Fixtures cleaned; ledger 24; other write switches false

## Material fixes shipped for this phase

1. `.vercelignore` for safe lean preview upload  
2. Minimal `/login` + `/logout` (typedRoutes-safe) for cookie-session E2E  
3. Workspace sign-in link to login  

## Remaining risks / residuals

- Teams + login still **uncommitted**; git-linked preview of HEAD alone would **not** include them.
- Vercel SSO on previews requires share bypass for automation.
- Sensitive preview env values not inspectable via CLI pull (build injection relied upon).
- Captain settings exercised via RPC, not a second full browser pass.
- No dedicated mobile-emulation tool this session (narrow viewport smoke only).

## Production promotion (requires separate explicit approval)

| Item | Recommendation |
| --- | --- |
| Promotion target | Commit intended Teams + login surfaces (without unrelated legacy renames), then preview from that SHA, then promote **only after** owner authorization |
| Preview SHA to promote | Content equivalent to `dpl_Dg6uV5ib84rjBdeMiaavHuxzt5hC` worktree — **not** bare `376df8f` |
| Production env changes | None required for Teams cookie auth if Esports Supabase public keys already on production; optionally set `NEXT_PUBLIC_APP_URL` for preview/prod consistency |
| Rollback | Revert to current production `dpl_GFNDFjQCwPQmZcJDoJhoAQN2odwx` / prior alias; keep `WORKSPACE_WRITES_ENABLED` rollback option in source if needed |

## Do not

Promote this preview to production without a separate explicit production-deployment approval.
