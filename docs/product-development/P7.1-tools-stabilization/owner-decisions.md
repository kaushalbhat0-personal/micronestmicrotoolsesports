# Owner Decisions (P7.1)

The following are **proposed defaults recorded by the implementation team,
not prior approvals**. No owner sign-off has occurred or is claimed. The
implementation below is safe under all of them: nothing built here assumes
monetization, persistence, official rules, or a contested-cutoff override.

1. **Competition tools are planning/simulation aids, not official rules
   engines.** Proposed. All three runners already carry simulation
   disclaimers; no change needed.
2. **Official rulebook encoding stays deferred** until authoritative rules
   and explicit approval exist. Proposed. P7.1 encodes nothing.
3. **Contested qualification requires human decision.** Proposed. The
   tiebreak engine reports `contested` and refuses to auto-qualify; UI
   banners say so.
4. **Generic tools may be platform-wide; game-specific tools must declare
   actual game dependencies.** Proposed. Matches current registry:
   splitter + tiebreak `gameKeys: null`, roster `["bgmi"]` with a local
   vocabulary adapter. No labels changed.
5. **Playwright is the recommended interaction-testing approach.**
   Proposed and now exercised: `e2e/tools/` (21 tests, Chromium, stubbed
   clipboard, mobile + desktop viewports). No Docker, no external services,
   no real user data.
6. **RunnerForTool transitions to a slug-to-component map before the
   fourth tool.** Adopted in this phase (see runner-architecture.md):
   explicit `TOOL_RUNNERS` map with a parity test that fails on drift.

## Still requiring an actual owner decision

Monetization, persistence/sharing, and official-rulebook sourcing remain
undecided and were explicitly not allowed to block this phase. Items 1–5
above still need approval, amendment, or rejection.
