import {
  ApiErrorSchema,
  ChartEnvelopeSchema,
  CoinDetailEnvelopeSchema,
  MarketsEnvelopeSchema,
  SentimentEnvelopeSchema,
  type ApiEnvelope,
  type ApiError,
  type ChartPoint,
  type ChartRange,
  type CoinDetail,
  type MarketCoin,
  type SentimentData,
} from "@shared/contracts";
import type { z } from "zod";

export class ApiRequestError extends Error {
  readonly detail: ApiError["error"] | null;

  constructor(message: string, detail: ApiError["error"] | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.detail = detail;
  }
}

async function fetchEnvelope<T>(
  path: string,
  schema: z.ZodType<ApiEnvelope<T>>,
  signal?: AbortSignal,
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    const init: RequestInit = {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    };
    if (signal) init.signal = signal;
    response = await fetch(path, init);
  } catch {
    throw new ApiRequestError(
      "The data service could not be reached. Check your connection and retry.",
    );
  }

  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(body);
    if (parsedError.success) {
      throw new ApiRequestError(
        parsedError.data.error.message,
        parsedError.data.error,
      );
    }
    throw new ApiRequestError("The data service returned an unexpected error.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRequestError("The data service returned an invalid response.");
  }
  return parsed.data;
}

export const fetchMarkets = (signal?: AbortSignal) =>
  fetchEnvelope<MarketCoin[]>("/api/markets", MarketsEnvelopeSchema, signal);

export const fetchCoin = (coinId: string, signal?: AbortSignal) =>
  fetchEnvelope<CoinDetail>(
    `/api/coins/${encodeURIComponent(coinId)}`,
    CoinDetailEnvelopeSchema,
    signal,
  );

export const fetchChart = (
  coinId: string,
  range: ChartRange,
  signal?: AbortSignal,
) =>
  fetchEnvelope<ChartPoint[]>(
    `/api/coins/${encodeURIComponent(coinId)}/chart?range=${range}`,
    ChartEnvelopeSchema,
    signal,
  );

export const fetchSentiment = (signal?: AbortSignal) =>
  fetchEnvelope<SentimentData>(
    "/api/sentiment",
    SentimentEnvelopeSchema,
    signal,
  );

export const api = {
  markets: fetchMarkets,
  coin: fetchCoin,
  chart: fetchChart,
  sentiment: fetchSentiment,
};

export function queryRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiRequestError && error.detail)
    return error.detail.retryable;
  return true;
}
