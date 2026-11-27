# 06 — Retirement Acceptance Gates

`ref/legacy-project/` deletion requires ALL gates. Deletion itself is out of scope for this phase.

## 1. Mandatory gates

1. **Register resolved:** every PORT/REIMPLEMENT in `02` has an accepted greenfield replacement or a logged product-owner waiver; every DOCUMENT has its spec in `07`; every REJECT/DEFER has a logged rationale.
2. **Rules preserved:** business rules, validation caps, algorithms, and outcome enums in `07` reviewed and approved.
3. **Independent tests:** greenfield replacements carry their own Vitest (+ integration where DB) proving ported behavior; no test imports from `ref/`.
4. **Greenfield acceptance:** replacements accepted under the same bar as G1 (tables + RLS + RPCs + tests + routes + marketing availability update together; no stubs/dead links).
5. **No active imports:** repo-wide grep for `ref/legacy-project` in `src/`, `supabase/`, `e2e/`, configs returns only docs/comments (zero runtime imports). `tsconfig`/`eslint` exclusions still intact until deletion.
6. **No runtime dependencies:** no legacy cron, webhook, OAuth callback, or ingest route referenced by any deployed target; `vercel.json` + GitHub workflows audited.
7. **No migration references:** no greenfield migration references legacy tables/RPCs/policies; legacy 58 migrations superseded by lineage doc (not by restore).
8. **Env reviewed:** every legacy env name (`CRON_SECRET`, `TWITCH_*`, `YOUTUBE_*`, `KICK_*`, `DODO_*`, `RAZORPAY_*`, `BILLING_LIVE_TEST_*`, `APP_URL` variants) classified keep/rotate/remove; live project bindings verified; `YOUTUBE_WEBSUB_VERIFY_TOKEN` currency confirmed.
9. **Historical evidence retained:** items in §2 copied outside `ref/` (docs + seed fixtures where needed); retention decision logged (never silent delete for billing/audit-adjacent rows).
10. **Product-owner sign-off:** explicit approval recorded (decision register entry) before `git rm ref/legacy-project/`.

## 2. Documentation that must survive deletion

- This A1 set (01–07) + A0 set (`A0-codebase-audit/`) — permanent record of what existed and why.
- `docs/product-discovery/backend-reuse-audit.md` + `backend-parity/` + `backend-foundation/` — parity and foundation rationale.
- Preserved specs in `07-preserved-domain-knowledge.md` (rules/algorithms, not code).
- Key fixtures only if needed for greenfield tests (copied into `src/**/__fixtures__`, never by referencing `ref/`).
- Deletion log entry (date, commit, approver, pre-delete grep + migration-list evidence).

## 3. Deletion procedure (when gates pass, separate change)

1. Verify gates 1–10 with evidence links. 2. `git rm -r ref/legacy-project/` on `new-platform`. 3. Remove `ref/**` exclusions if empty; update `ref/legacy-project/README.md` pointers. 4. Run `typecheck + test + test:all` (npm). 5. Commit with gate checklist. No push/deploy in this phase.
