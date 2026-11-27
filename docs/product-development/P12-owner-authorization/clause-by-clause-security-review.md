# Clause-by-clause security review (proposal + six migrations)

Method: static review of the §2–§4 proposal DDL against the six migration
files (P9 05/06, P11 01/02/03) and the G1–D1 baseline. No execution; runtime
remains blocked (see P11 `runtime-verification-strategy.md`).

## §2 `provision_organizer` — review

- **Authority placement: PASS.** The `is_super_admin()` check is first, in
  the body, before any read or write. The broad EXECUTE grant is safe by
  construction (grants nothing by itself). No caller parameter is trusted
  for authority — `p_owner` is validated as an active-account pointer only.
- **Fail-closed: PASS.** Empty `platform_admins`, suspended admin, or anon
  caller → raise before any write; transaction atomicity means no partial
  rows and no audit-without-organizer.
- **Duplicate safety: PASS.** Slug pre-check + unique constraint (race) +
  owner-immutability trigger (second owner raises). Replays fail closed.
- **F-01 interplay: PASS.** Inserted row carries default `not_submitted`;
  the F-01 INSERT branch passes; no pre-confirmation path added.
- **Audit integrity: PASS.** `admin_audit_logs` row in the same transaction
  with session-derived `actor_user_id`; append-only table untouched.
- **DEFINER scope: ACCEPTABLE.** The function bypasses RLS only after the
  authority check, writes exactly three rows, and grants nothing else. No
  service-role involvement. `SET search_path = ''` with schema-qualified
  references throughout.
- **Residual:** input validation mirrors P9 CHECKs but cannot reference the
  game catalogue whitelist (parameter is `text[]`, not enum-bound) — replay
  verification must confirm garbage `game_keys` are rejected at read time
  as today (fail-closed readers), or tighten to a catalogue check before
  apply.

## §3 queue policies — review

- **Reporter insert: PASS.** `reporter_id = auth.uid()`, forced `open`,
  null resolution/reason/reviewer/decided, active-account gate. Reporters
  cannot pre-resolve, pre-assign, or file as another user. No reporter
  UPDATE/DELETE (filed reports are immutable to reporters).
- **Case insert: PASS.** Owner/admin of the row's organizer only
  (`role in ('owner','admin')` — editors excluded), forced `submitted`,
  `submitted_by` session-bound. Cross-organizer case filing is
  unrepresentable (membership join on the row's own organizer).
- **Moderator update/select: PASS.** Pure `is_super_admin()` gates, symmetric
  USING/WITH CHECK (no privilege widening on write vs read).
- **Decision insert: PASS.** Moderator-only with `reviewer_id = auth.uid()` —
  forged reviewer identity is unrepresentable; reason required by NOT NULL +
  CHECK (silent moderation unrepresentable).
- **Member decision select: PASS with composition note.** The EXISTS nests
  `tournaments` (member-select RLS) and `organizer_members` (self-select
  RLS) — the same recursive-RLS composition P9 relies on; members see only
  their own organizer's decisions. No reporter identity is exposed by this
  path beyond what the app boundary renders (reasons only, never reviewer
  identity — app-layer rule, pinned in P10 route audits).
- **Default-deny preserved: PASS.** No anon policy anywhere; no DELETE
  policy anywhere; no policy on `organizer_members` (F-03 posture preserved).

## §4 lifecycle replacement — review

- **Moderator branches: PASS.** Each previously-blocked transition now
  permits exactly `is_super_admin()` callers and raises the original message
  otherwise. Non-moderator behavior is byte-identical to P9 (same messages,
  same fall-through raise).
- **Draft→published: still no path** (falls to the final raise for every
  role) — no bypass introduced.
- **F-02 interplay: PASS.** The freeze trigger is untouched and fires
  independently of lifecycle state changes; a moderator publishing a listing
  with smuggled content edits still hits the freeze (OLD is `submitted`,
  so content edits at publish time are… **NOTE:** the freeze fires only when
  OLD is `published`. Edits riding along with `submitted → published` are
  governed by review discipline + the decision audit, not the freeze. This
  matches the threat model (freeze targets post-publish bait-and-switch) and
  is recorded so reviewers do not over-claim.
- **Hardening delta: PASS.** Added `security invoker` + empty search path;
  behavior otherwise identical. Rollback = re-apply P9 file-06 body.

## Six-migration re-affirmation (P9 05/06, P11 01/02/03)

- P9 05/06: as reviewed in P10 `migration-review.md` (F-01/F-02/F-03
  findings now addressed by P11 01/02 + §2 above; nits N-01…N-05 stand).
- P11 01 (trust guard): fail-closed moderator-only freeze; no privilege
  added; §4/§2 introduce no `trust_state` path outside it — D-05 activation
  for verification review writes `verification_cases`, never `organizers`
  directly; the only `organizers.trust_state` writer remains a moderator
  UPDATE through the guard. **No self-confirmation path in the full
  sequence: PASS.**
- P11 02 (freeze): untouched by §§2–4; field list identical to the
  `MATERIAL_TOURNAMENT_FIELDS` pin. **No weakening: PASS.**
- P11 03 (queue): §§3 policies are the first and only policies on these
  tables; inert-until-then posture holds. **No exposure: PASS.**
- **Interaction matrix (proposal × six files):** no dropped/altered P11
  object; one function replacement (§4, rollback documented); no grant to
  any table for any API role in the entire nine-file sequence except P9's
  original member-scoped grants. **Cross-organizer writes remain impossible
  at every layer: PASS.**

## Forbidden-pattern sweep (proposal DDL)

No `GRANT … ON TABLE` to any API role; no `CREATE POLICY` without an
`is_super_admin()` or session-membership gate; no `service_role`; no
evidence/storage/bucket identifier; no P3 reader recreation; no `TRUNCATE`;
no `SECURITY DEFINER` outside §2 (whose scope is reviewed above). Pinned by
`p12-activation-proposal.test.ts`.
