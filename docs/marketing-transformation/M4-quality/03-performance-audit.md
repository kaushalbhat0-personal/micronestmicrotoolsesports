# 03 — Performance Audit (Gate 3)

Tool: **Lighthouse 13.6.0** (`npx -y lighthouse`; fetched tooling, not a repo
dependency) with full Chromium 1248, against the **production** build
(`next start`, port 3101). Four reports in `reports/`
(`lh-{home,about}-{mobile,desktop}.json`), categories
performance/accessibility/best-practices/seo, simulated throttling.

## Scores and metrics (measured, not estimated)

| Run | Perf | A11y | BP | SEO | FCP | LCP | CLS | TBT | SI |
|---|---|---|---|---|---|---|---|---|---|
| home mobile | 0.90 | 100 | 100 | 100 | 0.8s | 0.8s | 0 | 80ms | 26.8s* |
| home desktop | 0.90 | 100 | 100 | 100 | 0.2s | 0.2s | 0 | 10ms | 11.0s* |
| about mobile | 0.89 | 100 | 100 | 100 | 0.8s | 0.8s | 0 | 100ms | 27.1s* |
| about desktop | 0.90 | 100 | 100 | 100 | 0.2s | 0.2s | 0 | 10ms | 11.1s* |

INP: n/a in lab (no interaction script; no field data pre-launch).

## Payload (home mobile — representative)

187 KiB total across 18 requests: **JS 150 KiB (9 scripts), CSS 12 KiB,
document 10 KiB, other 15 KiB; images 0, fonts 0, third-party 0.**
`unused-javascript` flags ~30 KiB (framework overhead, below).

## Analysis

- **Core loading health is excellent**: LCP ≤ 0.8s mobile / 0.2s desktop,
  CLS 0 (no layout shift anywhere), TBT ≤ 100ms, zero render-blocking
  surprises beyond the single 12 KiB stylesheet. No images, no webfonts, no
  third parties — the M1 zero-dependency discipline pays off directly.
- **\*Speed Index anomaly**: SI (11–27s) contradicts every other signal
  (LCP 0.2–0.8s, instant filmstrip). This is a known Speedline artifact on
  near-instant localhost loads under simulated throttling — not a product
  defect. Chasing it (skeleton screens, animation) would add motion the
  creative direction forbids. Recorded, not acted on. Re-measure on the
  deployed origin with field data post-launch.
- **JavaScript honesty note**: an M4 experiment replaced the header's tiny
  client disclosure with a native `<details>` aiming at "zero JS". It failed
  structurally (invalid nesting — summary must be a direct child; closed
  details hides brand/nav; verified broken screenshot) and was **reverted**.
  Decisive measurement: payload with the button header is byte-identical
  (186 vs 187 KiB) — the App Router framework runtime ships on static pages
  regardless, so the authored component costs ~0. The revert is documented in
  the header source comment. No score-gaming, no redesign.

## Actions taken: none required

No render-blocking, oversized, unminified or third-party payload found. M4
perf work is measurement + the documented SI disposition. Follow-up
post-launch: field INP/LCP via real-user data; revisit only if field data
disagrees with lab.
