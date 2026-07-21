import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const deploymentUrl = process.argv[2];
if (!deploymentUrl || !/^https:\/\//.test(deploymentUrl)) {
  throw new Error(
    "Usage: npm run metrics:api -- https://deployment.example [output-directory]",
  );
}
const outputDirectory =
  process.argv[3] ??
  join(
    process.cwd(),
    "docs",
    "metrics",
    "runs",
    "uncommitted",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
const requestCount = 50;
const paths = [
  "/api/markets",
  "/api/coins/bitcoin",
  "/api/coins/bitcoin/chart?range=7d",
  "/api/sentiment",
];

await fetch(new URL("/api/markets", deploymentUrl), {
  headers: { Accept: "application/json" },
});
const samples = [];
for (let index = 0; index < requestCount; index += 1) {
  const path = paths[index % paths.length];
  const started = performance.now();
  const response = await fetch(new URL(path, deploymentUrl), {
    headers: { Accept: "application/json" },
  });
  const durationMs = performance.now() - started;
  await response.arrayBuffer();
  samples.push({
    index,
    path,
    status: response.status,
    durationMs,
    cacheStatus: response.headers.get("x-lct-cache"),
    serverTiming: response.headers.get("server-timing"),
    requestId: response.headers.get("x-request-id"),
  });
}

const sortedDurations = samples
  .map(({ durationMs }) => durationMs)
  .sort((a, b) => a - b);
const percentile = (fraction) =>
  sortedDurations[
    Math.min(
      sortedDurations.length - 1,
      Math.ceil(sortedDurations.length * fraction) - 1,
    )
  ];
const hitOrStale = samples.filter(
  ({ cacheStatus }) => cacheStatus === "HIT" || cacheStatus === "STALE",
).length;
const hits = samples.filter(({ cacheStatus }) => cacheStatus === "HIT").length;
const summary = {
  deploymentUrl,
  requestCount,
  cacheHitOrStaleRate: hitOrStale / requestCount,
  thirdPartyRequestsAvoidedByFreshHits: hits,
  p50Ms: percentile(0.5),
  p95Ms: percentile(0.95),
  errorRate:
    samples.filter(({ status }) => status >= 500).length / requestCount,
};
const artifact = {
  methodologyVersion: 1,
  capturedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    region: process.env.LCT_RUNNER_REGION ?? "not-recorded",
  },
  summary,
  samples,
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  join(outputDirectory, "api-samples.json"),
  `${JSON.stringify(artifact, null, 2)}\n`,
);
await writeFile(
  join(outputDirectory, "manifest.json"),
  `${JSON.stringify({ commands: [`npm run metrics:api -- ${deploymentUrl} ${outputDirectory}`], files: ["api-samples.json"], summary }, null, 2)}\n`,
);
console.log(JSON.stringify({ outputDirectory, summary }, null, 2));
