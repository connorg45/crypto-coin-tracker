import { ApiRequestError, api, queryRetry } from "@/lib/api";
import { safeCoinImage } from "@/lib/images";
import { http, HttpResponse } from "msw";
import { server } from "../testServer";

describe("browser API client", () => {
  it("parses a valid envelope", async () => {
    expect((await api.markets()).data[0]!.id).toBe("bitcoin");
  });

  it("normalizes structured API errors", async () => {
    server.use(
      http.get("/api/markets", () =>
        HttpResponse.json(
          {
            error: {
              code: "UPSTREAM_RATE_LIMITED",
              message: "Slow down.",
              retryable: true,
              requestId: "rate",
            },
          },
          { status: 429 },
        ),
      ),
    );
    await expect(api.markets()).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Slow down.",
      detail: { retryable: true },
    });
  });

  it("rejects unstructured errors and malformed success bodies", async () => {
    server.use(
      http.get("/api/markets", () =>
        HttpResponse.json({ nope: true }, { status: 500 }),
      ),
    );
    await expect(api.markets()).rejects.toThrow("unexpected error");
    server.use(
      http.get("/api/markets", () =>
        HttpResponse.json({ data: "wrong", meta: {} }),
      ),
    );
    await expect(api.markets()).rejects.toThrow("invalid response");
  });

  it("normalizes network failures", async () => {
    server.use(http.get("/api/markets", () => HttpResponse.error()));
    await expect(api.markets()).rejects.toThrow("could not be reached");
  });

  it("limits client retries to one retryable failure", () => {
    expect(
      queryRetry(
        0,
        new ApiRequestError("retry", {
          code: "UPSTREAM_TIMEOUT",
          message: "retry",
          retryable: true,
          requestId: "1",
        }),
      ),
    ).toBe(true);
    expect(
      queryRetry(
        0,
        new ApiRequestError("stop", {
          code: "INVALID_REQUEST",
          message: "stop",
          retryable: false,
          requestId: "1",
        }),
      ),
    ).toBe(false);
    expect(queryRetry(1, new Error("network"))).toBe(false);
    expect(queryRetry(0, new Error("network"))).toBe(true);
  });

  it("allows only provider image hosts", () => {
    expect(safeCoinImage("https://coin-images.coingecko.com/a.png")).toContain(
      "coin-images.coingecko.com",
    );
    expect(safeCoinImage("https://example.com/a.png")).toBe(
      "/coin-placeholder.svg",
    );
    expect(safeCoinImage("javascript:alert(1)")).toBe("/coin-placeholder.svg");
    expect(safeCoinImage(null)).toBe("/coin-placeholder.svg");
  });
});
