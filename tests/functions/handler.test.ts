import { handleCached, invalidRequest } from "../../functions/_lib/handler";
import { ServiceError, asServiceError } from "../../functions/_lib/errors";
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

describe("normalized API handler", () => {
  it("returns envelope, cache headers, timing, and safe structured logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await handleCached({
      request: new Request("https://app.test/api/markets"),
      env: {},
      waitUntil: () => undefined,
      cache: new MemoryCache(),
      cacheKey: "markets",
      freshSeconds: 60,
      maxStaleSeconds: 3600,
      schema: z.object({ value: z.number() }),
      load: async () => ({ data: { value: 1 }, attempts: 1, durationMs: 5 }),
    });
    const body = (await response.json()) as {
      data: { value: number };
      meta: { requestId: string };
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("X-LCT-Cache")).toBe("MISS");
    expect(response.headers.get("Server-Timing")).toContain("upstream");
    expect(body.data.value).toBe(1);
    expect(body.meta.requestId).toBeTruthy();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"cacheStatus":"MISS"'),
    );
  });

  it("returns normalized cold failures without response bodies or secrets in logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await handleCached({
      request: new Request("https://app.test/api/markets"),
      env: { COINGECKO_DEMO_API_KEY: "do-not-log" },
      waitUntil: () => undefined,
      cache: new MemoryCache(),
      cacheKey: "markets",
      freshSeconds: 60,
      maxStaleSeconds: 3600,
      schema: z.object({ value: z.number() }),
      load: async () => {
        throw new ServiceError(
          "UPSTREAM_RATE_LIMITED",
          "Rate limited.",
          true,
          429,
        );
      },
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "UPSTREAM_RATE_LIMITED", retryable: true },
    });
    expect(log.mock.calls.flat().join(" ")).not.toContain("do-not-log");
  });

  it("builds invalid-request and unknown-error responses", async () => {
    expect(invalidRequest("Bad range").status).toBe(400);
    expect(asServiceError(new Error("unknown"))).toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      status: 502,
    });
    expect(
      asServiceError(new ServiceError("NOT_FOUND", "missing", false, 404)).code,
    ).toBe("NOT_FOUND");
  });
});
