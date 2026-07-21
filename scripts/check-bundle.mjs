import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const assetsDirectory = join(process.cwd(), "dist", "assets");
const files = await readdir(assetsDirectory);
const inventory = [];

for (const file of files.filter((name) => /\.(js|css)$/.test(name))) {
  const content = await readFile(join(assetsDirectory, file));
  inventory.push({
    file,
    bytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength,
  });
}

const javascriptGzipBytes = inventory
  .filter(({ file }) => file.endsWith(".js"))
  .reduce((sum, file) => sum + file.gzipBytes, 0);
const staticGzipBytes = inventory.reduce(
  (sum, file) => sum + file.gzipBytes,
  0,
);
const limits = { javascriptGzipBytes: 150 * 1024, staticGzipBytes: 500 * 1024 };

console.log(
  JSON.stringify(
    { inventory, totals: { javascriptGzipBytes, staticGzipBytes }, limits },
    null,
    2,
  ),
);

if (javascriptGzipBytes > limits.javascriptGzipBytes) {
  throw new Error(
    `Initial JavaScript is ${javascriptGzipBytes} bytes gzip; budget is ${limits.javascriptGzipBytes}.`,
  );
}
if (staticGzipBytes > limits.staticGzipBytes) {
  throw new Error(
    `Initial CSS/JavaScript is ${staticGzipBytes} bytes gzip; budget is ${limits.staticGzipBytes}.`,
  );
}
