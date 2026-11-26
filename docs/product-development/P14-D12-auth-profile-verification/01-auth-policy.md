# 01 — Authentication Policy (P14-D12)

## Product decision (authoritative)

| Rule | Policy |
|---|---|
| Provider | Email / password only |
| OAuth | Not enabled; not implemented unless separately approved |
| Email confirmation | **Disabled** — no confirmation workflow in product UI |
| Signup outcome | Immediate authenticated cookie session |
| Login | Normal email / password |
| Logout | Clears session via `/logout` |
| Session persistence | Cookie session via `@supabase/ssr` |
| Onboarding email verification | **Not required** |
| Post-signup redirect | Profile completion (`/onboarding/profile`) by default |

## Explicit non-goals

- No confirmation-pending / resend-confirmation UI.
- No email-verification gate in the onboarding screens.
- No third-party identity provider integration in this phase.

## Relationship to Teams `email_confirmed_at`

`create_team` still requires `auth.users.email_confirmed_at IS NOT NULL` at the
database layer (unchanged). With Autoconfirm / confirmation-disabled Auth,
signup sets `email_confirmed_at` immediately, so frictionless users satisfy
the RPC without clicking an email link.

## Profile verification vs email confirmation

These are separate:

1. **Mailbox / Auth confirmation** — disabled under this policy.
2. **Player profile verification** — future admin-reviewed trust state; never
   implied by self-reported profile completeness (see 05).
