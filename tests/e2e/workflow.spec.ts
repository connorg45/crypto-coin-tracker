import { expect, test } from "@playwright/test";
import { mockApi } from "./support";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("market → detail → range → watchlist → holding → portfolio persists", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Market overview" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Bitcoin/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bitcoin", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "30D" }).click();
  await expect(page.getByRole("button", { name: "30D" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Watch$/ }).click();
  if (testInfo.project.name === "mobile-chromium")
    await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Watchlist" }).click();
  await page.getByLabel("Amount of Bitcoin owned").fill("0.5");
  await page.getByRole("button", { name: "Save" }).click();
  if (testInfo.project.name === "mobile-chromium")
    await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Portfolio" }).click();
  await expect(page.getByText("$32,000.00").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Bitcoin · 100.0%")).toBeVisible();
});

test("keyboard-only navigation reaches range and watch controls", async ({
  page,
}) => {
  await page.goto("/coin/bitcoin");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "30D" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "30D" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Watch$/ }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /Watching/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
