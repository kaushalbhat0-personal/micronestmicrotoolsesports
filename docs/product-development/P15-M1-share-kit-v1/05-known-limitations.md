# 05 — Known Limitations

1. **Browser PNG pack exists** under `evidence/` (P15-M1-V) — recruiting-disabled / complete-roster / unicode stress PNGs remain optional follow-ups.
2. **Avatar images are not painted onto the PNG** — public `avatar_url` is available to the page but canvas cards use text/mark only (avoids CORS/tainted-canvas complexity). Future enhancement if CORS-safe.
3. **Bio omitted from player PNG** by design (keep card scannable; profile URL is the CTA).
4. **D1 WorkingTeam CSV helper unused** — tools roster uses its own CSV builder (correct model).
5. **No server share links / QR / referral analytics** — deferred per M1 boundaries.
6. **No additional export sizes** (stories/landscape) — single 1080² default.
7. **Font warm-up is best-effort** — falls back to system condensed/sans if webfonts are slow.
8. **Production Auth dashboard certification** remains an open P14-D14 ops item (unrelated to Share Kit code).

## Next recommended milestones (not implemented)

- P15-M2 profile completeness (availability capture, game edit, avatar UI).
- Client presets / localStorage for tools.
- Recruitment open-slot schema only after security authorization.
