import { spawn, spawnSync } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:4174";
const outputDirectory = join(process.cwd(), "docs", "media");
const videoDirectory = join(outputDirectory, ".video");

const meta = {
  freshness: "fresh",
  source: "edge-cache",
  fetchedAt: "2026-07-20T12:00:00.000Z",
  ageSeconds: 5,
  requestId: "media-fixture",
};

const coins = [
  {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    image: null,
    currentPrice: 64_000,
    marketCap: 1_260_000_000_000,
    marketCapRank: 1,
    change24h: 2.4,
    change7d: -1.2,
    sparkline7d: [61_000, 62_800, 62_100, 63_400, 62_900, 64_000],
  },
  {
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    image: null,
    currentPrice: 3_200,
    marketCap: 390_000_000_000,
    marketCapRank: 2,
    change24h: -0.8,
    change7d: 4.1,
    sparkline7d: [2_950, 3_000, 3_080, 3_120, 3_160, 3_200],
  },
  {
    id: "solana",
    symbol: "sol",
    name: "Solana",
    image: null,
    currentPrice: 172,
    marketCap: 80_000_000_000,
    marketCapRank: 5,
    change24h: 1.6,
    change7d: 7.9,
    sparkline7d: [154, 158, 162, 160, 168, 172],
  },
];

const detail = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  image: null,
  currentPrice: 64_000,
  marketCap: 1_260_000_000_000,
  marketCapRank: 1,
  change24h: 2.4,
  allTimeHigh: 73_000,
  description:
    "Bitcoin is a peer-to-peer digital asset secured by a decentralized network.",
};

const chart = [
  { timestampMs: 1_720_000_000_000, priceUsd: 58_000 },
  { timestampMs: 1_720_864_000_000, priceUsd: 60_500 },
  { timestampMs: 1_721_728_000_000, priceUsd: 59_200 },
  { timestampMs: 1_722_592_000_000, priceUsd: 62_400 },
  { timestampMs: 1_723_456_000_000, priceUsd: 61_700 },
  { timestampMs: 1_724_320_000_000, priceUsd: 64_000 },
];

const sentiment = {
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
};

const envelope = (data, overrides = {}) => ({
  data,
  meta: { ...meta, ...overrides },
});

async function mockApi(page, staleMarkets = false) {
  await page.route("**/api/markets", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope(
          coins,
          staleMarkets
            ? {
                freshness: "stale",
                ageSeconds: 1_620,
                fetchedAt: "2026-07-20T11:33:00.000Z",
              }
            : {},
        ),
      ),
    }),
  );
  await page.route("**/api/sentiment", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(sentiment)),
    }),
  );
  await page.route("**/api/coins/*/chart?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(chart)),
    }),
  );
  await page.route("**/api/coins/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(detail)),
    }),
  );
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Fixture preview did not start.");
}

async function captureScreenshots(browser) {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await desktop.newPage();
  await mockApi(page);
  await page.goto(origin);
  await page.getByRole("heading", { name: "Market overview" }).waitFor();
  await page.screenshot({
    path: join(outputDirectory, "market-desktop.png"),
    fullPage: false,
  });
  await page.getByRole("link", { name: "Bitcoin" }).click();
  await page.getByRole("heading", { name: "Bitcoin", exact: true }).waitFor();
  await page.screenshot({
    path: join(outputDirectory, "detail-desktop.png"),
    fullPage: false,
  });
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mockApi(mobilePage);
  await mobilePage.addInitScript(() => {
    localStorage.setItem(
      "lct:state",
      JSON.stringify({
        version: 2,
        watchlist: ["bitcoin", "ethereum"],
        holdings: { bitcoin: 0.42, ethereum: 3.5 },
      }),
    );
  });
  await mobilePage.goto(`${origin}/watchlist`);
  await mobilePage.getByRole("heading", { name: "Watchlist" }).waitFor();
  await mobilePage.screenshot({
    path: join(outputDirectory, "watchlist-mobile.png"),
    fullPage: false,
  });
  await mobilePage.goto(`${origin}/portfolio`);
  await mobilePage.getByRole("heading", { name: "Portfolio" }).waitFor();
  await mobilePage.screenshot({
    path: join(outputDirectory, "portfolio-mobile.png"),
    fullPage: false,
  });
  await mobile.close();

  const stale = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const stalePage = await stale.newPage();
  await mockApi(stalePage, true);
  await stalePage.goto(origin);
  await stalePage.getByText(/showing saved data/i).waitFor();
  await stalePage.screenshot({
    path: join(outputDirectory, "stale-state-desktop.png"),
    fullPage: false,
  });
  await stale.close();
}

async function captureDemo(browser) {
  await rm(videoDirectory, { recursive: true, force: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(origin);
  await page.getByRole("heading", { name: "Market overview" }).waitFor();
  await page.waitForTimeout(1_800);
  await page.getByRole("link", { name: "Bitcoin" }).click();
  await page.getByRole("heading", { name: "Bitcoin", exact: true }).waitFor();
  await page.waitForTimeout(1_600);
  await page.getByRole("button", { name: "30D" }).click();
  await page.waitForTimeout(1_400);
  await page.getByRole("button", { name: "Watch" }).click();
  await page.waitForTimeout(1_300);
  await page.getByRole("link", { name: "Watchlist" }).click();
  await page.getByRole("heading", { name: "Watchlist" }).waitFor();
  await page.waitForTimeout(1_600);
  await page.getByLabel("Amount of Bitcoin owned").fill("0.42");
  await page
    .getByRole("row", { name: /Bitcoin/ })
    .getByRole("button", { name: "Save" })
    .click();
  await page.waitForTimeout(1_400);
  await page.getByRole("link", { name: "Portfolio" }).click();
  await page.getByRole("heading", { name: "Portfolio" }).waitFor();
  await page.waitForTimeout(2_300);
  const video = page.video();
  await context.close();
  if (!video) throw new Error("Playwright did not record the demo.");
  const videoPath = await video.path();
  const stableVideoPath = join(outputDirectory, "workflow.webm");
  await rename(videoPath, stableVideoPath);

  const gifPath = join(outputDirectory, "workflow.gif");
  const conversion = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      stableVideoPath,
      "-vf",
      "fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
      gifPath,
    ],
    { stdio: "inherit" },
  );
  if (conversion.status !== 0)
    throw new Error("ffmpeg could not create the GIF.");
  await rm(videoDirectory, { recursive: true, force: true });
}

await mkdir(outputDirectory, { recursive: true });
const preview = spawn("node", ["scripts/preview-with-fixtures.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: "4174" },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await captureScreenshots(browser);
    await captureDemo(browser);
  } finally {
    await browser.close();
  }
  console.log(`Media captured in ${outputDirectory}`);
} finally {
  preview.kill("SIGTERM");
}
