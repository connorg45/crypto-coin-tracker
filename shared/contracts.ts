import { z } from "zod";

export const coinIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CoinIdSchema = z.string().min(1).max(100).regex(coinIdPattern);

export const FreshnessMetaSchema = z
  .object({
    freshness: z.enum(["fresh", "stale"]),
    source: z.enum(["upstream", "edge-cache"]),
    fetchedAt: z.iso.datetime(),
    ageSeconds: z.number().int().nonnegative(),
    requestId: z.string().min(1).max(100),
  })
  .strict();

export const MarketCoinSchema = z
  .object({
    id: CoinIdSchema,
    symbol: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    image: z.url().nullable(),
    currentPrice: z.number().nonnegative(),
    marketCap: z.number().nonnegative(),
    marketCapRank: z.number().int().positive().nullable(),
    change24h: z.number().nullable(),
    change7d: z.number().nullable(),
    sparkline7d: z.array(z.number().nonnegative()).max(500),
  })
  .strict();

export const CoinDetailSchema = z
  .object({
    id: CoinIdSchema,
    symbol: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    image: z.url().nullable(),
    currentPrice: z.number().nonnegative(),
    marketCap: z.number().nonnegative(),
    marketCapRank: z.number().int().positive().nullable(),
    change24h: z.number().nullable(),
    allTimeHigh: z.number().nonnegative(),
    description: z.string().max(8_000),
  })
  .strict();

export const ChartPointSchema = z
  .object({
    timestampMs: z.number().int().nonnegative(),
    priceUsd: z.number().nonnegative(),
  })
  .strict();

export const ChartRangeSchema = z.enum(["7d", "30d", "1y"]);

export const SentimentSnapshotSchema = z
  .object({
    value: z.number().int().min(0).max(100),
    classification: z.string().min(1).max(40),
    timestamp: z.iso.datetime(),
  })
  .strict();

export const SentimentDataSchema = z
  .object({
    current: SentimentSnapshotSchema,
    thirtyDaysAgo: SentimentSnapshotSchema,
    oneYearAgo: SentimentSnapshotSchema,
  })
  .strict();

export const ApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "NOT_FOUND",
  "UPSTREAM_RATE_LIMITED",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_SCHEMA_INVALID",
  "UPSTREAM_UNAVAILABLE",
]);

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().min(1).max(240),
        retryable: z.boolean(),
        requestId: z.string().min(1).max(100),
      })
      .strict(),
  })
  .strict();

export function apiEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z
    .object({
      data,
      meta: FreshnessMetaSchema,
    })
    .strict();
}

export const MarketsEnvelopeSchema = apiEnvelopeSchema(
  z.array(MarketCoinSchema).max(50),
);
export const CoinDetailEnvelopeSchema = apiEnvelopeSchema(CoinDetailSchema);
export const ChartEnvelopeSchema = apiEnvelopeSchema(
  z.array(ChartPointSchema).max(2_000),
);
export const SentimentEnvelopeSchema = apiEnvelopeSchema(SentimentDataSchema);

export type MarketCoin = z.infer<typeof MarketCoinSchema>;
export type CoinDetail = z.infer<typeof CoinDetailSchema>;
export type ChartPoint = z.infer<typeof ChartPointSchema>;
export type ChartRange = z.infer<typeof ChartRangeSchema>;
export type SentimentData = z.infer<typeof SentimentDataSchema>;
export type FreshnessMeta = z.infer<typeof FreshnessMetaSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiEnvelope<T> = { data: T; meta: FreshnessMeta };
