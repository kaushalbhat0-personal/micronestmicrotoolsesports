# 04 — Security Threat Model

Deny-by-default. For each threat: attacker capability, impact, existing protection (Verified), required mitigation (Proposed), verification test.

## T1 — Player A reads Player B’s BGMI ID

| | |
|---|---|
| Attacker | Authenticated or anonymous user |
| Impact | PII / account linkage |
| Existing | Owner RLS on `player_game_profiles`; omitted from public RPCs; Share Kit forbids `game_user_id` (**Verified**) |
| Mitigation | Keep omit from all public RPCs/share; no team roster export of IDs; integration tests assert key absence |
| Test | Anon + other user SELECT/RPC cannot observe `game_user_id` |

## T2 — Player A downloads Player B’s evidence

| | |
|---|---|
| Attacker | Authenticated user forging path `{B_uid}/…` |
| Impact | Private screenshot leakage |
| Existing | Storage SELECT policy requires folder `[1] = auth.uid()` (**Verified**); bucket not public |
| Mitigation | Never return storage paths in public APIs; signed URL only after server authz; no long-lived URLs |
| Test | User A `createSignedUrl` / select on B’s object fails; reviewer path requires super-admin |

## T3 — Team owner reads roster members’ evidence / BGMI IDs

| | |
|---|---|
| Attacker | Team captain/owner |
| Impact | Cross-player private identity harvest |
| Existing | Team public RPCs expose `member_count` only (**Verified**); no evidence API for captains |
| Mitigation | No captain grant on `private-verification` or private game ID columns; roster features stay aggregate |
| Test | Captain client cannot select members’ `game_user_id` or evidence metadata |

## T4 — Ordinary user approves verification

| | |
|---|---|
| Attacker | Any authenticated non-admin |
| Impact | Fake trust badge |
| Existing | No player verification write API yet; `is_super_admin` exists (**Verified**) |
| Mitigation | Approve/reject only via DEFINER RPC asserting `is_super_admin()`; no table UPDATE grants |
| Test | Non-admin RPC call returns error; status unchanged |

## T5 — Self-approval

| | |
|---|---|
| Attacker | Subject who is also somehow admin, or bug allowing self review |
| Impact | Integrity failure |
| Existing | N/A (workflow absent) |
| Mitigation | RPC `actor_user_id <> subject_user_id`; policy: admins should not review own cases (hard deny) |
| Test | Super-admin reviewing own uid rejected |

## T6 — Client modifies verification status

| | |
|---|---|
| Attacker | Browser manipulating PostgREST/JSON |
| Impact | Unauthorized badge |
| Existing | Pattern: consent columns blocked from direct UPDATE (**Verified** for discoverability) |
| Mitigation | Same for verification status columns — RPC-only; RLS default deny |
| Test | Direct `update` on case table fails for authenticated role |

## T7 — Forged storage paths / IDOR

| | |
|---|---|
| Attacker | Guess UUID paths |
| Impact | Cross-account read/delete |
| Existing | Folder ownership in storage policies (**Verified**) |
| Mitigation | Server re-checks ownership; metadata FK to `auth.uid()`; unsigned public URLs never issued |
| Test | Path traversal / other-uid folder denied |

## T8 — Public signed URL leakage

| | |
|---|---|
| Attacker | Recipient of leaked URL or cached HTML |
| Impact | Evidence disclosure |
| Existing | Intent documented; no player evidence UI yet |
| Mitigation | TTL 60–300s; no log of full URLs; no CDN caching of private bucket; reviewer UI fetches on demand |
| Test | Expired URL fails; SSR HTML contains no `private-verification` query tokens |

## T9 — Evidence in public API responses

| | |
|---|---|
| Attacker | Directory/profile consumer |
| Impact | Mass leakage |
| Existing | 12-field freeze (**Verified**) |
| Mitigation | Separate boolean trust reader only; regression test forbids keys `evidence`, `storage_path`, `signed_url` on public cards |
| Test | `get_player_by_handle` key-set unchanged |

## T10 — OAuth CSRF / state manipulation (Discord, if built)

| | |
|---|---|
| Attacker | CSRF login/link attacker |
| Impact | Account linking abuse |
| Existing | Discord **absent** (**Verified**) |
| Mitigation | If built: signed state/nonce cookie, PKCE where applicable; bind state to session |
| Test | Callback with missing/invalid state rejected |

## T11 — OAuth token exposure

| | |
|---|---|
| Attacker | XSS / public JSON |
| Impact | Discord account takeover |
| Existing | N/A |
| Mitigation | Tokens server-only table; never `NEXT_PUBLIC_`; never Share Kit; encrypt-at-rest if stored |
| Test | Public responses omit token fields; forbidden audit key scanner |

## T12 — Malicious / oversized uploads

| | |
|---|---|
| Attacker | Owner uploading huge/random files |
| Impact | Cost / DoS |
| Existing | Bucket 5 MB limit (**Verified**) |
| Mitigation | App-level size check; rate limit submissions; prefer images-only for player evidence |
| Test | >max bytes rejected before/at storage |

## T13 — MIME spoofing / executable content

| | |
|---|---|
| Attacker | Uploads `.png.exe` or polyglot |
| Impact | Reviewer workstation risk |
| Existing | Bucket MIME allowlist (**Verified**) |
| Mitigation | Magic-byte sniff; extension allowlist; serve `Content-Disposition: attachment`; no inline HTML |
| Test | Disallowed MIME rejected; content-type mismatch rejected |

## T14 — Submission spam / reviewer abuse

| | |
|---|---|
| Attacker | Flood pending queue |
| Impact | Ops overload |
| Existing | Auth rate limits only (**Verified** partial) |
| Mitigation | Per-user pending cap; replace-in-place; daily resubmit quota |
| Test | Excess submissions rejected with safe error |

## T15 — Reviewer account compromise

| | |
|---|---|
| Attacker | Stolen super-admin session |
| Impact | Mass fake approvals / evidence exfiltration |
| Existing | Small `platform_admins` set; append-only audit (**Verified** pattern) |
| Mitigation | MFA on admin accounts (ops); audit every signed URL mint + decision; anomaly alerts (future) |
| Test | Audit row written for approve/reject/sign |

## T16 — Stale approval after BGMI ID change

| | |
|---|---|
| Attacker | Owner changes ID post-approval |
| Impact | Misleading badge |
| Existing | N/A |
| Mitigation | Trigger/RPC on `game_user_id` update clears approval + audit |
| Test | After ID change, public flag false; status withdrawn/invalidated |

## T17 — Badge remains after withdraw / reject / delete

| | |
|---|---|
| Attacker | Cached pages / stale ISR |
| Impact | Trust lie |
| Existing | Player pages moved toward `force-dynamic` in M1-V (**Verified** uncommitted) |
| Mitigation | Public flag sourced from live DEFINER read; cache tags / force-dynamic; Share Kit regenerates client-side from live props |
| Test | After withdraw, profile + PNG inputs lack badge |

## T18 — Evidence retention after account deletion

| | |
|---|---|
| Attacker | N/A (compliance) |
| Impact | Orphaned private media |
| Existing | Path tied to uid; profile delete flows exist |
| Mitigation | On account/profile delete: purge `{uid}/**` in `private-verification` + metadata cascade |
| Test | Integration: delete user → storage list empty |

## Cross-cutting controls

1. Deny-by-default RLS; RPC-only sensitive writes.  
2. Service role only on server after `requireSuperAdmin` / system jobs — never browser.  
3. Zod on all external inputs.  
4. Frozen public projection key-set tests remain red-line regressions.
