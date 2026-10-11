import { test, expect } from "@playwright/test";
test("Roomwise rejects double booking and supports cancellation", async ({
  page,
}) => {
  await page.goto("/#booking");
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("Guest", { exact: true }).fill("Demo team");
    await page
      .getByLabel("Start (your local time)", { exact: true })
      .fill("2026-11-01T10:00");
    await page
      .getByLabel("End (your local time)", { exact: true })
      .fill("2026-11-01T11:00");
    await page.getByRole("button", { name: "Create booking" }).click();
    if (i === 0)
      await expect(
        page.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeVisible();
    else await expect(page.getByRole("alert")).toContainText("overlapping");
  }
  await page.screenshot({
    path: "docs/screenshots/roomwise.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0);
});
