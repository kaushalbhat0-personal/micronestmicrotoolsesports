# MicroNest — Esports Micro-SaaS Platform

Multi-tenant platform hosting independent microtools for esports organizations.

> Build narrow, independently valuable microtools instead of a monolithic esports management platform.

## Stack

- Next.js 15 (App Router) + TypeScript (strict)
- Tailwind CSS 4 + Lucide React
- Supabase (PostgreSQL + Auth via @supabase/ssr)
- Zod validation
- Vercel + Vercel Cron
- Stripe / Razorpay (provider-agnostic billing boundary)
- Twitch Helix + Discord Webhooks (integration boundaries)

## Quick start

```bash
cp .env.example .env.local   # fill values
npm install
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

See `.env.example` for full list. `CRON_SECRET` required for `/api/cron/*`.

## Supabase local

```bash
npx supabase start
npx supabase db reset   # applies migrations + seed
npm run db:types        # regenerate src/types/database.ts
```

## Project structure

See `ARCHITECTURE.md` for full architecture, folder rationale, and how to add a new microtool.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
- `npm run test` — vitest

## Security baseline

- RLS on every tenant table
- Secure httpOnly cookies (no localStorage tokens)
- Service-role only in server contexts
- Zod validation on all external input
- Cron auth via Bearer `CRON_SECRET`
- Webhook signature + idempotency via `webhook_events`
