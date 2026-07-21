import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const baseline = "96466f32612274994cdd1e3b9a89ec571b798f40";
const artifactRoot = resolve(process.cwd(), ".artifacts");
const outputDirectory = join(artifactRoot, "legacy-baseline");
const archivePath = join(artifactRoot, "legacy-baseline.tar");
const manifestArgument = process.argv
  .find((value) => value.startsWith("--manifest="))
  ?.slice("--manifest=".length);
const manifestPath = manifestArgument
  ? resolve(process.cwd(), manifestArgument)
  : join(artifactRoot, "legacy-baseline-manifest.json");
const htmlFiles = [
  "index.html",
  "coin.html",
  "crypto.html",
  "learnmore.html",
  "portfolio.html",
  "watchlist.html",
];

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

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

execFileSync("git", ["cat-file", "-e", `${baseline}^{commit}`], {
  stdio: "ignore",
});
await mkdir(artifactRoot, { recursive: true });
await rm(outputDirectory, { recursive: true, force: true });
await rm(archivePath, { force: true });
execFileSync(
  "git",
  ["archive", "--format=tar", `--output=${archivePath}`, baseline],
  { stdio: "inherit" },
);
await mkdir(outputDirectory, { recursive: true });
execFileSync("tar", ["-xf", archivePath, "-C", outputDirectory], {
  stdio: "inherit",
});
await rm(archivePath, { force: true });

const files = (await walk(outputDirectory)).sort();
const records = await Promise.all(
  files.map(async (file) => {
    const path = relative(outputDirectory, file);
    const body = await readFile(file);
    return { path, bytes: body.byteLength, sha256: sha256(body) };
  }),
);
const recordByPath = new Map(records.map((record) => [record.path, record]));
const webFiles = records.filter(
  (record) =>
    htmlFiles.includes(record.path) || record.path.startsWith("assets/"),
);
const webPaths = webFiles.map((record) => ({
  path: record.path === "index.html" ? "/" : `/${record.path}`,
  source: record.path,
  bytes: record.bytes,
  sha256: record.sha256,
}));

for (const required of htmlFiles) {
  if (!recordByPath.has(required)) throw new Error(`Missing ${required}`);
}

const manifest = {
  schemaVersion: 1,
  revision: baseline,
  tag: "legacy-baseline-2026-03-26",
  generatedAt: new Date().toISOString(),
  archiveMethod: "git archive --format=tar",
  fileCount: records.length,
  files: records,
  webPaths,
};
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({ outputDirectory, manifestPath, files: records.length }),
);
