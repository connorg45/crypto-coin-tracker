# Measurement methodology

## Evidence rules

Exactly two canonical run sets are retained: baseline `96466f3` and production candidate `b5c9a08`. Each raw Lighthouse report embeds its browser, Lighthouse version, throttling, viewport, timing, and audit details. Each run directory also contains a manifest with commands, environment, route, and limitations.

All current measurements are controlled local lab evidence. They must not be described as users, field data, traffic, uptime, or an SLA. Production synthetic results are added only after the canonical Cloudflare deployment exists. Market prices, coin counts, GitHub clones, visitors, and inferred users are excluded.

## Controlled baseline/final comparison

The baseline starts from an exact `git archive` of `96466f32612274994cdd1e3b9a89ec571b798f40`. `scripts/prepare-baseline-lab.mjs` copies that archive, replaces only the literal CoinGecko market URL with a same-origin fixture URL, and adds a deterministic 50-record provider-shaped response. This transparent instrumentation removes internet and price volatility without fixing legacy application behavior; the instrumented copy is evidence only and is never deployed. `/crypto.html` is measured because it was the inherited market experience; the old root was a marketing page.

The candidate is the Vite production build at `b5c9a08421f17cb2104a678d95a2007a23e092cc`, served at `/` with a deterministic 50-record normalized market envelope and fixed detail, chart, and sentiment fixtures. The asset count, values, and test host are fixed for the canonical pair. Because the provider and normalized contracts differ by design, these measurements compare rendered user experiences under the same data volume—not API parsing cost.

Each viewport uses five Lighthouse runs. The reported value is the median. Both mobile sets use 390×844 screen emulation, 150ms RTT, approximately 1.6Mbps throughput, and 4× CPU slowdown. Desktop uses the Lighthouse desktop preset. Raw reports are committed; HTML viewers are omitted to avoid duplicating report data.

`scripts/summarize-metrics.mjs` reads the raw reports and generates `docs/metrics/summary.json`. It computes the median performance score, accessibility score, LCP, CLS, and total blocking time, plus final-minus-baseline deltas.

The Web Vitals harness runs 20 scripted 390×844 Chromium journeys against deterministic fixtures with 150ms latency, 1.6Mbps down, 750Kbps up, and 4× CPU slowdown. It reports p75 LCP, INP, and CLS using `web-vitals`. This is a controlled application-interaction measurement and is kept separate from Lighthouse navigation LCP.

## Production synthetic metrics

These remain pending until deployment:

| Metric                       | Fixed method                                                                                                      | Target                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Cache-hit rate               | Warm one key, then send 50 serial same-region requests; `(HIT + STALE) / total` from `X-LCT-Cache`                | ≥90%                                                     |
| Third-party requests avoided | Compare proxy requests with structured upstream attempt logs for the identical key sequence                       | ≥80% after warm-up                                       |
| Response time                | 50 serial cold and 50 serial warm production samples; nearest-rank p50/p95, reported separately                   | Warm p95 <300ms; cold p95 <3s                            |
| Stale availability           | Seed each cache, force timeout/`429`/`5xx`, run 20 requests per case inside maximum age, then repeat after expiry | 100% inside maximum age; normalized failure after expiry |
| Error rate                   | `5xx / total` for fixed warm run and fault matrix                                                                 | 0% warm-run `5xx`; injected outcomes match policy        |
| Bundle                       | Gzip each Vite output and sum JavaScript/static bytes                                                             | JS ≤150KB; static ≤500KB                                 |
| Lighthouse                   | Five mobile and five desktop production runs; retain raw JSON and report medians                                  | Mobile performance ≥90; desktop ≥95; accessibility 100   |
| Accessibility                | axe across all routes plus the documented keyboard path                                                           | Zero serious/critical findings and manual pass           |

`scripts/measure-api.mjs` records status, cache header, duration, request ID, p50, p95, cache rate, and error rate as JSON. It deliberately does not assert market prices. `scripts/smoke-production.mjs` performs low-volume contract/status checks. Fault injection must use an isolated test deployment or mocked upstream—not production provider disruption.

## Reproduction

```bash
npm ci
npm test
npm run build
npm run lighthouse
npm run metrics:web-vitals -- --output=<run-dir>/web-vitals.json
npm run metrics:quality -- --output=<run-dir>/quality
node scripts/summarize-metrics.mjs \
  --baseline=<baseline-run-dir> \
  --final=<final-run-dir> \
  --output=docs/metrics/summary.json
```

New results do not overwrite the canonical pair silently. Changing source, browser, throttling, fixtures, routes, or formulas requires a methodology change and a new labeled run set.
