import type { z } from "zod";
import type { CacheOutcome, UpstreamResult } from "./types";

type CacheRecord<T> = { data: T; fetchedAt: string };
type CacheLike = Pick<Cache, "match" | "put">;

const inFlight = new Map<string, Promise<unknown>>();

export function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

export type CacheOptions<T> = {
  cache: CacheLike;
  key: string;
  freshSeconds: number;
  maxStaleSeconds: number;
  schema: z.ZodType<T>;
  load: () => Promise<UpstreamResult<T>>;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
};

function cacheRequest(key: string): Request {
  return new Request(`https://cache.lizard-coin-tracker.internal/${key}`);
}

async function readRecord<T>(
  cache: CacheLike,
  request: Request,
  schema: z.ZodType<T>,
): Promise<CacheRecord<T> | null> {
  const response = await cache.match(request);
  if (!response) return null;
  const body = await response.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return null;
  const candidate = body as Record<string, unknown>;
  const data = schema.safeParse(candidate.data);
  if (
    !data.success ||
    typeof candidate.fetchedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.fetchedAt))
  ) {
    return null;
  }
  return { data: data.data, fetchedAt: candidate.fetchedAt };
}

async function writeRecord<T>(
  cache: CacheLike,
  request: Request,
  record: CacheRecord<T>,
  maxStaleSeconds: number,
): Promise<void> {
  await cache.put(
    request,
    new Response(JSON.stringify(record), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${maxStaleSeconds}`,
      },
    }),
  );
}

async function refresh<T>(
  options: CacheOptions<T>,
  request: Request,
  now: () => number,
): Promise<UpstreamResult<T> & { fetchedAt: string }> {
  const existing = inFlight.get(options.key) as
    Promise<UpstreamResult<T> & { fetchedAt: string }> | undefined;
  if (existing) return existing;

  const operation = (async () => {
    const loaded = await options.load();
    const fetchedAt = new Date(now()).toISOString();
    await writeRecord(
      options.cache,
      request,
      { data: loaded.data, fetchedAt },
      options.maxStaleSeconds,
    );
    return { ...loaded, fetchedAt };
  })();
  inFlight.set(options.key, operation);
  try {
    return await operation;
  } finally {
    inFlight.delete(options.key);
  }
}

export async function resolveCached<T>(
  options: CacheOptions<T>,
): Promise<CacheOutcome<T>> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const request = cacheRequest(options.key);
  const cached = await readRecord(options.cache, request, options.schema);

  if (cached) {
    const ageSeconds = Math.max(
      0,
      Math.floor((now() - Date.parse(cached.fetchedAt)) / 1000),
    );
    if (ageSeconds < options.freshSeconds) {
      return {
        data: cached.data,
        freshness: "fresh",
        source: "edge-cache",
        fetchedAt: cached.fetchedAt,
        ageSeconds,
        cacheStatus: "HIT",
        attempts: 0,
        durationMs: now() - startedAt,
      };
    }
    if (ageSeconds <= options.maxStaleSeconds) {
      const revalidation = refresh(options, request, now).catch(
        () => undefined,
      );
      options.waitUntil(revalidation);
      return {
        data: cached.data,
        freshness: "stale",
        source: "edge-cache",
        fetchedAt: cached.fetchedAt,
        ageSeconds,
        cacheStatus: "STALE",
        attempts: 0,
        durationMs: now() - startedAt,
      };
    }
  }

  const loaded = await refresh(options, request, now);
  return {
    data: loaded.data,
    freshness: "fresh",
    source: "upstream",
    fetchedAt: loaded.fetchedAt,
    ageSeconds: 0,
    cacheStatus: "MISS",
    attempts: loaded.attempts,
    durationMs: loaded.durationMs,
  };
}
