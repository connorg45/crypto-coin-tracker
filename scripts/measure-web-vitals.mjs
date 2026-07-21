import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const runCount = 20;
const port = 4176;
const origin = `http://127.0.0.1:${port}`;
const outputArgument = process.argv.find((value) =>
  value.startsWith("--output="),
);
const outputPath = outputArgument
  ? outputArgument.slice("--output=".length)
  : join(process.cwd(), "docs", "metrics", "web-vitals.json");
const webVitalsScript = fileURLToPath(
  new URL(
    "../node_modules/web-vitals/dist/web-vitals.iife.js",
    import.meta.url,
  ),
);

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index] ?? null;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The local fixture preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Fixture preview did not start.");
}

const preview = spawn("node", ["scripts/preview-with-fixtures.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const runs = [];
  try {
    for (let run = 1; run <= runCount; run += 1) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        connectionType: "cellular3g",
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto(origin);
      await page.addScriptTag({ path: webVitalsScript });
      await page.evaluate(() => {
        const values = { LCP: null, INP: null, CLS: null };
        window.__LCT_VITALS__ = values;
        window.webVitals.onLCP(
          (metric) => {
            values.LCP = metric.value;
          },
          { reportAllChanges: true },
        );
        window.webVitals.onINP(
          (metric) => {
            values.INP = metric.value;
          },
          { reportAllChanges: true },
        );
        window.webVitals.onCLS(
          (metric) => {
            values.CLS = metric.value;
          },
          { reportAllChanges: true },
        );
      });
      await page.getByRole("heading", { name: "Market overview" }).waitFor();
      await page.getByRole("link", { name: "Bitcoin" }).click();
      await page
        .getByRole("heading", { name: "Bitcoin", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "30D" }).click();
      await page.getByRole("button", { name: "Watch" }).click();
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("link", { name: "Watchlist" }).click();
      await page.getByRole("heading", { name: "Watchlist" }).waitFor();
      await page.waitForTimeout(300);
      const metrics = await page.evaluate(() => window.__LCT_VITALS__);
      runs.push({ run, ...metrics });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const complete = (name) =>
    runs.map((run) => run[name]).filter((value) => Number.isFinite(value));
  const lcp = complete("LCP");
  const inp = complete("INP");
  const cls = complete("CLS");
  const artifact = {
    schemaVersion: 1,
    kind: "controlled-lab-web-vitals",
    recordedAt: new Date().toISOString(),
    page: origin,
    runs: runCount,
    environment: {
      browser: "Chromium via Playwright",
      viewport: "390x844",
      network: "150 ms latency, 1.6 Mbps down, 750 Kbps up",
      cpuSlowdownMultiplier: 4,
      fixtures: "deterministic local API envelopes",
    },
    summary: {
      lcpP75Ms: percentile(lcp, 0.75),
      inpP75Ms: percentile(inp, 0.75),
      clsP75: percentile(cls, 0.75),
      reportedSamples: { LCP: lcp.length, INP: inp.length, CLS: cls.length },
    },
    raw: runs,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(artifact.summary));
} finally {
  preview.kill("SIGTERM");
}
