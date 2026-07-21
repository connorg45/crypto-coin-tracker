# Architecture and contracts

## Why React and TypeScript

The migration addresses concrete maintainability problems: six duplicated documents, shared global scripts, intertwined DOM/data/storage logic, and routes that need consistent loading and failure behavior. React supplies shared route-level UI and state composition; strict TypeScript plus Zod separates compile-time assumptions from runtime provider validation. The migration preserves the existing market → detail → watchlist → portfolio workflow and lightweight SVG chart rather than introducing a new product.

Vite is the build boundary. React Router maps the four routes. TanStack Query handles browser request deduplication and explicit status transitions. CSS and icons are local. There is no design system or chart dependency.

## Same-origin API

| Endpoint                                     | Normalized response                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /api/markets`                           | At most 50 `MarketCoin` records containing only displayed fields and a seven-day sparkline |
| `GET /api/coins/:id`                         | Validated `CoinDetail` with plain-text description                                         |
| `GET /api/coins/:id/chart?range=7d\|30d\|1y` | At most 2,000 `{ timestampMs, priceUsd }` points                                           |
| `GET /api/sentiment`                         | Current, nearest-30-day, and nearest-365-day sentiment snapshots                           |

Every success has this shape:

```ts
type ApiEnvelope<T> = {
  data: T;
  meta: {
    freshness: "fresh" | "stale";
    source: "upstream" | "edge-cache";
    fetchedAt: string;
    ageSeconds: number;
    requestId: string;
  };
};
```

Errors contain one of `INVALID_REQUEST`, `NOT_FOUND`, `UPSTREAM_RATE_LIMITED`, `UPSTREAM_TIMEOUT`, `UPSTREAM_SCHEMA_INVALID`, or `UPSTREAM_UNAVAILABLE`, plus a safe message, retryable flag, and request ID.

Coin IDs must match a constrained lowercase slug. Chart ranges are an enum. No route accepts an arbitrary provider URL. Provider image URLs must use HTTPS and a CoinGecko image hostname; other values become a local placeholder. The CoinGecko demo key is read only from the Pages Function environment.

## Persistence

The single browser key is `lct:state`:

```ts
type AppStateV2 = {
  version: 2;
  watchlist: string[];
  holdings: Record<string, number>;
};
```

On first load, valid `watchListCoinIds` and `portfolioHoldings` values are trimmed, normalized, deduplicated, bounded, migrated, and removed. Numeric `watchListArr` ranks are discarded with a one-time notice because an old market rank cannot be mapped reliably to coin identity. Re-running migration is idempotent. Removing a watched coin with a holding asks whether to retain or delete the holding and defaults to retaining it.

The upper holding bound is 1,000,000,000,000 units. Holdings are intentionally non-secret and local. Authentication, a database, wallets, and sync would add an identity/security model without improving the coherent portfolio story, so they are non-goals.

## Tradeoffs

- Pages Functions are enough for a small read-only proxy; a separate server or microservice would add operational surface without useful evidence.
- Cloudflare Cache API is regional and may evict records. The UI and documentation never describe it as globally durable.
- The custom SVG chart keeps the bundle and accessibility model small, at the cost of advanced chart interactions.
- Top-50 data means a saved holding can be temporarily unpriced. The UI reports the omitted count rather than silently valuing it at zero.
- Provider descriptions are reduced to plain text. Rich formatting is sacrificed to keep a narrow XSS boundary.
