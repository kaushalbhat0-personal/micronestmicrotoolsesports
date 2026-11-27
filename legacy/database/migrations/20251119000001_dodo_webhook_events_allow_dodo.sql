-- MicroNest — Dodo international V1: allow 'dodo' in webhook_events.
--
-- Audit RCCF-DODO-INTERNATIONAL-AUDIT-01 verdict was BLOCKED because
-- webhook_events.provider and webhook_events.platform CHECK constraints
-- reject 'dodo', while the Dodo webhook route persists
-- provider='dodo' / platform='dodo' rows for idempotency/audit.
--
-- This migration ONLY widens those two CHECKs. Historical migrations are
-- untouched. Every previously allowed value is preserved verbatim; 'dodo'
-- is appended (never replaces anything). No CHECK is dropped without a
-- same-or-wider replacement in the same transaction. No unconstrained text.
--
-- Deterministic and idempotent: DROP IF EXISTS + ADD, safe to re-apply.

-- ── provider: preserve stripe/razorpay/twitch/discord/youtube/kick, add dodo ──
alter table public.webhook_events drop constraint if exists webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check
  check (provider in ('stripe','razorpay','twitch','discord','youtube','kick','dodo'));

-- ── platform: preserve twitch/youtube/kick/stripe/razorpay/discord, add dodo ──
-- (inline CHECK has the auto name webhook_events_platform_check)
alter table public.webhook_events drop constraint if exists webhook_events_platform_check;
alter table public.webhook_events add constraint webhook_events_platform_check
  check (platform in ('twitch','youtube','kick','stripe','razorpay','discord','dodo'));

comment on constraint webhook_events_provider_check on public.webhook_events is 'Idempotency discriminator incl. dodo (Dodo Payments V1 one-time checkout). Historical providers preserved.';
comment on constraint webhook_events_platform_check on public.webhook_events is 'Platform discriminator incl. dodo (Dodo Payments V1 webhook audit). Historical platforms preserved.';
