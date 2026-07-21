import {
  ChartPointSchema,
  CoinDetailSchema,
  MarketCoinSchema,
  SentimentDataSchema,
  type ChartPoint,
  type CoinDetail,
  type MarketCoin,
  type SentimentData,
} from "../../shared/contracts";
import { z } from "zod";
import { ServiceError } from "./errors";
import { fetchWithRetry, type RetryDependencies } from "./retry";
import type { Env, UpstreamResult } from "./types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const COIN_IMAGE_HOSTS = new Set([
  "assets.coingecko.com",
  "coin-images.coingecko.com",
]);

const MarketUpstreamSchema = z
  .array(
    z
      .object({
        id: z.string(),
        symbol: z.string(),
        name: z.string(),
        image: z.string().nullable(),
        current_price: z.number(),
        market_cap: z.number(),
        market_cap_rank: z.number().int().nullable(),
        price_change_percentage_24h: z.number().nullable(),
        price_change_percentage_7d_in_currency: z
          .number()
          .nullable()
          .optional(),
        sparkline_in_7d: z.object({ price: z.array(z.number()) }),
      })
      .passthrough(),
  )
  .max(50);

const CoinUpstreamSchema = z
  .object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    image: z.object({
      large: z.string().nullable(),
      small: z.string().nullable(),
    }),
    market_cap_rank: z.number().int().nullable(),
    market_data: z.object({
      current_price: z.object({ usd: z.number() }),
      market_cap: z.object({ usd: z.number() }),
      price_change_percentage_24h: z.number().nullable(),
      ath: z.object({ usd: z.number() }),
    }),
    description: z.object({ en: z.string() }),
  })
  .passthrough();

const ChartUpstreamSchema = z
  .object({ prices: z.array(z.tuple([z.number(), z.number()])).max(2_000) })
  .passthrough();
const SentimentUpstreamSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            value: z.string(),
            value_classification: z.string(),
            timestamp: z.string(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

function allowedImage(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && COIN_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function providerText(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, " ");
  return withoutTags
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8_000);
}

function coingeckoHeaders(env: Env): HeadersInit {
  return env.COINGECKO_DEMO_API_KEY
    ? {
        Accept: "application/json",
        "x-cg-demo-api-key": env.COINGECKO_DEMO_API_KEY,
      }
    : { Accept: "application/json" };
}

async function validatedJson<T>(
  url: string,
  schema: z.ZodType<T>,
  headers: HeadersInit,
  dependencies?: RetryDependencies,
): Promise<UpstreamResult<T>> {
  const result = await fetchWithRetry(url, { headers }, dependencies);
  const body = await result.response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ServiceError(
      "UPSTREAM_SCHEMA_INVALID",
      "The market-data provider returned an unexpected response.",
      false,
      502,
    );
  }
  return {
    data: parsed.data,
    attempts: result.attempts,
    durationMs: result.durationMs,
  };
}

export async function loadMarkets(
  env: Env,
  dependencies?: RetryDependencies,
): Promise<UpstreamResult<MarketCoin[]>> {
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d&locale=en`;
  const upstream = await validatedJson(
    url,
    MarketUpstreamSchema,
    coingeckoHeaders(env),
    dependencies,
  );
  const normalized = upstream.data.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: allowedImage(coin.image),
    currentPrice: coin.current_price,
    marketCap: coin.market_cap,
    marketCapRank: coin.market_cap_rank,
    change24h: coin.price_change_percentage_24h,
    change7d: coin.price_change_percentage_7d_in_currency ?? null,
    sparkline7d: coin.sparkline_in_7d.price,
  }));
  const parsed = z.array(MarketCoinSchema).max(50).safeParse(normalized);
  if (!parsed.success)
    throw new ServiceError(
      "UPSTREAM_SCHEMA_INVALID",
      "Market records failed validation.",
      false,
      502,
    );
  return { ...upstream, data: parsed.data };
}

export async function loadCoin(
  env: Env,
  coinId: string,
  dependencies?: RetryDependencies,
): Promise<UpstreamResult<CoinDetail>> {
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  const upstream = await validatedJson(
    url,
    CoinUpstreamSchema,
    coingeckoHeaders(env),
    dependencies,
  );
  const coin = upstream.data;
  const normalized = {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: allowedImage(coin.image.large ?? coin.image.small),
    currentPrice: coin.market_data.current_price.usd,
    marketCap: coin.market_data.market_cap.usd,
    marketCapRank: coin.market_cap_rank,
    change24h: coin.market_data.price_change_percentage_24h,
    allTimeHigh: coin.market_data.ath.usd,
    description: providerText(coin.description.en),
  };
  const parsed = CoinDetailSchema.safeParse(normalized);
  if (!parsed.success)
    throw new ServiceError(
      "UPSTREAM_SCHEMA_INVALID",
      "Coin detail failed validation.",
      false,
      502,
    );
  return { ...upstream, data: parsed.data };
}

export async function loadChart(
  env: Env,
  coinId: string,
  days: string,
  dependencies?: RetryDependencies,
): Promise<UpstreamResult<ChartPoint[]>> {
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const upstream = await validatedJson(
    url,
    ChartUpstreamSchema,
    coingeckoHeaders(env),
    dependencies,
  );
  const normalized = upstream.data.prices.map(([timestampMs, priceUsd]) => ({
    timestampMs: Math.round(timestampMs),
    priceUsd,
  }));
  const parsed = z.array(ChartPointSchema).max(2_000).safeParse(normalized);
  if (!parsed.success)
    throw new ServiceError(
      "UPSTREAM_SCHEMA_INVALID",
      "Chart points failed validation.",
      false,
      502,
    );
  return { ...upstream, data: parsed.data };
}

function nearestSentiment(
  entries: z.infer<typeof SentimentUpstreamSchema>["data"],
  targetSeconds: number,
) {
  return entries.reduce((nearest, entry) =>
    Math.abs(Number(entry.timestamp) - targetSeconds) <
    Math.abs(Number(nearest.timestamp) - targetSeconds)
      ? entry
      : nearest,
  );
}

export async function loadSentiment(
  dependencies?: RetryDependencies,
): Promise<UpstreamResult<SentimentData>> {
  const upstream = await validatedJson(
    "https://api.alternative.me/fng/?limit=365&format=json",
    SentimentUpstreamSchema,
    { Accept: "application/json" },
    dependencies,
  );
  const current = upstream.data.data[0]!;
  const currentSeconds = Number(current.timestamp);
  const normalize = (entry: typeof current) => ({
    value: Number(entry.value),
    classification: entry.value_classification,
    timestamp: new Date(Number(entry.timestamp) * 1000).toISOString(),
  });
  const normalized = {
    current: normalize(current),
    thirtyDaysAgo: normalize(
      nearestSentiment(upstream.data.data, currentSeconds - 30 * 86_400),
    ),
    oneYearAgo: normalize(
      nearestSentiment(upstream.data.data, currentSeconds - 365 * 86_400),
    ),
  };
  const parsed = SentimentDataSchema.safeParse(normalized);
  if (!parsed.success)
    throw new ServiceError(
      "UPSTREAM_SCHEMA_INVALID",
      "Sentiment data failed validation.",
      false,
      502,
    );
  return { ...upstream, data: parsed.data };
}
