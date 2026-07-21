import type { Page, Route } from "@playwright/test";

const meta = {
  freshness: "fresh",
  source: "upstream",
  fetchedAt: "2026-07-20T12:00:00.000Z",
  ageSeconds: 0,
  requestId: "e2e",
};

export const coins = [
  {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    image: null,
    currentPrice: 64000,
    marketCap: 1260000000000,
    marketCapRank: 1,
    change24h: 2.4,
    change7d: -1.2,
    sparkline7d: [62000, 63000, 61500, 64000],
  },
  {
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    image: null,
    currentPrice: 3200,
    marketCap: 390000000000,
    marketCapRank: 2,
    change24h: -0.8,
    change7d: 4.1,
    sparkline7d: [3000, 3050, 3180, 3200],
  },
];

const detail = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  image: null,
  currentPrice: 64000,
  marketCap: 1260000000000,
  marketCapRank: 1,
  change24h: 2.4,
  allTimeHigh: 73000,
  description: "Bitcoin is a peer-to-peer asset.",
};
const chart = [
  { timestampMs: 1720000000000, priceUsd: 60000 },
  { timestampMs: 1720086400000, priceUsd: 62000 },
  { timestampMs: 1720172800000, priceUsd: 64000 },
];
const sentiment = {
  current: {
    value: 57,
    classification: "Greed",
    timestamp: "2026-07-20T00:00:00.000Z",
  },
  thirtyDaysAgo: {
    value: 42,
    classification: "Fear",
    timestamp: "2026-06-20T00:00:00.000Z",
  },
  oneYearAgo: {
    value: 51,
    classification: "Neutral",
    timestamp: "2025-07-20T00:00:00.000Z",
  },
};

const fulfill = (route: Route, data: unknown, responseMeta = meta) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data, meta: responseMeta }),
  });

export async function mockApi(page: Page) {
  await page.route("**/api/markets", (route) => fulfill(route, coins));
  await page.route("**/api/sentiment", (route) => fulfill(route, sentiment));
  await page.route("**/api/coins/*/chart?*", (route) => fulfill(route, chart));
  await page.route("**/api/coins/*", (route) => fulfill(route, detail));
}

export async function mockStaleMarkets(page: Page) {
  await page.route("**/api/markets", (route) =>
    fulfill(route, coins, {
      ...meta,
      freshness: "stale",
      source: "edge-cache",
      ageSeconds: 300,
    }),
  );
}

export const errorBody = (message = "Provider unavailable.") => ({
  error: {
    code: "UPSTREAM_UNAVAILABLE",
    message,
    retryable: true,
    requestId: "e2e-error",
  },
});
