# 05 — Rate Limiting

## Mechanism

Durable Postgres table `player_bgmi_ownership_rate_events` + SECURITY DEFINER RPC `assert_bgmi_ownership_rate_limit`.

Not client-bypassable: enforcement is server-side before create/upload/submit/withdraw/signed-url.

## Limits (`BGMI_OWNERSHIP_RATE_LIMITS`)

| Event | Limit | Window |
|---|---|---|
| `create_case` | 5 | 3600s |
| `upload` | 10 | 900s |
| `submit` | 5 | 3600s |
| `withdraw` | 20 | 3600s |
| `signed_url` | 30 | 900s |

## Limitations (documented)

- Single-project / single-database counter — **not** a multi-region distributed limiter.
- Does not replace edge WAF / platform rate limits.
- Sufficient as minimum abuse brake before public UI (M2B.3C).
