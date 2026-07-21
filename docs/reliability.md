# Reliability behavior

## Cache states

Pages Functions validate cached payloads using the same internal Zod schemas as fresh responses. Fresh records return synchronously as `HIT`. Records beyond the fresh TTL but within maximum age return as `STALE`, trigger one in-isolate deduplicated background refresh through `waitUntil`, and expose their age to the browser. Records older than maximum age are unusable and force an upstream request.

Cache keys are fixed, normalized internal URLs and never include arbitrary client input. Cache-Control keeps each record available only through its maximum stale age.

## Upstream failures

The request budget is eight seconds total and three attempts maximum. Full-jitter ceilings are 250ms after attempt one and 750ms after attempt two. A numeric `Retry-After` is accepted only from zero through two seconds. Retryable statuses are `408`, `425`, `429`, `500`, `502`, `503`, and `504`; schema failures, `404`, and other client errors are terminal.

A usable stale record is returned before revalidation. Without a usable record, the API returns the normalized error envelope and the UI shows a retry control. Independent panels fail independently, so sentiment can fail without removing the market table.

## Observability

Each API response exposes `X-LCT-Cache`, `X-Request-ID`, and `Server-Timing`. Structured logs contain route, outcome, cache status, age, duration, attempt count, safe error code, and numeric upstream status. They exclude request/response bodies, secrets, headers, holdings, and storage.

The fixed production harness samples cache status, third-party calls, p50/p95, and error rate only after deployment. Local fixture tests prove state transitions but are not production measurements.
