# 02 — Preview Deployment (P14-D7)

## Method

`vercel deploy --yes` (preview only; **not** `--prod`) from the dirty worktree so untracked Teams + login surfaces ship without committing legacy renames.

## Deployments

| Attempt | ID | URL | Result |
| --- | --- | --- | --- |
| 1 (Teams worktree) | `dpl_ZRGYv2SWDsVaQv2mC3z6gttECgpL` | `https://micronestmicrotoolsesports-5i0n91s8e-kaushal-bhats-projects.vercel.app` | READY (no login yet) |
| 2 (login draft) | `dpl_9UtT62LKEV7xBcddWVEWfVhzVW1a` | …`bp3ur9hl9`… | **ERROR** — typedRoutes on dynamic `next` path |
| 3 (login + typedRoutes fix) | `dpl_Dg6uV5ib84rjBdeMiaavHuxzt5hC` | `https://micronestmicrotoolsesports-5brlpjze9-kaushal-bhats-projects.vercel.app` | **READY** — E2E target |

## Canonical preview record

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_Dg6uV5ib84rjBdeMiaavHuxzt5hC` |
| Preview URL | `https://micronestmicrotoolsesports-5brlpjze9-kaushal-bhats-projects.vercel.app` |
| Inspector | `https://vercel.com/kaushal-bhats-projects/micronestmicrotoolsesports/Dg6uV5ib84rjBdeMiaavHuxzt5hC` |
| Environment target | preview (`target: null`) |
| Source | CLI filesystem (`source: cli`) |
| Meta commit (metadata only) | `376df8f` / `new-platform` — **content is dirty worktree**, not that commit alone |
| Build | Next.js 16.4.6 Turbopack; TypeScript passed after login fix |
| Warnings | middleware→proxy deprecation; npm install-scripts / cache-dir notices |

## SSO access for browser

Share link created via Vercel MCP `get_access_to_vercel_url` (expires ~23h). Cookie `_vercel_share` used for automation; secret not stored in docs.

## Material code shipped for E2E

- Teams create/settings with `WORKSPACE_WRITES_ENABLED=true`
- Minimal `/login` + `/logout` cookie-session surfaces (typedRoutes-safe `next` allowlist)
- Workspace sign-in CTA → `/login`

## Production

**Unchanged.** No promotion performed.
