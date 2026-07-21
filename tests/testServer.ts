import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  chartPoints,
  coinDetail,
  envelope,
  marketCoins,
  sentiment,
} from "./fixtures";

export const handlers = [
  http.get("/api/markets", () => HttpResponse.json(envelope(marketCoins))),
  http.get("/api/coins/:id", ({ params }) =>
    params.id === "bitcoin"
      ? HttpResponse.json(envelope(coinDetail))
      : HttpResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Coin not found.",
              retryable: false,
              requestId: "not-found",
            },
          },
          { status: 404 },
        ),
  ),
  http.get("/api/coins/:id/chart", () =>
    HttpResponse.json(envelope(chartPoints)),
  ),
  http.get("/api/sentiment", () => HttpResponse.json(envelope(sentiment))),
];

export const server = setupServer(...handlers);
