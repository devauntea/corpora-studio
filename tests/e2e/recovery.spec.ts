import { test, expect } from "@playwright/test";
test("local recovery survives reload and checkpoints remain separate from later edits", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".loading")).toHaveCount(0);
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Recovery both studios");
  await page.getByRole("button", { name: "Fashion", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Chest / full bust", exact: true })
    .fill("1050");
  await page
    .getByRole("spinbutton", { name: "Chest / full bust", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Open project library")).toContainText(
    "Local copy up to date",
  );
  await page.reload();
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.getByLabel("Open project library").click();
  let dialog = page.getByRole("dialog", { name: "Project library" });
  const entry = dialog
    .locator("article")
    .filter({ hasText: "Recovery both studios" });
  await expect(entry).toHaveCount(1);
  await entry.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Recovery both studios",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Chest / full bust", exact: true }),
  ).toHaveValue("1050");
  await page.getByLabel("Open project library").click();
  await dialog.getByLabel("Checkpoint name").fill("Before neckline");
  await dialog
    .getByRole("button", { name: "Keep checkpoint", exact: true })
    .click();
  await expect(
    dialog.locator("article").filter({ hasText: "Before neckline" }),
  ).toHaveCount(1);
  await dialog.getByLabel("Close project library").click();
  await page
    .getByRole("spinbutton", { name: "Neckline depth", exact: true })
    .fill("35");
  await page
    .getByRole("spinbutton", { name: "Neckline depth", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Open project library")).toContainText(
    "Local copy up to date",
  );
  await page.getByLabel("Open project library").click();
  await dialog
    .locator("article")
    .filter({ hasText: "Before neckline" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Neckline depth", exact: true }),
  ).toHaveValue("25");
  // Merely opening an older checkpoint must not replace the latest recovery copy.
  await page.waitForTimeout(1500);
  await page.getByLabel("Open project library").click();
  await dialog
    .locator("article")
    .filter({ hasText: "Autosaved workspace" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Neckline depth", exact: true }),
  ).toHaveValue("35");
  await page.getByRole("button", { name: "Tattoo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Solar botanical", exact: true }),
  ).toBeVisible();
});
