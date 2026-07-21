import { z } from "zod";

const baseUrl = process.argv[2] ?? process.env.LCT_PRODUCTION_URL;
if (!baseUrl || !/^https:\/\//.test(baseUrl))
  throw new Error("Provide the production HTTPS URL.");

const coinId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const meta = z
  .object({
    freshness: z.enum(["fresh", "stale"]),
    source: z.enum(["upstream", "edge-cache"]),
    fetchedAt: z.iso.datetime(),
    ageSeconds: z.number().int().nonnegative(),
    requestId: z.string().min(1),
  })
  .strict();
const marketCoin = z
  .object({
    id: coinId,
    symbol: z.string().min(1),
    name: z.string().min(1),
    image: z.url().nullable(),
    currentPrice: z.number().nonnegative(),
    marketCap: z.number().nonnegative(),
    marketCapRank: z.number().int().positive().nullable(),
    change24h: z.number().nullable(),
    change7d: z.number().nullable(),
    sparkline7d: z.array(z.number().nonnegative()).max(500),
  })
  .strict();
const coinDetail = z
  .object({
    id: coinId,
    symbol: z.string().min(1),
    name: z.string().min(1),
    image: z.url().nullable(),
    currentPrice: z.number().nonnegative(),
    marketCap: z.number().nonnegative(),
    marketCapRank: z.number().int().positive().nullable(),
    change24h: z.number().nullable(),
    allTimeHigh: z.number().nonnegative(),
    description: z.string().max(8_000),
  })
  .strict();
const chartPoint = z
  .object({
    timestampMs: z.number().int().nonnegative(),
    priceUsd: z.number().nonnegative(),
  })
  .strict();
const sentimentSnapshot = z
  .object({
    value: z.number().int().min(0).max(100),
    classification: z.string().min(1),
    timestamp: z.iso.datetime(),
  })
  .strict();
const envelope = (data) => z.object({ data, meta }).strict();
const routes = [
  { path: "/api/markets", schema: envelope(z.array(marketCoin).max(50)) },
  { path: "/api/coins/bitcoin", schema: envelope(coinDetail) },
  {
    path: "/api/coins/bitcoin/chart?range=7d",
    schema: envelope(z.array(chartPoint).max(2_000)),
  },
  {
    path: "/api/sentiment",
    schema: envelope(
      z
        .object({
          current: sentimentSnapshot,
          thirtyDaysAgo: sentimentSnapshot,
          oneYearAgo: sentimentSnapshot,
        })
        .strict(),
    ),
  },
];

for (const route of routes) {
  const response = await fetch(new URL(route.path, baseUrl), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`${route.path} returned ${response.status}`);
  const parsed = route.schema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error(`${route.path} did not match its normalized schema.`);
  const cacheStatus = response.headers.get("x-lct-cache");
  const requestId = response.headers.get("x-request-id");
  if (!cacheStatus || !["HIT", "MISS", "STALE"].includes(cacheStatus))
    throw new Error(`${route.path} omitted a valid X-LCT-Cache header.`);
  if (!requestId)
    throw new Error(`${route.path} omitted its X-Request-ID header.`);
  console.log(
    JSON.stringify({
      route: route.path,
      status: response.status,
      freshness: parsed.data.meta.freshness,
      cacheStatus,
      requestId,
    }),
  );
}
