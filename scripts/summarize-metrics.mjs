import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const baselinePath = argument("baseline");
const finalPath = argument("final");
const outputPath = argument("output") ?? "docs/metrics/summary.json";
if (!baselinePath || !finalPath) {
  throw new Error("Supply --baseline=<run-dir> and --final=<run-dir>.");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    if (entry.isFile()) files.push(path);
  }
  return files;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function summarizeRun(directory) {
  const absolute = resolve(process.cwd(), directory);
  const manifest = JSON.parse(
    await readFile(join(absolute, "manifest.json"), "utf8"),
  );
  const reports = (await walk(join(absolute, "lighthouse"))).filter((file) =>
    file.endsWith(".json"),
  );
  const byViewport = { mobile: [], desktop: [] };
  for (const reportPath of reports) {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const viewport = reportPath.includes("/mobile/") ? "mobile" : "desktop";
    byViewport[viewport].push({
      performance: report.categories.performance.score * 100,
      accessibility: report.categories.accessibility.score * 100,
      lcpMs: report.audits["largest-contentful-paint"].numericValue,
      cls: report.audits["cumulative-layout-shift"].numericValue,
      tbtMs: report.audits["total-blocking-time"].numericValue,
    });
  }
  const summarizeViewport = (records) => ({
    runs: records.length,
    medianPerformance: median(records.map((record) => record.performance)),
    medianAccessibility: median(records.map((record) => record.accessibility)),
    medianLcpMs: median(records.map((record) => record.lcpMs)),
    medianCls: median(records.map((record) => record.cls)),
    medianTbtMs: median(records.map((record) => record.tbtMs)),
  });
  return {
    revision: manifest.revision,
    kind: manifest.kind,
    page: manifest.page,
    mobile: summarizeViewport(byViewport.mobile),
    desktop: summarizeViewport(byViewport.desktop),
  };
}

const baseline = await summarizeRun(baselinePath);
const final = await summarizeRun(finalPath);
const artifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  warning:
    "Controlled local lab results with deterministic settings; not field data or user traffic.",
  baseline,
  final,
  delta: {
    mobilePerformance:
      final.mobile.medianPerformance - baseline.mobile.medianPerformance,
    mobileAccessibility:
      final.mobile.medianAccessibility - baseline.mobile.medianAccessibility,
    mobileLcpMs: final.mobile.medianLcpMs - baseline.mobile.medianLcpMs,
    mobileCls: final.mobile.medianCls - baseline.mobile.medianCls,
  },
};
await writeFile(
  resolve(process.cwd(), outputPath),
  `${JSON.stringify(artifact, null, 2)}\n`,
);
console.log(JSON.stringify(artifact));
