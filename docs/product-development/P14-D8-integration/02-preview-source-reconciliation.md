# 02 — Preview-to-Source Reconciliation (P14-D8)

## Preview artifact

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_Dg6uV5ib84rjBdeMiaavHuxzt5hC` |
| URL | `https://micronestmicrotoolsesports-5brlpjze9-kaushal-bhats-projects.vercel.app` |
| Deploy method | Vercel CLI filesystem upload of dirty worktree |
| Meta SHA (metadata only) | `376df8f` — **content ≠ bare HEAD** |

## Source still present in worktree

| Area | Present |
| --- | --- |
| Teams UI (`/teams`, `/teams/new`, detail, workspace, settings) | Yes |
| Teams server actions + gated writer | Yes (`WORKSPACE_WRITES_ENABLED=true`) |
| Login/logout cookie-session surfaces | Yes (`/login`, `/logout`) |
| 24-migration chain through `20261115000001` grant hardening | Yes |
| Teams + G1 readers/tests | Yes |
| P14-D1…D7 evidence docs | Yes |
| Platform directories (players, orgs, brands, news, tools, tournaments, moderation, organizer) | Yes |
| `.vercelignore` used for preview lean upload | Yes |

## Material delta since preview (quality-gate only)

| Change | Reason |
| --- | --- |
| `src/server/admin/admin-boundary.test.ts` | Point assertions at active ledger (`20261112000002_p14_admin_superadmin_active_gate.sql`); archived `20261112000003` must stay out of `supabase/migrations` |

No feature-switch changes. No migration SQL content changes. Preview-tested Teams/auth behavior remains intact.

## Production baseline (unchanged)

`dpl_GFNDFjQCwPQmZcJDoJhoAQN2odwx` @ `376df8f`
