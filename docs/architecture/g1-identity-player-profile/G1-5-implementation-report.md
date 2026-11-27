# G1-5 Implementation Report — Avatar Storage Wiring

## 1. Verdict

**G1-5 PASS** — D-G1-06 resolved as an implementation detail (Option A,
no product approval required per `10`, no migration), avatar flows
implemented against the existing storage architecture, DirectoryReader
avatar resolution hardened to fail closed, mocked + live adversarial
tests green, remote verification complete, zero residue.

## 2. D-G1-06 original wording and resolution status

Verbatim from `10-open-decisions.md` (not inferred from the identifier):

- Question: Canonicalize `jpeg→jpg` on upload or preserve original extension?
- Options: (a) Canonicalize to `{png,jpg,webp}` (recommended — single path
  per user simplifies replacement). (b) Preserve.
- Recommendation: (a).
- Impact: Upload action + CHECK regex.
- User approval required: **No** (implementation detail; recorded for
  consistency).
- Register status: open detail, gate before G1-5 wiring.

Determinations (Phase 1):

1. The question is purely file-extension normalization; no privacy,
   retention, consent or discoverability semantics are involved.
2. Existing technical implementation already constrains the space: the DB
   CHECK (`^[0-9a-f-]{36}/avatar\.(png|jpe?g|webp)$`) and
   `avatarPathSchema` accept both `jpg` and `jpeg`; the bucket accepts
   `image/jpeg`; no upload action existed; the path convention is fixed
   as `{uid}/avatar.{ext}` (single file per user) by `06 §2`.
3. Already approved (frozen): `public-avatars` bucket (public, 512 KB,
   raster-only), owner-scoped policies, single-path discipline, MIME/size
   re-validation, stable public URLs (never signed), no new buckets or
   broad policies (`06`, `11 §3`).
4. Remaining decision: adopt (a) or (b) for new writes. No product-owner
   input is required by the register.
5. Impact on avatar storage/paths/URLs/public exposure: Option A maps
   `image/jpeg` uploads to `avatar.jpg` (canonical write set
   `{png,jpg,webp}`); reads keep accepting legacy `jpeg` (DB CHECK
   unchanged). One live file per user; extension changes delete the stale
   object. Public exposure is unchanged (same bucket, same resolution).
6. Blocking: yes as a stage gate (G1-5 requires D-G1-06 per `11 §7`), but
   resolvable internally without product approval.
7. Migrations: **none required**. The CHECK regex already permits both the
   canonical (`jpg`) and legacy (`jpeg`) spellings, so adopting Option A
   is an app-level normalization with zero DDL.

Resolution: **D-G1-06 Option A ADOPTED** (canonicalize `jpeg→jpg`) as an
implementation detail. No `D-G1-06-decision-brief.md` was created because
the register explicitly marks this decision as not requiring product-owner
approval; creating an approval brief would misrepresent its status. Evidence
is recorded here instead.

## 3. Preflight evidence

- Repo `micronestmicrotoolsesports`, branch `new-platform`, HEAD
  `01893ae5b0275979649edb754e4d9ee6cbaebb7` (unchanged baseline).
  Pre-existing uncommitted items preserved; nothing staged, committed or
  pushed.
- Primary project verified by explicit ref (never any env var): id
  `knniommcyyhbyiwljisk`, name `micronestmicrotoolsesports`, region
  `ap-northeast-1`, status `ACTIVE_HEALTHY`, PG `17.6.1.171`. Sibling
  `whitelabel-lms` (`iwgefthgciddukqabkun`) never accessed.
- Migration history before and after: exactly `...001` foundation,
  `...002` storage, `...135602` identity anchor, `...135654` grant
  tightening, `...141108` player profile, `...143759` game catalogue,
  `...72251` public projection — **no new migration applied in G1-5**.
- RPCs live-verified: `search_player_directory` and
  `get_player_by_handle` present, `SECURITY DEFINER`, frozen 12-column
  `TABLE` output in frozen order.
- Buckets live-verified: `public-avatars` (public, 524288,
  png/jpeg/webp), `public-entity-media` (public, 2 MB, +svg),
  `private-verification` (private, 5 MB, +pdf). Exactly the 8 foundation
  storage policies; no changes.
- Existing code read: `schemas/avatar.ts` (CHECK-mirror regex),
  `server/directory-reader.ts` (`getPublicUrl` resolution, NULL stays
  NULL), `server/player-profile.ts` (`avatar_path` in generic patch),
  `domain/public-projection.ts` (frozen 12), all G1-2/G1-3/G1-4 reports.
- Architecture + G1-1..G1-4 reports read. Nothing changed during preflight.

## 4. Avatar storage contract

- Bucket: existing `public-avatars` only. No new buckets, no policy
  changes, no migration.
- Write set (canonical, D-G1-06 Option A): `{uid}/avatar.{png,jpg,webp}`.
  `image/png → avatar.png`, `image/jpeg → avatar.jpg`, `image/webp →
  avatar.webp`. Reads accept legacy `avatar.jpeg` (DB CHECK + Zod unchanged
  for backwards compatibility); new writes never emit `jpeg`.
- Validation (app boundary, before any storage call): MIME must be exactly
  one of `image/png`, `image/jpeg`, `image/webp` (SVG/GIF/PDF/reject);
  `bytes.byteLength` 1..524288 inclusive; non-empty; no caller-supplied
  path or UID.
- Ownership: every path is derived as `{sessionUid}/avatar.{ext}` from the
  verified session (`auth.getUser()`); functions accept no UID or path
  argument (arity is the proof). Storage RLS (`foldername(name)[1] =
  auth.uid()`) enforces the same binding server-side.
- Stable paths, never signed URLs: the DB stores the relative object path;
  public reads use `getPublicUrl` (offline building). No
  `createSignedUrl` for public avatars. `private-verification` is never
  touched by avatar code.
- Ordering (storage and DB are not transactional, `06 §5`): upload =
  storage upsert first, then `avatar_path` update (storage failure aborts
  the DB write — no dangling pointer); removal = storage deletes first,
  then `avatar_path = NULL` (storage failure aborts the NULL write — no
  stale public URL). Extension changes delete the stale object by exact
  path (single live file per user). Removals delete all four canonical
  variants by exact path (current + `png/jpg/jpeg/webp`); no bucket
  listing, no broad prefix deletes.
- Removal of an avatar nulls the column in the same server flow, so the
  next directory response carries NULL (no stale URL). Consent withdrawal
  hides the entire projection row (avatar included) on the next RPC call;
  the underlying public object may remain addressable by a previously
  observed URL (public-bucket property, documented) but is no longer
  linked or discoverable.
- Public projection exposure: `avatar_url` is a derived public URL that
  embeds the UID path segment. This is the approved posture (`07 §7`:
  UID is unguessable, the path is the public object address; no email,
  IDs, or evidence are exposed). No storage internals (bucket config,
  signed tokens) and no separate user-ID fields leave the projection.

## 5. Storage policy and ownership evidence

- Live policies (unchanged): `public-avatars public read` (SELECT to
  `public`); `public-avatars owner insert/update/delete` (authenticated,
  `foldername(name)[1] = auth.uid()`); `private-verification` owner-only
  (insert/read/delete, no public read); `public-entity-media public read`
  only. Verified via `pg_policies` (8 rows, same as foundation).
- Ownership live-proven: user B direct storage upload to user A's avatar
  path → RLS denial; B's `uploadAvatar` lands on B's prefix only and never
  touches A's row or object; B's forged UID/path smuggling is unexpressible
  (no such parameters exist).
- Public/verification boundary live-proven: anonymous download of the
  avatar object succeeds; anonymous download of a `private-verification`
  object fails; authenticated non-owner download of another user's
  verification object fails with no data.
- Bucket caps live-verified: 524288 bytes, MIME allowlist
  png/jpeg/webp (SVG absent for avatars).

## 6. DirectoryReader behavior

- Hardened `resolveAvatarUrl`: NULL stays NULL; non-NULL values must match
  the strict uid-scoped allowlist
  `^[0-9a-f-]{36}/avatar\.(png|jpe?g|webp)$` or the whole row fails closed
  with `DirectoryOperationError` (absolute URLs, traversal, query strings,
  SVG/wrong shapes never pass through). Signed-URL shapes (`token=`, `?t=`)
  are rejected as contract drift.
- Fixed a latent unit-test fixture bug the hardening exposed: the old
  `directory-reader.test.ts` used `"uid-1/avatar.png"` (fails the strict
  allowlist, correctly rejected). The fixture now uses a valid 36-char UID
  path; no production relaxation was made.
- Consent predicates are untouched (enforced inside the RPCs); the reader
  still maps only eligible rows, asserts the exact frozen 12-key order, and
  never forwards extra keys (drift tripwire preserved).
- Post-replace and post-remove directory responses verified live: new
  extension URL after replace (old URL no longer linked), NULL after
  remove, full-row suppression on consent withdrawal with restore.

## 7. Public projection compatibility

- The projection still contains exactly 12 columns in frozen order
  (`handle, display_name, avatar_url, bio, country_code, game_key,
  game_name, ign, primary_role, play_modes, region_code, availability`),
  asserted live on every directory row in both the G1-4 regression
  (13/13) and the G1-5 suite (10/10).
- `game_user_id` remains stored owner-private and never projected (G1-4
  guarantee re-proven live). No IDs, emails, evidence, timestamps, flags,
  or storage internals in the projection. No signed URLs in the
  projection (explicit rejection guard added).
- No new public fields, no `game_user_id` exposure, no legacy imports, no
  service-role for ordinary operations, no database reset.

## 8. Unit/live test results

- Unit (`npm test`, no network): **162/162 across 16 files** (137 carried
  G1-1..G1-4 incl. 14 directory-reader + 8 new `avatar.test.ts`
  + 17 new `avatar-ops.test.ts`). Covers constants/caps, D-G1-06
  canonicalization, MIME/size/path validation, session-derived identity
  (arity proof), suspension/unauthenticated/missing-profile mapping,
  same-extension no-op, extension-change stale delete, storage-first
  ordering, removal idempotency/abort semantics, reader fail-closed on
  absolute URLs and malformed shapes, safe generic errors.
- Live avatar (`tests/avatar.integration.test.ts`, G1_TEST_MODE-gated):
  **10/10 green** (~27 s). Covers valid upload (canonical path, owner +
  anon fetch), invalid MIME rejected pre-write, oversized rejected
  pre-write, invalid paths rejected at the CHECK layer, cross-user
  overwrite denied (direct forgery + API isolation), anon public read of
  avatars with verification objects inaccessible (anon + non-owner),
  12-key directory resolution with unsigned public URL, replacement with
  single-file proof (prefix listing shows exactly `avatar.webp`) and
  directory URL rollover, removal with empty listing and NULL directory,
  consent-withdrawal full-row suppression with restore.
- Live directory regression (G1-4 suite, hardened reader): **13/13 green**
  (~24 s). No G1-4 behavior change.
- Flakiness note (investigated, not a product bug): object `download`
  immediately after a `delete` may briefly serve a stale success on the
  public bucket, while the prefix `listing` reflects the delete
  immediately. Implementation was proven correct (delete API returns the
  deleted object; listing shows a single/empty file). The suite asserts
  the single-file invariant via the strongly-consistent listing (polled)
  and polls downloads, so it is stable across runs (three consecutive
  full-suite greens after the change; earlier single-shot download asserts
  flaked nondeterministically between the replace and remove tests).
- `npm run typecheck` PASS; full-repo `npm run lint` PASS (0 errors,
  0 warnings); `npm run build` PASS (routes unchanged:
  `/`, `/_not-found`, `/api/health`; `middleware`-deprecation notice
  pre-existing).

## 9. Remote verification

- Project reverified by explicit ref before and after: `knniommcyyhbyiwljisk`
  (`micronestmicrotoolsesports`, `ap-northeast-1`, `ACTIVE_HEALTHY`,
  PG `17.6.1.171`). Sibling project never accessed.
- No migration applied: history holds the same 7 records as G1-4, in order.
  Both RPCs unchanged (DEFINER, frozen 12-column `TABLE`, same bodies).
  Tables: RLS on all four; `app_users` 0 rows, `player_profiles` 0 rows,
  `player_game_profiles` 0 rows, `games` 1 row (`bgmi` active restored).
- Storage: `storage.objects` group-by-bucket returns zero rows (no orphan
  objects). Bucket configs and 8 policies identical to foundation.
- Advisors: only the 2 intentional anon/authenticated DEFINER-EXECUTE WARN
  families (accepted per D-G1-03 with audited hardening); no new lints.

## 10. Cleanup proof

- `afterAll` (ownership-verified, exact tracked ids/paths, reverse
  dependency order): exact-path storage sweep (`public-avatars` tracked
  avatar paths + `private-verification` evidence paths, no broad
  selectors) → game rows → profile rows → app rows (status restore first)
  → auth deletes.
- Live-verified: `player_profiles` 0, `player_game_profiles` 0,
  `storage.objects` 0 rows across buckets, `games` holds only `bgmi`/active.
- Temp live-run loaders (`scripts/tmp-g1-5-env.mjs`) and the debug script
  were deleted after the runs (no secrets committed; `.env` untouched).

## 11. Git status

- Branch `new-platform`, HEAD `01893ae5b0275979649edb754e4d9ee6cbaebb7`.
  New (untracked): `schemas/avatar.ts` (extended),
  `domain/avatar.ts`, `server/avatar.ts`, `tests/avatar.test.ts`,
  `tests/avatar-ops.test.ts`, `tests/avatar.integration.test.ts`,
  this report. Modified: `schemas/avatar.ts` callers none breaking,
  `server/directory-reader.ts` (fail-closed avatar resolution),
  `tests/directory-reader.test.ts` (valid-UID fixture),
  `src/features/player-profile/README.md` (G1-5 scope + D-G1-06 closed).
  No migrations added or modified. Nothing staged, committed or pushed
  (per non-negotiables).

## 12. Next gate recommendation

- Proceed to **G1-6** (public directory + profile routes, read-only via
  `DirectoryReader` only; keep the lint guard against base-table imports
  in route modules). G1-5 leaves the reader contract ready: valid paths
  resolve, NULL stays NULL, malformed shapes fail closed.
- Keep **G1-7** gated on D-G1-05/D-G1-07/D-G1-08 (handle throttle, deletion
  grace, completion definition). Keep public onboarding gated on
  D-G1-07/D-G1-10. No G1-6/G1-7 work was started here.
