# 01 — Credential and Project Verification (P14-D4B)

## Credential discovery (names only; values never logged)

| Source | Name | Present | Role |
| --- | --- | --- | --- |
| Process env | `SUPABASE_PROJECT_REF` | Yes | **Mismatch risk** — was `flhllvzzbtkfrcrajicq` (LMS). Overridden for all ops to Esports. |
| Process env | `SUPABASE_ACCESS_TOKEN` | Via `.env` load | Management API + CLI login role |
| `.env` | `SUPABASE_ACCESS_TOKEN` | Yes | Management / CLI |
| `.env` | `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Yes | Host resolves to Esports |
| `.env` | `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | PostgREST anon (not used for DDL) |
| `.env` | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin API (not used for DDL) |
| `.env` | `SUPABASE_DB_PASSWORD` / `DATABASE_URL` | **No** | Not required — CLI used Access Token + linked project login role |
| `supabase/.temp/project-ref` | — | `knniommcyyhbyiwljisk` | Linked project |

**Distinction:** Access Token = management/CLI. Anon/service-role keys ≠ DDL. DDL executed via `supabase db push --linked` after Access Token auth.

## Project identity (Management API + link)

| Check | Expected | Observed |
| --- | --- | --- |
| Ref | `knniommcyyhbyiwljisk` | `knniommcyyhbyiwljisk` |
| Name | `micronestmicrotoolsesports` | `micronestmicrotoolsesports` |
| Region | `ap-northeast-1` | `ap-northeast-1` |
| Status | healthy | `ACTIVE_HEALTHY` |
| PG | 17.x | `17.6.1.171` |
| URL host | Esports | `knniommcyyhbyiwljisk.supabase.co` |
| Project list under token | Esports only | Single project `knniommcyyhbyiwljisk` |

**LMS never accessed.** Process env LMS ref was detected and explicitly overridden; all API/CLI calls used `knniommcyyhbyiwljisk`.

## CLI

- `npx supabase --version` → `2.109.1`
- Linked workflow used throughout (`--linked`)
