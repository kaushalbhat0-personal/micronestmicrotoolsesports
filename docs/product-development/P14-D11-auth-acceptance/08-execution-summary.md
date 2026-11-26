# 08 — Execution Summary (P14-D11)

## Verdict: CONDITIONAL PASS — SPECIFIED AUTHENTICATION TESTS PENDING

The P14-D10 authentication onboarding implementation was deployed to Vercel
Preview and validated end-to-end with real Supabase-issued sessions on project
`knniommcyyhbyiwljisk`. Production was not promoted or reconfigured.

### What passed

- Preview: `https://micronestmicrotoolsesports-56tuaj8c4-kaushal-bhats-projects.vercel.app`
  (`dpl_8LpooTHvFwGpprafnkdpkFT9PT3w`), source = HEAD `3b7ad5b` + preserved
  uncommitted P14-D10 set. Production baseline `…-9g8v8lq2x…` unchanged.
- Registration/login/logout/refresh/protected-prompt/banned/unverified:
  PASS live, including Playwright browser run with cookie-session evidence
  (`sb-knniommcyyhbyiwljisk-auth-token`) and 4 screenshots.
- Callback/redirect security: external, protocol-relative, invalid code, and
  missing-param probes correct — **no open redirect**.
- Regression: typecheck/lint/build/1018 unit green; local home/players E2E 8/9;
  G1 lanes 9/16/21/13/15 with known avatar flake (below). Write switches/DB/RLS
  untouched. Disposable accounts cleaned to 0; bypass revoked.

### Explicitly pending (each blocked — none assumed)

1. **Confirmation-ON** signup / pending / resend / confirm-link: live behavior is
   confirmation-OFF (session on signup). Changing Auth config is forbidden here.
2. **Real email-link redemption** (confirmation/recovery) on preview: GoTrue
   overrides preview `redirect_to` to production site URL — needs preview origin
   on the redirect allowlist (forbidden change). Fail-closed invalid-code paths
   proven instead.
3. **Fresh Management API Auth config read**: local access token invalid this
   session; dashboard values marked unverified in 02 (behavioral probes used).
4. **UI password-update form**: not present in P14-D10; admin update + new-password
   login proven at API layer only.
5. **SMTP send to a real mailbox**: not exercised (disposable non-routable domains;
   outbound policy rejects them for known users).

### Pre-existing failures (unrelated; not modified)

- `e2e/home.spec.ts` hero CTA (`Explore players` → intentional `Sign up free`).
- G1-5 avatar remove stale-URL assertion (storage consistency).

### Auth configuration findings (summary)

- Behavioral: autoconfirm ON (session at signup), signup open, min password 8,
  unverified + banned blocked, preview redirect not allowlisted.
- Dashboard/API re-inspect this session: **unverified** (invalid token).

### Release recommendation

Promote only after separate approval that covers: redirect allowlist review for
production + preview, SMTP/email-link click-through against production-equivalent
config, confirmation-ON decision, and the two pre-existing test fixes above.
