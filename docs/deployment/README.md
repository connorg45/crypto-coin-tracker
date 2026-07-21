# Cloudflare Pages deployment runbook

Canonical project name: `lizard-coin-tracker`. If unavailable, use `connor-lizard-coin-tracker` and update the repository homepage and measurement manifests. The production branch is `develop`; the root `pages.dev` URL is canonical.

## 1. One-time account authorization

Run locally in an interactive browser session:

```bash
npx wrangler login
npx wrangler whoami
```

The automated execution environment could not open Cloudflare's OAuth page because of enterprise browser policy. No workaround or alternate credential path was used.

Create the Pages project if it does not exist:

```bash
npx wrangler pages project create lizard-coin-tracker --production-branch develop
```

## 2. Deploy and verify the exact legacy revision

The signed tag `legacy-baseline-2026-03-26` points to `96466f32612274994cdd1e3b9a89ec571b798f40`. Rebuild the direct-upload directory and committed hash manifest from Git—not the working tree:

```bash
npm run baseline:prepare -- --manifest=docs/deployment/legacy-baseline-manifest.json
npm run deploy:legacy
```

Record the deployment URL returned by Wrangler, then verify every shipped HTML and asset byte against the archive:

```bash
npm run baseline:verify -- \
  --url=https://<legacy-deployment>.pages.dev \
  --output=docs/deployment/legacy-deployment-verification.json
```

Do not mark P0 complete unless `/`, `/coin.html`, `/crypto.html`, `/learnmore.html`, `/portfolio.html`, and `/watchlist.html` all return 200 and the verifier reports `passed: true`.

## 3. Configure the provider secret

Create a CoinGecko Demo key, then store it in the Pages environment. Never put it in a `VITE_*` variable, GitHub log, committed file, screenshot, or error payload.

```bash
npx wrangler pages secret put COINGECKO_DEMO_API_KEY \
  --project-name lizard-coin-tracker
```

For GitHub Actions, add `CLOUDFLARE_API_TOKEN` with the minimum Pages deployment permission and `CLOUDFLARE_ACCOUNT_ID` as repository environment secrets. The CoinGecko key remains a Cloudflare Pages secret; CI does not need it.

## 4. Deploy the production candidate

After the required checks pass on `develop`:

```bash
npm run build
npx wrangler pages deploy dist \
  --project-name lizard-coin-tracker \
  --branch develop \
  --commit-hash "$(git rev-parse HEAD)"
```

Set `https://lizard-coin-tracker.pages.dev` as the GitHub repository homepage only after it returns the dashboard and all API checks pass.

## 5. Production verification

```bash
npm run smoke:production -- https://lizard-coin-tracker.pages.dev
npm run metrics:api -- https://lizard-coin-tracker.pages.dev <run-directory>
```

Verify manually and retain raw output:

- Root and client-side routes return the checked revision.
- `/api/markets`, coin detail, chart, and sentiment conform to shared schemas.
- The API key is absent from JavaScript, source maps, response bodies, response headers, and logs.
- CSP, `nosniff`, frame denial, referrer policy, permissions policy, COOP, and CORP are present.
- One cold request returns `MISS`; the documented warm sequence produces `HIT`; seeded provider failure produces `STALE` only within maximum age.
- `X-Request-ID`, `X-LCT-Cache`, and `Server-Timing` are present.
- Current production screenshots and the 12–20 second GIF replace controlled fixture media before calling the demo final.

## 6. Repository protection

Require the quality, browser, cross-browser, and Lighthouse jobs before `develop` can deploy. Keep the production environment approval rule enabled. Preview deployments must not share production secrets. Confirm the Actions referenced in the workflows remain pinned to immutable SHAs.

## Signing handoff

The dedicated signing public key fingerprint is `SHA256:EBcfJMxL6plwfhrTjZxVoiFU1yi9DYgpJIqOoTTyeD4`. Local tag and commit verification passes. GitHub will show the signature as verified only after Connor adds the public key as a **signing key** in account settings or refreshes `gh` with `admin:ssh_signing_key` and uploads it. The enterprise browser policy also blocked that account authorization; the private key must never be uploaded.
