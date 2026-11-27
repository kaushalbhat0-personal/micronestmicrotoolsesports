# Security and Privacy (P5)

## Boundaries

- **No authentication:** tools run login-free; no session, no identity, no
  user IDs anywhere in the tools vertical.
- **No database:** zero `.from(`, zero `.rpc(`, zero Supabase imports in
  routes (pinned by `src/app/tools/routes.test.ts`). Nothing to leak, nothing
  to breach.
- **No commerce:** no checkout, payments, escrow, pricing, subscriptions, or
  entitlements. The word "payment" appears only in disclaimers.
- **No external calls:** no `fetch(`, no third-party APIs, no credentials, no
  service-role anywhere in the vertical.
- **No personal data:** inputs are pool totals and percentages; roster-style
  pasted data is out of scope. No tracking, no analytics events.
- **No raw HTML:** no `dangerouslySetInnerHTML`; React escapes all rendered
  values; the summary is a `<pre>` of engine-built plain text.
- **Safe errors:** Zod issues render as field messages; the engine throws a
  coded `PrizePoolError` caught at the call site — never stack traces.

## Authorization

There is nothing to authorize: no user data, no writes, no paid gates. If a
future tool needs persistence or gating, that tool MUST arrive with its own
boundary proposal — the catalogue's availability field implies no approval.

## Residual risks

- Users may misread a calculation as a payment commitment: mitigated by
  planning-only copy in the runner, the summary header, and usage guidance.
- Copy/paste of the summary into announcements is user action; the summary
  carries the planning-only header with it.
- Clipboard API may be unavailable (permissions): silent fallback, no error
  surfacing beyond the absence of the "Copied" confirmation.
