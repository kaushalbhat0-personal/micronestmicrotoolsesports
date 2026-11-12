# 07 — Final release report (P14-A, 2026-11-12)

## 1. Final branch map (exact SHAs, `ls-remote` + local)

| Ref | SHA | Content |
| --- | --- | ------- |
| `origin/main` | `376df8f651f3142dcaacb2ddbcbf269b38196040` | new platform + vercel.json fix |
| `origin/new-platform` | `376df8f…` (identical) | rollback/reference |
| local `new-platform` | `376df8f…` (checked out) | same |
| `origin/legacy-archive` | `bdece4db981a42719f74286ae6a9dbc15f68cd18` | legacy main, byte-identical |
| local `legacy-archive` | `bdece4d…` | same |
| local `main` | `caff7a2…` (contained in 376df8f) | left untouched (dirty tree) |
| `origin/master` | `b6ffe27…` | untouched |
| Tag `platform-release-2026-10-16` | unmoved | legacy line |

No force-push used (two fast-forwards: `bdece4d..01893ae`,
`01893ae..376df8f`). `new-platform` branch NOT deleted. No legacy file
rewritten; no legacy import in the new tree (zero runtime matches).

## 2. Legacy preservation: DONE

`origin/legacy-archive` = exact pre-transition `origin/main`, verified.
Rollback anchor exists independent of all later moves.

## 3. Main promotion: DONE (+1 approved fix)

- `01893ae` promoted fast-forward; `origin/new-platform` created as spare.
- Vercel auto-deploy of `01893ae` ERRORed on `vercel.json` schema
  (`comment` property — release-blocking, in the release commit).
- With separate user approval: one-line fix committed (ONLY `vercel.json`
  staged; 67 WIP entries preserved uncommitted), build re-verified,
  pushed fast-forward as `376df8f` to both `main` and `new-platform`.
- New production deployment `dpl_GFNDFjQC…` (376df8f): READY.

## 4. Build and tests (worktree; honest scope in §04)

`npm test` 99/1002 PASS · typecheck PASS · lint PASS · `next build` PASS
(all routes) · e2e 23/23 PASS. Switches OFF; ledger unchanged; no secrets
committed (`.env`/`.next` ignored).

## 5. Vercel status

Repo `kaushalbhat0-personal/micronestmicrotoolsesports`, prod branch
`main`, auto-deploy ON (no config change needed/made). Required env names
present (Supabase set included); values never read. Live: `dpl_GFNDFjQC…`
(376df8f, READY). Prior ERROR build documented; legacy READY builds remain
as rollback candidates.

## 6. Route matrix (production, `dpl_GFNDFjQC`)

`/` 200 (new homepage) · `/about /players /teams /tournaments /news
/organizations /brands /organizers /tools` 404-CORRECT (routes are
uncommitted work, absent from 376df8f — not broken). No 500s. No mutations
(GET-only). Browser-level checks (console, sub-resources, mobile, a11y)
explicitly untested — method limitation, not a pass.

## 7. Authentication: BLOCKED

No authorized test identity exists. Nothing authenticated was tested;
prerequisites listed in §06-B (designated test email, authorization,
cleanup rule).

## 8. DB-backed limitations

Remote = G1-only; D1/P9/P11/P13 unapplied (ledger re-verified). Deployed
commit makes zero Supabase calls. Every DB-backed feature is blocked by
(unapplied migrations + uncommitted pages + missing identities). Build
success is not claimed as DB proof.

## 9. Remaining production blockers

1. Commit the 67 WIP entries (separate release) so routes exist in prod —
   until then production is a homepage-only skeleton.
2. Repair + push migrations (stage-3/4 authorization) before any DB feature.
3. Authorized test identities + browser pass (console/mobile/a11y/secrets
   bundle scan) before preview claims.
4. Optional: `git fetch`/prune local `main` tracking (cosmetic only).

## Verdict: CONDITIONAL PASS — DEPLOYED, WITH DOCUMENTED LIMITATIONS

Transition safe and reversible; production stable on the intended line;
integrity green; smoke truthful. NOT launch-ready: no DB-backed feature is
verified and the deployed commit serves the skeleton only.

## Recommended next phase (P14-B suggested)

Commit-gated platform release: (a) review + commit the 67 WIP paths in
coherent units (routes/features/docs/migrations — never bundled with
unrelated history); (b) push to `new-platform`, preview-deploy, full
browser + smoke pass; (c) fast-forward `main`, verify prod; (d) only then
open the migration-application window (P13 §10) with test identities.
Keep `legacy-archive` and `origin/new-platform` until that release is
green.
