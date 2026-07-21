# Test, E2E, and CI matrix

| Layer                 | Required scenarios                                                                                                                                | Cadence and gate                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Pure unit             | Portfolio total, allocation, largest position, formatting, invalid/overflow inputs                                                                | Every PR; included in coverage               |
| Storage               | Valid/malformed state, invalid IDs and amounts, trimming, duplicates, V1→V2 migration, numeric-rank discard, idempotency, storage failure         | Every PR; included in coverage               |
| Schemas/contracts     | Valid fixtures; missing, null, wrong-type, extra, and malformed provider fields                                                                   | Every PR                                     |
| Cache                 | Fresh hit, miss/write, normalized key, expiry, maximum stale age, background refresh, concurrent dedupe, invalid cached payload                   | Every PR                                     |
| Retry/fallback        | Deadline, network failure, `429` with/without bounded `Retry-After`, retryable `5xx`, terminal `4xx`, invalid schema, stale success, cold failure | Every PR                                     |
| React components      | Loading, empty, error, stale, retry, watchlist, holding save/remove, retention dialog, migration notice, accessible names                         | Every PR                                     |
| Chromium E2E          | Market → Bitcoin detail → range → watchlist → holding → portfolio, reload persistence, isolated sentiment failure, total failure, malformed API   | Every PR                                     |
| Mobile E2E            | 390×844 menu, table-to-card layout, chart, holding editor, portfolio, no page-level horizontal overflow                                           | Every PR                                     |
| Keyboard/a11y         | Skip link, focus visibility, Enter/Space controls, `aria-pressed`, live announcements, route axe scans                                            | Every PR; zero serious/critical axe findings |
| Cross-browser         | Full Firefox and WebKit workflow                                                                                                                  | Push to `develop` and nightly                |
| Live contract smoke   | Low-volume normalized production calls; no price assertions                                                                                       | Weekly after deployment                      |
| Lighthouse/Web Vitals | Five runs per viewport plus controlled 20-flow interaction harness                                                                                | Candidate/develop gate; raw JSON retained    |
| Supply chain          | High-severity npm audit, Dependabot, CodeQL JS/TS                                                                                                 | PR plus weekly                               |

Coverage gates are 90% statements, lines, and functions and 85% branches globally. Thin Cloudflare route adapters, the React entry point, and generated type declarations are excluded; their underlying handler, validation, cache, retry, and upstream modules remain included.

Production deploy runs only on `develop` after quality, Chromium, cross-browser, and Lighthouse jobs succeed. Actions are pinned to immutable SHAs. Preview deployments must not receive the production provider secret.
