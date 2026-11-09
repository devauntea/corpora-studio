import { test, expect } from "@playwright/test";

test("retired anatomy-derived collection is no longer offered", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Choose body/ }).click();
  await page.getByLabel("Search body models").fill("Anatomy-derived");
  await expect(page.locator(".body-library-card")).toHaveCount(0);
});
