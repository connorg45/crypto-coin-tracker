import {
  loadChart,
  loadCoin,
  loadMarkets,
  loadSentiment,
} from "../../functions/_lib/upstream";
import { vi } from "vitest";

const responseFetcher = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status }),
  );

describe("provider validation and normalization", () => {
  it("normalizes market fields and fixes the seven-day contract", async () => {
    const fetcher = responseFetcher([
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "https://coin-images.coingecko.com/coin.png",
        current_price: 10,
        market_cap: 100,
        market_cap_rank: 1,
        price_change_percentage_24h: 2,
        price_change_percentage_7d_in_currency: 3,
        sparkline_in_7d: { price: [8, 9, 10] },
      },
    ]);
    const result = await loadMarkets({}, { fetcher });
    expect(result.data[0]).toMatchObject({
      id: "bitcoin",
      currentPrice: 10,
      change7d: 3,
    });
    expect(String(fetcher.mock.calls[0]![0])).toContain(
      "price_change_percentage=7d",
    );
  });

  it("drops images from untrusted hosts", async () => {
    const fetcher = responseFetcher([
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "javascript:alert(1)",
        current_price: 10,
        market_cap: 100,
        market_cap_rank: 1,
        price_change_percentage_24h: null,
        sparkline_in_7d: { price: [8, 10] },
      },
    ]);
    expect((await loadMarkets({}, { fetcher })).data[0]!.image).toBeNull();
  });

  it("normalizes coin description to plain text and sends the key only upstream", async () => {
    const fetcher = responseFetcher({
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      image: { large: "https://assets.coingecko.com/coin.png", small: null },
      market_cap_rank: 1,
      market_data: {
        current_price: { usd: 10 },
        market_cap: { usd: 100 },
        price_change_percentage_24h: 1,
        ath: { usd: 20 },
      },
      description: {
        en: "<p>Peer &amp; peer</p><script>ignored text</script> &amp;lt;encoded&amp;gt;",
      },
    });
    const result = await loadCoin(
      { COINGECKO_DEMO_API_KEY: "test-secret" },
      "bitcoin",
      { fetcher },
    );
    expect(result.data.description).toBe(
      "Peer & peer ignored text &lt;encoded&gt;",
    );
    const headers = new Headers(fetcher.mock.calls[0]![1]?.headers);
    expect(headers.get("x-cg-demo-api-key")).toBe("test-secret");
  });

  it("normalizes chart tuples", async () => {
    const result = await loadChart({}, "bitcoin", "7", {
      fetcher: responseFetcher({
        prices: [
          [1000.4, 4.5],
          [2000, 5],
        ],
      }),
    });
    expect(result.data).toEqual([
      { timestampMs: 1000, priceUsd: 4.5 },
      { timestampMs: 2000, priceUsd: 5 },
    ]);
  });

  it("selects nearest sentiment snapshots", async () => {
    const day = 86_400;
    const current = 2_000_000_000;
    const data = [
      {
        value: "55",
        value_classification: "Greed",
        timestamp: String(current),
      },
      {
        value: "40",
        value_classification: "Fear",
        timestamp: String(current - 30 * day),
      },
      {
        value: "50",
        value_classification: "Neutral",
        timestamp: String(current - 364 * day),
      },
    ];
    const result = await loadSentiment({ fetcher: responseFetcher({ data }) });
    expect(result.data.thirtyDaysAgo.value).toBe(40);
    expect(result.data.oneYearAgo.value).toBe(50);
  });

  it("rejects malformed provider responses without retrying schema failures", async () => {
    const fetcher = responseFetcher({ unexpected: true });
    await expect(loadMarkets({}, { fetcher })).rejects.toMatchObject({
      code: "UPSTREAM_SCHEMA_INVALID",
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
