import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const baseUrl = argument("url");
const manifestPath = resolve(
  process.cwd(),
  argument("manifest") ?? ".artifacts/legacy-baseline-manifest.json",
);
const outputPath = argument("output");

if (!baseUrl) {
  throw new Error(
    "Supply --url=https://<deployment>.pages.dev to verify the deployed archive.",
  );
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const results = [];
for (const expected of manifest.webPaths) {
  const url = new URL(expected.path, baseUrl);
  const response = await fetch(url, {
    headers: { Accept: "*/*", "Cache-Control": "no-cache" },
  });
  const body = Buffer.from(await response.arrayBuffer());
  const actualHash = createHash("sha256").update(body).digest("hex");
  results.push({
    path: expected.path,
    status: response.status,
    expectedSha256: expected.sha256,
    actualSha256: actualHash,
    matches: response.ok && expected.sha256 === actualHash,
  });
}

const artifact = {
  schemaVersion: 1,
  revision: manifest.revision,
  deploymentUrl: new URL(baseUrl).origin,
  verifiedAt: new Date().toISOString(),
  passed: results.every((result) => result.matches),
  results,
};
if (outputPath) {
  const absoluteOutput = resolve(process.cwd(), outputPath);
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await writeFile(
    absoluteOutput,
    `${JSON.stringify(artifact, null, 2)}\n`,
    "utf8",
  );
}
console.log(JSON.stringify(artifact));
if (!artifact.passed) process.exitCode = 1;
