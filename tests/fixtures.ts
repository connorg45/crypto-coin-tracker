import type {
  ApiEnvelope,
  ChartPoint,
  CoinDetail,
  FreshnessMeta,
  MarketCoin,
  SentimentData,
} from "@shared/contracts";

export const freshMeta: FreshnessMeta = {
  freshness: "fresh",
  source: "upstream",
  fetchedAt: "2026-07-20T12:00:00.000Z",
  ageSeconds: 0,
  requestId: "test-request",
};

export const staleMeta: FreshnessMeta = {
  ...freshMeta,
  freshness: "stale",
  source: "edge-cache",
  ageSeconds: 120,
};

export const marketCoins: MarketCoin[] = [
  {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
    currentPrice: 64_000,
    marketCap: 1_260_000_000_000,
    marketCapRank: 1,
    change24h: 2.4,
    change7d: -1.2,
    sparkline7d: [62_000, 63_000, 61_500, 64_000],
  },
  {
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    image:
      "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
    currentPrice: 3_200,
    marketCap: 390_000_000_000,
    marketCapRank: 2,
    change24h: -0.8,
    change7d: 4.1,
    sparkline7d: [3_000, 3_050, 3_180, 3_200],
  },
];

export const coinDetail: CoinDetail = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  image: marketCoins[0]!.image,
  currentPrice: 64_000,
  marketCap: 1_260_000_000_000,
  marketCapRank: 1,
  change24h: 2.4,
  allTimeHigh: 73_000,
  description: "Bitcoin is a peer-to-peer asset.",
};

export const chartPoints: ChartPoint[] = [
  { timestampMs: 1_720_000_000_000, priceUsd: 60_000 },
  { timestampMs: 1_720_086_400_000, priceUsd: 62_000 },
  { timestampMs: 1_720_172_800_000, priceUsd: 64_000 },
];

export const sentiment: SentimentData = {
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

export const envelope = <T>(data: T, meta = freshMeta): ApiEnvelope<T> => ({
  data,
  meta,
});
