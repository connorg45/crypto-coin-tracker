const baseUrl = process.argv[2] ?? process.env.LCT_PRODUCTION_URL;
if (!baseUrl || !/^https:\/\//.test(baseUrl))
  throw new Error("Provide the production HTTPS URL.");

const routes = [
  "/api/markets",
  "/api/coins/bitcoin",
  "/api/coins/bitcoin/chart?range=7d",
  "/api/sentiment",
];
for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  const body = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("data" in body) ||
    !body.meta ||
    !["fresh", "stale"].includes(body.meta.freshness) ||
    typeof body.meta.requestId !== "string"
  ) {
    throw new Error(`${route} did not match the API envelope.`);
  }
  console.log(
    JSON.stringify({
      route,
      status: response.status,
      freshness: body.meta.freshness,
      cacheStatus: response.headers.get("x-lct-cache"),
    }),
  );
}
