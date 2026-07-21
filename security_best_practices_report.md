# Security best-practices review

Review date: 2026-07-20. Scope: React/TypeScript browser code, Cloudflare Pages Functions, local persistence, third-party providers, headers, dependencies, and CI. The final reviewed state has no open CodeQL alert, known high-severity dependency vulnerability, or exposed client secret.

## Resolved legacy findings

| Rule                       |                  Severity | Evidence                                                                                     | Impact and remediation                                                                                                                                                                                     | Status                                            |
| -------------------------- | ------------------------: | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| JS-CSP-001                 |                    Medium | `functions/_middleware.ts:3-20`; `public/_headers:1-8`                                       | Static and function responses receive a strict same-origin CSP, frame denial, `nosniff`, no-referrer, permissions restrictions, COOP, and CORP. Production headers still require post-deploy verification. | Resolved in code; production verification pending |
| JS-SUPPLY-001 / JS-SRI-001 |                Low–Medium | `package.json`; `package-lock.json`; `index.html`                                            | jQuery, Bootstrap alpha, Font Awesome, Google Fonts, and all CDN scripts/styles were removed. Runtime dependencies are pinned and bundled; CI runs high-severity audit, Dependabot, and CodeQL.            | Resolved                                          |
| JS-XSS-001                 | Medium; no proven exploit | `functions/_lib/upstream.ts:95-106`; `src/pages/CoinDetailPage.tsx`                          | Provider descriptions are stripped and bounded server-side, validated, then rendered by React as text. SVG paths are built from validated numbers rather than HTML strings.                                | Resolved                                          |
| JS-ENCODING-001            |                      High | `functions/_lib/upstream.ts:95-106`; `tests/functions/upstream.test.ts`                      | CodeQL identified potential double-unescaping because `&amp;` was decoded before other entities. Ampersands are now decoded last, so nested entities remain encoded after the single normalization pass.   | Resolved; regression tested                       |
| JS-URL-002                 |                       Low | `functions/_lib/upstream.ts:83-93`; `src/lib/images.ts:1-15`; `src/components/AppLayout.tsx` | Image URLs require HTTPS and an allowlisted CoinGecko host; all others use a local placeholder. External tabs use `noopener noreferrer`.                                                                   | Resolved                                          |
| JS-STORAGE-001             |                       Low | `src/domain/storage.ts:4-20`, `48-99`, `110-150`                                             | One strict versioned schema normalizes IDs, deduplicates, bounds values, migrates once, handles unavailable storage, and exposes a clear-state control.                                                    | Resolved                                          |
| JS-SECRET-001              |          High if violated | `functions/_lib/upstream.ts:109-116`; `.dev.vars.example`; `.gitignore`                      | The CoinGecko key is read only in Pages Functions. No `VITE_*` secret, committed key, or client key was found. The production secret must be created directly in Cloudflare.                               | Resolved in code; secret setup pending            |

## Residual risks

### SEC-OPS-001 — Provider quota and availability

- Severity: Medium operational risk.
- Evidence: `functions/_lib/retry.ts:3-25`, `56-132`; `functions/_lib/cache.ts:95-148`.
- Impact: CoinGecko or Alternative.me can rate-limit, change schemas, or fail. Regional cache eviction can remove the stale safety net.
- Mitigation: bounded retry/deadline behavior, schema validation, maximum stale windows, visible fallback/error states, and provider-swappable same-origin contracts. Monitor production status and quota after deployment.

### SEC-CACHE-001 — Regional best-effort cache

- Severity: Low.
- Evidence: cache records use fixed internal keys and maximum-age controls in `functions/_lib/cache.ts:24-65`.
- Impact: a cold region or eviction can increase provider traffic and reduce stale availability; this is not a confidentiality boundary or durability layer.
- Mitigation: describe availability conditionally, measure per region, and never present it as an SLA.

### SEC-CLIENT-001 — Attacker-controlled local browser state

- Severity: Low.
- Evidence: `src/domain/storage.ts:38-99`.
- Impact: users or extensions can alter their own local hypothetical holdings. This cannot affect another account because accounts do not exist, but unsanitized values could cause misleading calculations or UI instability.
- Mitigation: load and save through the same sanitizer; accept only constrained IDs and finite positive bounded values. Holdings are never sent to the server or logs.

### SEC-DEPLOY-001 — Account configuration not yet verified

- Severity: Medium until deployment.
- Evidence: repository contains header/deploy configuration, but the canonical Cloudflare project was not accessible from this environment.
- Impact: an incorrectly configured project could omit secrets or headers, allow an unreviewed deploy, or leave the demo unavailable.
- Mitigation: follow `docs/deployment/README.md`, require CI and the production environment, use a least-privilege token, verify headers and bundles on the live revision, and do not claim production status before the runbook passes.

## Non-goals and data sensitivity

There is no authentication, wallet, transaction, payment, database, or server-side portfolio. Watchlists and holdings are non-secret, browser-local hypothetical data. Adding identity or wallet features would materially expand the threat model and is explicitly outside this rescue.
