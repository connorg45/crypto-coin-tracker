import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const root = join(process.cwd(), "dist");
const port = Number(process.env.PORT ?? 4173);
const meta = {
  freshness: "fresh",
  source: "edge-cache",
  fetchedAt: "2026-07-20T12:00:00.000Z",
  ageSeconds: 5,
  requestId: "lighthouse-fixture",
};
const coin = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  image: null,
  currentPrice: 64000,
  marketCap: 1260000000000,
  marketCapRank: 1,
  change24h: 2.4,
  change7d: -1.2,
  sparkline7d: [62000, 63000, 61500, 64000],
};
const endpoints = new Map([
  ["/api/markets", [coin]],
  [
    "/api/sentiment",
    {
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
    },
  ],
  [
    "/api/coins/bitcoin",
    {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      image: null,
      currentPrice: 64000,
      marketCap: 1260000000000,
      marketCapRank: 1,
      change24h: 2.4,
      allTimeHigh: 73000,
      description: "Bitcoin is a peer-to-peer asset.",
    },
  ],
]);
const chart = [
  { timestampMs: 1720000000000, priceUsd: 60000 },
  { timestampMs: 1720086400000, priceUsd: 62000 },
  { timestampMs: 1720172800000, priceUsd: 64000 },
];
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function json(response, data) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ data, meta }));
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (endpoints.has(url.pathname))
    return json(response, endpoints.get(url.pathname));
  if (/^\/api\/coins\/bitcoin\/chart$/.test(url.pathname))
    return json(response, chart);

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalizedPath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, normalizedPath);
  if (!filePath.startsWith(root)) {
    response.writeHead(400).end("Invalid path");
    return;
  }
  try {
    if (!(await stat(filePath)).isFile()) filePath = join(root, "index.html");
  } catch {
    filePath = join(root, "index.html");
  }
  const body = await readFile(filePath);
  const contentType =
    contentTypes[extname(filePath)] ?? "application/octet-stream";
  const acceptsGzip =
    request.headers["accept-encoding"]?.includes("gzip") ?? false;
  const compressible = /^(text\/|application\/javascript)/.test(contentType);
  const responseBody = acceptsGzip && compressible ? gzipSync(body) : body;
  response.writeHead(200, {
    "Content-Type": contentType,
    Vary: "Accept-Encoding",
    ...(acceptsGzip && compressible ? { "Content-Encoding": "gzip" } : {}),
  });
  response.end(responseBody);
}).listen(port, "127.0.0.1", () =>
  console.log(`Fixture preview listening on ${port}`),
);
