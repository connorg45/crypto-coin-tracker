import type { z } from "zod";

export type Env = {
  COINGECKO_DEMO_API_KEY?: string;
};

export type UpstreamResult<T> = {
  data: T;
  attempts: number;
  durationMs: number;
};

export type CachePolicy<T> = {
  key: string;
  freshSeconds: number;
  maxStaleSeconds: number;
  schema: z.ZodType<T>;
};

export type CacheOutcome<T> = {
  data: T;
  freshness: "fresh" | "stale";
  source: "upstream" | "edge-cache";
  fetchedAt: string;
  ageSeconds: number;
  cacheStatus: "HIT" | "MISS" | "STALE";
  attempts: number;
  durationMs: number;
};
