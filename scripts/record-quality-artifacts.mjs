import { execFileSync } from "node:child_process";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const outputArgument = process.argv
  .find((value) => value.startsWith("--output="))
  ?.slice("--output=".length);
if (!outputArgument) throw new Error("Supply --output=<run-directory>.");

const outputDirectory = resolve(process.cwd(), outputArgument);
await mkdir(outputDirectory, { recursive: true });
const audit = execFileSync("npm", ["audit", "--json"], { encoding: "utf8" });
const bundle = execFileSync("node", ["scripts/check-bundle.mjs"], {
  encoding: "utf8",
});
await writeFile(join(outputDirectory, "dependency-audit.json"), audit, "utf8");
await writeFile(join(outputDirectory, "bundle.json"), bundle, "utf8");
await cp(
  resolve(process.cwd(), "coverage", "coverage-summary.json"),
  join(outputDirectory, "coverage-summary.json"),
);
await cp(
  resolve(process.cwd(), "dist", ".vite", "manifest.json"),
  join(outputDirectory, "vite-manifest.json"),
);
console.log(JSON.stringify({ outputDirectory }));
