import { test, expect } from "@playwright/test";
test("requesting a browser download never clears the unsaved-change guard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Unconfirmed browser download");
  // Suppress the download activation to exercise a blocked browser save.
  await page.evaluate(() => {
    HTMLAnchorElement.prototype.click = function () {};
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText(/Download requested\. Verify the file/),
  ).toBeVisible();
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Discard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Download a copy", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/verify that it arrived before choosing Discard/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Unconfirmed browser download",
  );
});
