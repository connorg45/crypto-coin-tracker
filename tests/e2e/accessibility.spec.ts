import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockApi } from "./support";

for (const route of ["/", "/coin/bitcoin", "/watchlist", "/portfolio"]) {
  test(`has no serious or critical axe violations on ${route}`, async ({
    page,
  }) => {
    await mockApi(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        "lct:state",
        JSON.stringify({
          version: 2,
          watchlist: ["bitcoin"],
          holdings: { bitcoin: 0.5 },
        }),
      ),
    );
    await page.goto(route);
    await page.getByRole("heading", { level: 1 }).waitFor();
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}
