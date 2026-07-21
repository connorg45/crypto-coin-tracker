import { expect, test } from "@playwright/test";
import { mockApi } from "./support";

test("390×844 layout has working navigation and no page overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Mobile-only layout check",
  );
  await mockApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveClass(
    /is-open/,
  );
  await page.getByRole("link", { name: "Watchlist" }).click();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("heading", { name: "Watchlist", exact: true }),
  ).toBeVisible();
});
