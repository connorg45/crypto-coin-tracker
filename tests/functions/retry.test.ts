import { ServiceError } from "../../functions/_lib/errors";
import { fetchWithRetry } from "../../functions/_lib/retry";
import { vi } from "vitest";

describe("fetchWithRetry", () => {
  it("returns a successful response without retrying", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const result = await fetchWithRetry(
      "https://provider.test",
      {},
      { fetcher, now: () => 10 },
    );
    expect(result.attempts).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries 429 and honors a short Retry-After header", async () => {
    let now = 0;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "Retry-After": "1" } }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const result = await fetchWithRetry(
      "https://provider.test",
      {},
      { fetcher, sleep, now: () => now, random: () => 0 },
    );
    expect(result.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("uses bounded full-jitter delays and retries network errors", async () => {
    const sleeps: number[] = [];
    let now = 0;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response("{}"));
    const result = await fetchWithRetry(
      "https://provider.test",
      {},
      {
        fetcher,
        random: () => 0.5,
        now: () => now,
        sleep: async (milliseconds) => {
          sleeps.push(milliseconds);
          now += milliseconds;
        },
      },
    );
    expect(result.attempts).toBe(2);
    expect(sleeps[0]).toBe(125);
  });

  it("does not retry non-retryable 4xx responses", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 404 }));
    await expect(
      fetchWithRetry("https://provider.test", {}, { fetcher }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", retryable: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("normalizes exhausted 5xx and rate-limit failures", async () => {
    const sleep = async () => undefined;
    await expect(
      fetchWithRetry(
        "https://provider.test",
        {},
        {
          fetcher: async () => new Response("{}", { status: 503 }),
          sleep,
          random: () => 0,
        },
      ),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      fetchWithRetry(
        "https://provider.test",
        {},
        {
          fetcher: async () => new Response("{}", { status: 429 }),
          sleep,
          random: () => 0,
        },
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMITED" });
  });

  it("fails with a timeout before an attempt when the deadline is exhausted", async () => {
    let call = 0;
    await expect(
      fetchWithRetry(
        "https://provider.test",
        {},
        {
          fetcher: async () => {
            call += 1;
            return new Response("{}", { status: 503 });
          },
          now: () => (call === 0 ? 0 : 9_000),
          sleep: async () => undefined,
          deadlineMs: 8_000,
        },
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });
  });
});
