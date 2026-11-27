# Deferred Decisions (P6)

1. **Official roster sizes** — no BGMI squad/substitute mandate found in
   G1–P5; slot counts stay user-configured. Needs an owner/tournament-source
   decision before any "regulation mode."
2. **Role mandates** — Flexible + 4 BGMI roles optional only. Whether any
   slot *requires* a role (e.g. IGL) is undecided.
3. **RunnerForTool map** — convert the if-chain to a registry map at 4–5
   tools (see extension-architecture-review.md).
4. **Interactive UX tests** — Playwright covers no tools; add/remove/assign
   flows are inspection-verified. Add runner-level interaction tests when a
   third tool lands or earlier if regressions appear.
5. **Persistence/sharing** — out of scope by brief; any future save/share
   needs a privacy re-review (share links would extend the static audit).
6. **Bulk import** — D1's `features/teams/roster/parser` already parses
   pasted team/player text for discovery; P6 deliberately does not reuse it
   (manual-entry-only). Convergence is a future product call, not a code gap.
7. **Downloadable export** — copy-to-clipboard only; a file download would
   be local-only but adds surface. Deferred until requested.
8. **Team-management interplay** — workspace rosters (membership roles,
   captain, game_role) are authority-backed and separate; this tool is a
   planning scratchpad with no link between them. Any bridge needs owner
   sign-off.
