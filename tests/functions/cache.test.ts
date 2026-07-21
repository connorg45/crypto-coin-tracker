import { edgeCache, resolveCached } from "../../functions/_lib/cache";
import { z } from "zod";
import { vi } from "vitest";

class MemoryCache {
  response: Response | null = null;
  async match() {
    return this.response?.clone();
  }
  async put(_request: Request, response: Response) {
    this.response = response.clone();
  }
}

const DataSchema = z.object({ value: z.number() });

function options(
  cache: MemoryCache,
  now: () => number,
  load = vi.fn(async () => ({
    data: { value: 2 },
    attempts: 1,
    durationMs: 20,
  })),
) {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    load,
    input: {
      cache,
      key: "test/key",
      freshSeconds: 60,
      maxStaleSeconds: 3_600,
      schema: DataSchema,
      load,
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
      now,
    },
  };
}

describe("edge cache policy", () => {
  it("selects the Cloudflare default cache", () => {
    const original = globalThis.caches;
    Object.defineProperty(globalThis, "caches", {
      value: { default: "edge" },
      configurable: true,
    });
    expect(edgeCache()).toBe("edge");
    Object.defineProperty(globalThis, "caches", {
      value: original,
      configurable: true,
    });
  });
  it("loads and writes on a miss", async () => {
    const cache = new MemoryCache();
    const setup = options(cache, () => Date.parse("2026-07-20T00:00:00.000Z"));
    const result = await resolveCached(setup.input);
    expect(result).toMatchObject({
      data: { value: 2 },
      cacheStatus: "MISS",
      source: "upstream",
      ageSeconds: 0,
    });
    expect(setup.load).toHaveBeenCalledOnce();
    expect(cache.response?.headers.get("Cache-Control")).toBe(
      "public, max-age=3600",
    );
  });

  it("serves a fresh validated hit without upstream work", async () => {
    const cache = new MemoryCache();
    cache.response = new Response(
      JSON.stringify({
        data: { value: 1 },
        fetchedAt: "2026-07-20T00:00:00.000Z",
      }),
    );
    const setup = options(cache, () => Date.parse("2026-07-20T00:00:30.000Z"));
    expect(await resolveCached(setup.input)).toMatchObject({
      data: { value: 1 },
      cacheStatus: "HIT",
      freshness: "fresh",
      ageSeconds: 30,
    });
    expect(setup.load).not.toHaveBeenCalled();
  });

  it("serves stale data immediately and revalidates in the background", async () => {
    const cache = new MemoryCache();
    cache.response = new Response(
      JSON.stringify({
        data: { value: 1 },
        fetchedAt: "2026-07-20T00:00:00.000Z",
      }),
    );
    const setup = options(cache, () => Date.parse("2026-07-20T00:02:00.000Z"));
    const result = await resolveCached(setup.input);
    expect(result).toMatchObject({
      data: { value: 1 },
      cacheStatus: "STALE",
      freshness: "stale",
      source: "edge-cache",
    });
    expect(setup.pending).toHaveLength(1);
    await Promise.all(setup.pending);
    expect(setup.load).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent background revalidation", async () => {
    const cache = new MemoryCache();
    cache.response = new Response(
      JSON.stringify({
        data: { value: 1 },
        fetchedAt: "2026-07-20T00:00:00.000Z",
      }),
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = vi.fn(async () => {
      await gate;
      return { data: { value: 2 }, attempts: 1, durationMs: 2 };
    });
    const first = options(
      cache,
      () => Date.parse("2026-07-20T00:02:00.000Z"),
      load,
    );
    const second = options(
      cache,
      () => Date.parse("2026-07-20T00:02:00.000Z"),
      load,
    );
    await Promise.all([
      resolveCached(first.input),
      resolveCached(second.input),
    ]);
    release();
    await Promise.all([...first.pending, ...second.pending]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("ignores invalid and over-age cache records", async () => {
    const cache = new MemoryCache();
    cache.response = new Response(
      JSON.stringify({ data: { value: "bad" }, fetchedAt: "not-a-date" }),
    );
    const invalid = options(cache, () =>
      Date.parse("2026-07-20T02:00:00.000Z"),
    );
    expect((await resolveCached(invalid.input)).cacheStatus).toBe("MISS");

    cache.response = new Response(
      JSON.stringify({
        data: { value: 1 },
        fetchedAt: "2026-07-20T00:00:00.000Z",
      }),
    );
    const expired = options(cache, () =>
      Date.parse("2026-07-20T02:00:00.000Z"),
    );
    expect((await resolveCached(expired.input)).data).toEqual({ value: 2 });
  });

  it("keeps stale success when background refresh fails", async () => {
    const cache = new MemoryCache();
    cache.response = new Response(
      JSON.stringify({
        data: { value: 1 },
        fetchedAt: "2026-07-20T00:00:00.000Z",
      }),
    );
    const setup = options(
      cache,
      () => Date.parse("2026-07-20T00:02:00.000Z"),
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect((await resolveCached(setup.input)).data).toEqual({ value: 1 });
    await expect(Promise.all(setup.pending)).resolves.toEqual([undefined]);
  });
});
