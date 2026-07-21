import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const source = resolve(process.cwd(), ".artifacts", "legacy-baseline");
const destination = resolve(process.cwd(), ".artifacts", "legacy-baseline-lab");
const originalEndpoint =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h.7d&locale=en";
const fixtureEndpoint = "http://127.0.0.1:4185/api/markets";

const fixture = Array.from({ length: 50 }, (_, index) => {
  const rank = index + 1;
  const currentPrice = 64000 / rank;
  return {
    id: index === 0 ? "bitcoin" : `fixture-asset-${rank}`,
    symbol: index === 0 ? "btc" : `fx${rank}`,
    name: index === 0 ? "Bitcoin" : `Fixture Asset ${rank}`,
    image: "http://127.0.0.1:4185/assets/images/star.svg",
    current_price: currentPrice,
    market_cap: 1260000000000 / rank,
    market_cap_rank: rank,
    price_change_percentage_24h: rank % 2 === 0 ? -0.8 : 1.6,
    price_change_percentage_7d_in_currency: rank % 3 === 0 ? -1.2 : 4.1,
    high_24h: currentPrice * 1.03,
    ath: currentPrice * 1.14,
    ath_change_percentage: -12.2,
    sparkline_in_7d: {
      price: [
        currentPrice * 0.94,
        currentPrice * 0.97,
        currentPrice * 0.96,
        currentPrice,
      ],
    },
  };
});

await cp(source, destination, { recursive: true, force: true });
const scriptPath = join(destination, "assets", "js", "crypto.js");
const script = await readFile(scriptPath, "utf8");
if (!script.includes(originalEndpoint))
  throw new Error("The exact baseline API endpoint was not found.");
await writeFile(scriptPath, script.replace(originalEndpoint, fixtureEndpoint));
const apiDirectory = join(destination, "api");
await mkdir(apiDirectory, { recursive: true });
await writeFile(
  join(apiDirectory, "markets"),
  `${JSON.stringify(fixture)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    destination,
    fixtureRecords: fixture.length,
    instrumentation: "CoinGecko endpoint redirected to same-origin fixture",
  }),
);
