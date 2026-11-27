# 06 — Security Test Evidence

## Commands run (actual)

| Command | Result |
|---|---|
| `npx vitest run …/bgmi-ownership-sanitize.test.ts …/bgmi-ownership-lifecycle.test.ts` | **17 passed** |
| `npm run test` (unit lane) | **114 files / 1074 tests passed** |
| `npm run typecheck` | **pass** |
| `npm run lint` | **pass** (0 errors) |
| `npm run build` | **pass** |

## Coverage mapping

| Area | Coverage |
|---|---|
| Valid JPEG/PNG/WebP | sanitize unit tests |
| PDF / SVG / GIF reject | sanitize unit tests |
| Spoofed magic / corrupt PNG | sanitize unit tests |
| Oversized / tiny dims | sanitize unit tests |
| Path server-built | paths unit test |
| Missing BGMI ID | lifecycle mock |
| Max 2 / pending no-replace | lifecycle mock |
| DB insert fail → storage cleanup | lifecycle mock |
| Submit via RPC only | lifecycle mock |
| Withdraw idempotent | lifecycle mock |
| Signed URL 60s / no public URL | lifecycle mock |
| Public projection / share freeze | privacy asserts |

## Not claimed as executed here

- Live multi-user Storage RLS integration against hosted project with two JWTs (unit/mocked + SQL policy verification used instead).
- Embedded-postgres integration harness for ownership tables (not added this milestone).
