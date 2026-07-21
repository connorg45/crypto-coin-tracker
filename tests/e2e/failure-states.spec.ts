import { expect, test } from "@playwright/test";
import { errorBody, mockApi, mockStaleMarkets } from "./support";

test("sentiment failure remains isolated from market data", async ({
  page,
}) => {
  await mockApi(page);
  await page.route("**/api/sentiment", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify(errorBody()),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sentiment unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Bitcoin/ })).toBeVisible();
});

test("total failure offers retry and recovers", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/markets", (route) =>
    route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify(errorBody("Provider timeout.")),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Provider timeout");
  await page.unroute("**/api/markets");
  await mockApi(page);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("link", { name: /Bitcoin/ })).toBeVisible();
});

test("malformed data is treated as an explicit failure", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/markets", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: 7 }], meta: {} }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("invalid response");
});

test("stale response shows timestamped availability", async ({ page }) => {
  await mockApi(page);
  await mockStaleMarkets(page);
  await page.goto("/");
  await expect(page.getByTestId("stale-banner")).toContainText(
    "Showing saved data",
  );
  await expect(
    page.getByTestId("stale-banner").getByRole("time"),
  ).toHaveAttribute("datetime", "2026-07-20T12:00:00.000Z");
});
