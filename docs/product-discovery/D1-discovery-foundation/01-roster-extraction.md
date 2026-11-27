# 01 — Roster Extraction (GATE D1.1)

## Sources inspected

- `ref/legacy-project/application/src/features/roster-builder/services/normalize.ts`
- `.../parser.ts` · `conflicts.ts` · `slots.ts` · `output.ts` · `whatsapp.ts`
- `.../types/index.ts` · `schemas/index.ts`
- `server/services/roster-builder-policy.ts` · `config/tools/policy.ts`
- Migration `20251106000001_roster_builder_launch.sql` (catalog row only)

## Greenfield destination

`src/features/teams/roster/` — `types.ts`, `normalize.ts`, `parser.ts`, `conflicts.ts`, `slots.ts`, `output.ts`, `schemas.ts`, `tests/{normalize,parser,roster}.test.ts`. Justification: roster intake is team-formation intake; seeding `src/features/teams/` with real logic avoids an artificial module. Shared pure library usable by future tournaments/tools intake.

## Adaptations

- Verbatim logic for normalize/parser/conflicts/slots/output; locale-specific `toLocaleString("en-IN")` replaced with plain counts (deterministic, locale-independent).
- `New RegExp` with explicit `\\u`/`\\x` escapes (ascii-safe source; identical semantics).
- Zod v3 `invalid_type_error` → v4-compatible signatures (greenfield `zod@4.6.7`).
- Removed: `@/lib/share/whatsapp` coupling, `roster-builder-policy.ts` (entitlement), `claim-actions`, workspace/session UI, `public-roster-demo`, `browser-actions`.

## Removed dependencies

DB, auth, entitlements, billing, network, randomness, browser APIs, WhatsApp budget constant (inlined decision: share copy belongs to future UI, not domain).

## Preserved behavior

NFC + zero-width + collapse + lowercasing keys; display preserves case/punct; delimiter detect (tab/comma/semicolon/pipe, header-scored); header vocabularies; caps (50k/2000/200/2000/300ch, capacity 1–30); conflict taxonomy (blocking/review/info, line refs, never merge); contiguous slots; CSV formula guard (`'` + DDE words); copy/CSV/print determinism; contacts excluded from identity and outputs.

## Intentionally not carried forward

`buildRosterWhatsAppMessage` (external share copy), Free-grant issuance, paid-source sets, claim UI, public demo, print CSS. Documented for future UI decision; no domain loss.

## Tests / acceptance

- `normalize.test.ts` (7): casing, zero-width, no aggressive folding, blanks, determinism.
- `parser.test.ts` (10): splits, quotes, delimiter detect, headers, empty/oversized, missing sides, adversarial determinism.
- `roster.test.ts` (8): cross-team blocking, over-capacity, no-merge duplicates, slot grouping, copy/CSV without contacts, formula guard, schema bounds.
- Status: PASS (see `07-test-evidence.md`).
